import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { Dataset, Request, RequestQueue } from 'crawlee';
import { normalizeUrl } from '@apify/utilities';
import { consoleLogger } from '../logs.js';

type ScanStatus = 'running' | 'crawled' | 'completed' | 'interrupted';

type PageEntry = { url: string; actualUrl?: string; pageTitle?: string; [k: string]: unknown };
type RedirectEntry = { fromUrl: string; toUrl: string };
type UrlsCrawledLike = {
  scanned: PageEntry[];
  invalid: PageEntry[];
  error: PageEntry[];
  forbidden: PageEntry[];
  userExcluded: PageEntry[];
  scannedRedirects: RedirectEntry[];
  notScannedRedirects: RedirectEntry[];
};

type RequestOp = { queue: string; uniqueKey: string; request?: Record<string, unknown>; state?: 'handled' | 'pending' };

export type AggregatorScanMetadata = {
  oobeeVersion: string;
  answers: Record<string, unknown>;
  type: string;
  entryUrl: string;
  randomToken: string;
  startedAt: string;
};

const PAGE_LIST_KEYS = ['scanned', 'invalid', 'error', 'forbidden', 'userExcluded'] as const;
const REDIRECT_LIST_KEYS = ['scannedRedirects', 'notScannedRedirects'] as const;
const FLUSH_INTERVAL_MS = 2000;
const MAX_BATCH_BYTES = 8 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 60_000;
const FINALIZE_TIMEOUT_MS = 30_000;
const SCAN_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let scanId: string | null = null;
let resuming = false;
let resumedScannedCount = 0;
let trackedUrlsCrawled: UrlsCrawledLike | null = null;
let lastUrlsCrawledSignature = '';
let resultsBuffer: string[] = [];
let opsBuffer: RequestOp[] = [];
let flushChain: Promise<void> = Promise.resolve();
let flushTimer: NodeJS.Timeout | null = null;
let failureStreak = 0;
const uploadsInFlight = new Set<Promise<void>>();
const uploadWaiters: (() => void)[] = [];
const wrappedStorages = new WeakSet<object>();

const getBaseUrl = (): string | null => {
  const raw = process.env.OOBEE_AGGREGATOR_URL?.trim();
  return raw ? raw.replace(/\/+$/, '') : null;
};

export const isAggregatorConfigured = (): boolean => getBaseUrl() !== null;
export const isAggregatorActive = (): boolean => scanId !== null;
export const isResumingAggregatorScan = (): boolean => resuming;
export const getAggregatorScanId = (): string | null => scanId;
// Pages restored from a previous run count against maxpages.
export const getResumedScannedCount = (): number => resumedScannedCount;

const call = async (
  method: string,
  route: string,
  body?: Buffer | string,
  retries = 3,
): Promise<Response> => {
  const base = getBaseUrl();
  if (!base) throw new Error('OOBEE_AGGREGATOR_URL is not set');
  const headers: Record<string, string> = {};
  if (typeof body === 'string') headers['content-type'] = 'application/json';
  if (process.env.OOBEE_AGGREGATOR_TOKEN) {
    headers.authorization = `Bearer ${process.env.OOBEE_AGGREGATOR_TOKEN}`;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(`${base}${route}`, {
        method,
        headers,
        body: body as BodyInit | undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return res;
      const text = await res.text().catch(() => '');
      const err = new Error(`Aggregator ${method} ${route} failed: ${res.status} ${text}`);
      // 4xx won't succeed on retry.
      if (res.status < 500) throw Object.assign(err, { noRetry: true });
      lastError = err;
    } catch (err) {
      if ((err as { noRetry?: boolean }).noRetry) throw err;
      lastError = err;
    }
    if (attempt < retries) await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastError;
};

const callJson = (method: string, route: string, payload: unknown, retries?: number) =>
  call(method, route, JSON.stringify(payload), retries);

async function* ndjson(route: string): AsyncGenerator<any> {
  const res = await call('GET', route);
  const rl = readline.createInterface({
    input: Readable.fromWeb(res.body as import('stream/web').ReadableStream),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line) yield JSON.parse(line);
  }
}

const norm = (u: string): string => (u ? normalizeUrl(u) || u : '');

const startFlushTimer = () => {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushAggregator().catch(() => {});
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref();
};

const urlsCrawledSignature = (u: UrlsCrawledLike): string =>
  [...PAGE_LIST_KEYS, ...REDIRECT_LIST_KEYS].map(k => u[k]?.length ?? 0).join(',');

const doFlush = async () => {
  if (!scanId) return;
  const results = resultsBuffer;
  const ops = opsBuffer;
  resultsBuffer = [];
  opsBuffer = [];

  try {
    // A large result backlog is sent in size-capped chunks; the last chunk also carries the
    // queue ops and urlsCrawled snapshot so the server commits them together.
    for (;;) {
      let count = 0;
      let bytes = 0;
      while (count < results.length && (count === 0 || bytes + results[count].length <= MAX_BATCH_BYTES)) {
        bytes += results[count].length;
        count += 1;
      }
      const isLast = count === results.length;
      const parts = [`"items":[${results.slice(0, count).join(',')}]`];
      let signature: string | null = null;
      if (isLast) {
        if (ops.length > 0) parts.push(`"ops":${JSON.stringify(ops)}`);
        if (trackedUrlsCrawled) {
          const current = urlsCrawledSignature(trackedUrlsCrawled);
          if (current !== lastUrlsCrawledSignature) {
            signature = current;
            parts.push(`"urlsCrawled":${JSON.stringify(trackedUrlsCrawled)}`);
          }
        }
        if (count === 0 && ops.length === 0 && signature === null) break;
      }
      await call('POST', `/scans/${scanId}/sync`, `{${parts.join(',')}}`);
      results.splice(0, count);
      if (isLast) {
        ops.length = 0;
        if (signature !== null) lastUrlsCrawledSignature = signature;
        break;
      }
    }

    if (failureStreak > 0) consoleLogger.info('Aggregator sync recovered.');
    failureStreak = 0;
  } catch (err) {
    // Keep unsent data for the next flush, ahead of anything buffered meanwhile.
    resultsBuffer = [...results, ...resultsBuffer];
    opsBuffer = [...ops, ...opsBuffer];
    if (failureStreak === 0) {
      consoleLogger.warn(`Aggregator sync failed; will keep retrying: ${(err as Error).message}`);
    }
    failureStreak += 1;
    throw err;
  }
};

export const flushAggregator = (): Promise<void> => {
  flushChain = flushChain.catch(() => {}).then(doFlush);
  return flushChain;
};

const waitForUploads = async () => {
  while (uploadsInFlight.size > 0) {
    await Promise.allSettled([...uploadsInFlight]);
  }
};

const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T | undefined> =>
  Promise.race([
    p,
    new Promise<undefined>(resolve =>
      setTimeout(() => {
        consoleLogger.warn(`${label} timed out after ${ms}ms`);
        resolve(undefined);
      }, ms).unref(),
    ),
  ]);

const createScan = async (id: string, metadata: AggregatorScanMetadata) => {
  await callJson('POST', '/scans', { id, metadata });
};

export const registerAggregatorScan = async (metadata: AggregatorScanMetadata): Promise<string> => {
  const id = randomUUID();
  await createScan(id, metadata);
  scanId = id;
  startFlushTimer();
  return id;
};

export const fetchAggregatorScan = async (
  id: string,
): Promise<{ status: ScanStatus; metadata: AggregatorScanMetadata; urlsCrawled: UrlsCrawledLike | null }> => {
  if (!SCAN_ID_RE.test(id)) throw new Error(`Invalid scan id "${id}" — expected a UUID`);
  const res = await call('GET', `/scans/${id}`);
  return res.json();
};

export const attachToAggregatorScan = async (id: string): Promise<void> => {
  await callJson('PATCH', `/scans/${id}`, { status: 'running' });
  scanId = id;
  resuming = true;
  startFlushTimer();
};

export const trackUrlsCrawled = (urlsCrawled: UrlsCrawledLike): void => {
  trackedUrlsCrawled = urlsCrawled;
};

export const wrapDatasetForAggregator = (dataset: Dataset): Dataset => {
  if (!scanId || wrappedStorages.has(dataset)) return dataset;
  wrappedStorages.add(dataset);
  const originalPushData = dataset.pushData.bind(dataset);
  dataset.pushData = (async (data: unknown) => {
    await originalPushData(data as any);
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) resultsBuffer.push(JSON.stringify(item));
  }) as typeof dataset.pushData;
  return dataset;
};

// Headers can carry operator credentials and are recomputed per navigation anyway.
const serializeRequest = (request: Request): Record<string, unknown> => {
  const { id: _id, headers: _headers, ...rest } = JSON.parse(JSON.stringify(request));
  return rest;
};

const toRequest = (like: any): Request =>
  like instanceof Request ? like : new Request(typeof like === 'string' ? { url: like } : like);

export const wrapRequestQueueForAggregator = (queue: RequestQueue, queueName: string): RequestQueue => {
  if (!scanId || wrappedStorages.has(queue)) return queue;
  wrappedStorages.add(queue);

  const originalAddRequest = queue.addRequest.bind(queue);
  const originalAddRequests = queue.addRequests.bind(queue);
  const originalMarkHandled = queue.markRequestHandled.bind(queue);

  queue.addRequest = (async (requestLike: any, options?: any) => {
    if ('requestsFromUrl' in requestLike) return originalAddRequest(requestLike, options);
    const request = toRequest(requestLike);
    const info = await originalAddRequest(request, options);
    if (!info.wasAlreadyPresent) {
      opsBuffer.push({ queue: queueName, uniqueKey: info.uniqueKey, request: serializeRequest(request) });
    }
    return info;
  }) as typeof queue.addRequest;

  queue.addRequests = (async (requestsLike: any, options?: any) => {
    const requests: any[] = [];
    for await (const like of requestsLike) {
      requests.push(typeof like === 'object' && 'requestsFromUrl' in like ? like : toRequest(like));
    }
    const result = await originalAddRequests(requests, options);
    const byKey = new Map<string, Request>();
    for (const r of requests) if (r instanceof Request) byKey.set(r.uniqueKey, r);
    for (const info of result.processedRequests) {
      const request = byKey.get(info.uniqueKey);
      if (!info.wasAlreadyPresent && request) {
        opsBuffer.push({ queue: queueName, uniqueKey: info.uniqueKey, request: serializeRequest(request) });
      }
    }
    return result;
  }) as typeof queue.addRequests;

  queue.markRequestHandled = (async (request: Request) => {
    const info = await originalMarkHandled(request);
    opsBuffer.push({ queue: queueName, uniqueKey: request.uniqueKey, state: 'handled' });
    return info;
  }) as typeof queue.markRequestHandled;

  return queue;
};

const runUpload = async (relativePath: string, content: Buffer) => {
  try {
    await call('PUT', `/scans/${scanId}/files?path=${encodeURIComponent(relativePath)}`, content);
  } catch (err) {
    consoleLogger.warn(`Aggregator upload of ${relativePath} failed: ${(err as Error).message}`);
  }
};

// relativePath is relative to the scan's storage folder, e.g. elemScreenshots/html/<hash>.jpeg
export const uploadScanFile = (relativePath: string, content: Buffer): void => {
  if (!scanId) return;
  const posixPath = relativePath.split(path.sep).join('/');
  const start = async () => {
    while (uploadsInFlight.size >= UPLOAD_CONCURRENCY) {
      await new Promise<void>(resolve => uploadWaiters.push(resolve));
    }
    const p = runUpload(posixPath, content).finally(() => {
      uploadsInFlight.delete(p);
      uploadWaiters.shift()?.();
    });
    uploadsInFlight.add(p);
  };
  start();
};

export const setAggregatorStatus = async (status: ScanStatus): Promise<void> => {
  if (!scanId) return;
  await withTimeout(
    (async () => {
      await waitForUploads();
      await flushAggregator().catch(() => {});
      await callJson('PATCH', `/scans/${scanId}`, { status }, 1);
    })().catch(err => consoleLogger.warn(`Unable to update aggregator status: ${err.message}`)),
    FINALIZE_TIMEOUT_MS,
    'Aggregator finalize',
  );
};

export const syncAggregatorUrlsCrawled = async (urlsCrawled: UrlsCrawledLike, status?: ScanStatus) => {
  if (!scanId) return;
  trackUrlsCrawled(urlsCrawled);
  if (status) await setAggregatorStatus(status);
  else await flushAggregator().catch(() => {});
};

export const stopAggregator = async (status?: ScanStatus): Promise<void> => {
  if (!scanId) return;
  if (status) await setAggregatorStatus(status);
  else await withTimeout(flushAggregator().catch(() => {}), FINALIZE_TIMEOUT_MS, 'Aggregator flush');
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
  scanId = null;
};

const dedupeBy = <T>(list: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return list.filter(item => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const restoreFiles = async (storagePath: string): Promise<number> => {
  const res = await call('GET', `/scans/${scanId}/files`);
  const files: { path: string }[] = await res.json();
  const root = path.resolve(storagePath);
  let restored = 0;
  const queue = [...files];
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const dest = path.resolve(root, ...file.path.split('/'));
      if (!file.path.startsWith('elemScreenshots/') || !dest.startsWith(root + path.sep)) {
        consoleLogger.warn(`Skipping restore of unexpected file path: ${file.path}`);
        continue;
      }
      const body = await call('GET', `/scans/${scanId}/files?path=${encodeURIComponent(file.path)}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await body.arrayBuffer()));
      restored += 1;
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
  return restored;
};

/**
 * Rebuilds local Crawlee state from the aggregator before crawling resumes:
 * dataset results, urlsCrawled, request queues and screenshots. The three streams are
 * flushed independently, so a hard crash can leave them slightly out of step; results
 * are the source of truth for "scanned" and the queue is adjusted to match.
 */
export const restoreAggregatorScan = async (
  storagePath: string,
  urlsCrawled: UrlsCrawledLike,
): Promise<{ startedAt?: string }> => {
  if (!scanId || !resuming) return {};
  consoleLogger.info(`Restoring scan ${scanId} from aggregator...`);
  const scan = await fetchAggregatorScan(scanId);

  const dataset = await Dataset.open('crawlee');
  const resultPages: PageEntry[] = [];
  const resultIndex = new Map<string, PageEntry>();
  let batch: unknown[] = [];
  let resultCount = 0;
  for await (const item of ndjson(`/scans/${scanId}/results`)) {
    if (typeof item?.url === 'string') {
      const page = { url: item.url, actualUrl: item.actualUrl || item.url, pageTitle: item.pageTitle };
      resultPages.push(page);
      resultIndex.set(norm(page.url), page);
      resultIndex.set(norm(page.actualUrl), page);
    }
    batch.push(item);
    resultCount += 1;
    if (batch.length >= 100) {
      await dataset.pushData(batch as any);
      batch = [];
    }
  }
  if (batch.length) await dataset.pushData(batch as any);

  const saved = scan.urlsCrawled;
  if (saved) {
    for (const key of PAGE_LIST_KEYS) {
      if (key === 'scanned') continue;
      urlsCrawled[key].push(...dedupeBy(saved[key] ?? [], e => e.url));
    }
    for (const key of REDIRECT_LIST_KEYS) {
      urlsCrawled[key].push(...dedupeBy(saved[key] ?? [], e => `${e.fromUrl}\n${e.toUrl}`));
    }
  }

  // A page only counts as scanned if its result made it to the aggregator; anything else
  // (e.g. PDFs downloaded but not yet run through veraPDF) is rescanned.
  const matched = new Set<PageEntry>();
  const dropped = new Set<string>();
  for (const entry of dedupeBy(saved?.scanned ?? [], e => norm(e.url))) {
    const page = resultIndex.get(norm(entry.url)) ?? resultIndex.get(norm(entry.actualUrl));
    if (page && !matched.has(page)) {
      matched.add(page);
      urlsCrawled.scanned.push(entry);
    } else if (!page) {
      dropped.add(norm(entry.url));
    }
  }
  for (const page of resultPages) {
    if (!matched.has(page)) {
      matched.add(page);
      urlsCrawled.scanned.push(page);
    }
  }
  const scannedUrls = new Set<string>();
  for (const entry of urlsCrawled.scanned) {
    scannedUrls.add(norm(entry.url));
    scannedUrls.add(norm(entry.actualUrl));
  }
  const keptRedirects = urlsCrawled.scannedRedirects.filter(r => !dropped.has(norm(r.fromUrl)));
  urlsCrawled.scannedRedirects.splice(0, Infinity, ...keptRedirects);
  resumedScannedCount = urlsCrawled.scanned.length;

  const queues = new Map<string, Request[]>();
  const handledAt = new Date().toISOString();
  let pending = 0;
  for await (const row of ndjson(`/scans/${scanId}/requests`)) {
    if (!row.request) continue;
    const key = norm(String(row.request.url ?? ''));
    let handled = row.handled;
    if (scannedUrls.has(key)) handled = true;
    else if (dropped.has(key)) handled = false;
    if (!handled) pending += 1;
    const request = new Request({ ...row.request, ...(handled ? { handledAt } : {}) });
    if (!queues.has(row.queue)) queues.set(row.queue, []);
    queues.get(row.queue).push(request);
  }
  for (const [name, requests] of queues) {
    const queue = await RequestQueue.open(name);
    for (let i = 0; i < requests.length; i += 500) {
      await queue.addRequests(requests.slice(i, i + 500));
    }
  }

  const files = await restoreFiles(storagePath);

  consoleLogger.info(
    `Restored ${urlsCrawled.scanned.length} scanned pages (${resultCount} results), ` +
      `${pending} pending requests and ${files} screenshots.`,
  );
  console.log(
    `Restored ${urlsCrawled.scanned.length} scanned page(s) and ${pending} pending request(s) from aggregator.`,
  );
  return { startedAt: scan.metadata?.startedAt };
};
