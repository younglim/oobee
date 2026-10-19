import { TextDecoder } from 'node:util';
import { request as playwrightRequest, type APIRequestContext, type APIResponse } from 'playwright';
import {
  createContext,
  getChecksSorted,
  computeScore,
  summarizeRequests,
  type CheckContext,
  type CheckResult,
  type FetchRecord,
  type ReportResult,
} from 'afdocs';
import {
  classifyUrlHost,
  getPlaywrightLaunchOptions,
  isInternalOrLoopbackUrl,
  isRefusedHostKind,
  makeHostKindCache,
} from '../../constants/common.js';
import { consoleLogger } from '../../logs.js';

type HttpRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  redirect?: 'follow' | 'manual';
};

const MAX_REDIRECTS = 10;
const RUN_DEADLINE_MS = Number(process.env.OOBEE_AGENT_DOCS_TIMEOUT_MS) || 40_000;
const AFDOCS_OPTIONS = {
  samplingStrategy: 'deterministic' as const,
  maxLinksToTest: 10,
  maxConcurrency: 3,
  requestDelay: 100,
  requestTimeout: 10_000,
};

// One afdocs run per origin per scan: it is a site-level audit, not a per-page one.
const runsByOrigin = new Map<string, Promise<string>>();
const runStates = new Map<string, { message: string | undefined }>();
const reportedOrigins = new Set<string>();

const decode = (buf: Buffer, contentType: string): string => {
  const charset = /charset=["']?([^;"'\s]+)/i.exec(contentType)?.[1];
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(buf);
  } catch {
    return new TextDecoder().decode(buf);
  }
};

const toHeaders = (resp: APIResponse): Headers => {
  const headers = new Headers();
  for (const { name, value } of resp.headersArray()) {
    try {
      headers.append(name, value);
    } catch {
      // Header values Fetch's Headers rejects (e.g. raw non-ASCII) are dropped.
    }
  }
  return headers;
};

const isBlockedStatus = (status: number, retryAfter: string | null) =>
  status === 403 || status === 503 || (status === 429 && !retryAfter);

// afdocs' own client uses bare fetch, which would bypass oobee's proxy /
// Family DNS, TLS policy and egress guard. Route every request through a
// Playwright request context instead and follow redirects hop by hop so
// each hop is checked against the entry-pinned egress policy.
const createGuardedHttpClient = (
  api: APIRequestContext,
  ctx: CheckContext,
  entryIsInternal: boolean,
  isExpired: () => boolean,
) => {
  const hostKinds = makeHostKindCache();
  let active = 0;
  let lastRequestAt = 0;
  let seq = 0;

  const waitForSlot = async () => {
    while (active >= AFDOCS_OPTIONS.maxConcurrency) {
      await new Promise(r => setTimeout(r, 50));
    }
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < AFDOCS_OPTIONS.requestDelay) {
      await new Promise(r => setTimeout(r, AFDOCS_OPTIONS.requestDelay - elapsed));
    }
  };

  const assertAllowed = async (target: string) => {
    if (isExpired()) throw new Error('Agent-friendly docs check deadline exceeded');
    const kind = await hostKinds(target);
    if (kind === 'skip' || isRefusedHostKind(kind, entryIsInternal)) {
      throw new Error(`Refused request to ${target}`);
    }
  };

  return {
    async fetch(url: string, opts: HttpRequestOptions = {}) {
      await waitForSlot();
      active++;
      lastRequestAt = Date.now();
      try {
        let current = url;
        let resp: APIResponse;
        let hops = 0;
        for (;;) {
          await assertAllowed(current);
          try {
            resp = await api.fetch(current, {
              method: opts.method ?? 'GET',
              headers: opts.headers,
              maxRedirects: 0,
              failOnStatusCode: false,
              timeout: AFDOCS_OPTIONS.requestTimeout,
            });
          } catch (err) {
            ctx.fetchLedger?.onRecord({
              seq: ++seq,
              url,
              status: null,
              outcome: 'fetch-error',
              error: err instanceof Error ? err.message : String(err),
            });
            throw err;
          }
          const location = resp.headers().location;
          const isRedirect = resp.status() >= 300 && resp.status() < 400 && location;
          if (!isRedirect || opts.redirect === 'manual') break;
          if (++hops > MAX_REDIRECTS) throw new Error(`Too many redirects for ${url}`);
          await resp.dispose();
          current = new URL(location, current).toString();
        }

        const headers = toHeaders(resp);
        const contentType = headers.get('content-type') ?? '';
        const retryAfter = headers.get('retry-after');
        const record: FetchRecord = { seq: ++seq, url, status: resp.status(), outcome: 'ok' };
        if (isBlockedStatus(resp.status(), retryAfter)) record.blocked = true;
        if (resp.status() === 429 && retryAfter) record.retryAfter = retryAfter;
        ctx.fetchLedger?.onRecord(record);

        let pending: Promise<{ text: string; bytes: number }> | undefined;
        const readBody = () => {
          pending ??= resp.body().then(
            buf => {
              const text = decode(buf, contentType);
              ctx.fetchLedger?.onBody(record, text, contentType);
              return { text, bytes: buf.byteLength };
            },
            err => {
              record.outcome = 'body-error';
              record.error = err instanceof Error ? err.message : String(err);
              throw err;
            },
          );
          return pending;
        };
        // Denied HTML is inspected for a bot-challenge signature even when the
        // caller only reads the status, as afdocs' own client does.
        if (record.blocked && /text\/html/i.test(contentType)) await readBody().catch(() => undefined);

        return {
          ok: resp.ok(),
          status: resp.status(),
          statusText: resp.statusText(),
          headers,
          url: resp.url(),
          redirected: hops > 0,
          text: () => readBody().then(b => b.text),
          body: readBody,
        };
      } finally {
        active--;
      }
    },
  };
};

// afdocs' runner loop, minus its http client: same order and dependency-skip rules.
const normalizeDeps = (deps: string[][] | string[]): string[][] =>
  deps.length === 0 ? [] : typeof deps[0] === 'string' ? (deps as string[]).map(d => [d]) : (deps as string[][]);

const runAllChecks = async (ctx: CheckContext): Promise<CheckResult[]> => {
  const results: CheckResult[] = [];
  for (const check of getChecksSorted()) {
    const groups = normalizeDeps(check.dependsOn);
    const anyDepRan = groups.some(g => g.some(id => ctx.previousResults.has(id)));
    const depsMet = groups.every(g =>
      g.some(id => ['pass', 'warn'].includes(ctx.previousResults.get(id)?.status ?? '')),
    );
    let result: CheckResult;
    if (groups.length > 0 && anyDepRan && !depsMet) {
      result = {
        id: check.id,
        category: check.category,
        status: 'skip',
        message: 'Skipped: dependency check did not pass',
      };
    } else {
      if (ctx.fetchLedger) ctx.fetchLedger.currentCheckId = check.id;
      try {
        result = await check.run(ctx);
      } catch (err) {
        result = {
          id: check.id,
          category: check.category,
          status: 'error',
          message: `Check error: ${err instanceof Error ? err.message : String(err)}`,
        };
      } finally {
        if (ctx.fetchLedger) ctx.fetchLedger.currentCheckId = undefined;
      }
    }
    results.push(result);
    ctx.previousResults.set(check.id, result);
  }
  return results;
};

// axe message templates are doT templates; keep afdocs text from being parsed as one.
const sanitise = (s: string) => s.replace(/\s+/g, ' ').replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }').trim();

export const formatAgentDocsMessage = (
  score: ReturnType<typeof computeScore>,
  results: CheckResult[],
): string => {
  const descriptions = new Map(getChecksSorted().map(c => [c.id, c.description]));
  const failing = results
    .filter(r => (r.status === 'fail' || r.status === 'warn') && score.resolutions[r.id])
    .sort((a, b) => (score.checkScores[b.id]?.maxScore ?? 0) - (score.checkScores[a.id]?.maxScore ?? 0));
  if (failing.length === 0) return '';
  const lines = [`Agent-friendly docs score is ${score.overall}/100 (grade ${score.grade}).`];
  if (score.cap) lines.push(`Score capped at ${score.cap.cap}: ${sanitise(score.cap.reason)}`);
  for (const r of failing) {
    const label = descriptions.get(r.id) ?? r.id;
    lines.push(`${r.status === 'fail' ? 'Fail' : 'Warn'} (${r.id}) ${sanitise(label)}: ${sanitise(score.resolutions[r.id])}`);
  }
  return lines.join('\n  ');
};

const runForOrigin = async (origin: string): Promise<string> => {
  const entryKind = await classifyUrlHost(origin);
  const entryIsInternal = await isInternalOrLoopbackUrl(origin);
  if (entryKind === 'skip' || isRefusedHostKind(entryKind, entryIsInternal)) return '';

  const { proxy } = getPlaywrightLaunchOptions();
  const ignoreHTTPSErrors = ['1', 'true', 'yes'].includes(
    String(process.env.OOBEE_ALLOW_INSECURE_TLS || '').toLowerCase(),
  );
  // Deliberately anonymous: no operator headers, credentials or cookies, so the
  // result reflects what an AI agent can reach and no secret follows llms.txt
  // links off-site.
  const api = await playwrightRequest.newContext({ proxy, ignoreHTTPSErrors });
  const deadline = Date.now() + RUN_DEADLINE_MS;
  try {
    const ctx = createContext(origin, AFDOCS_OPTIONS);
    ctx.http = createGuardedHttpClient(api, ctx, entryIsInternal, () => Date.now() > deadline);
    const results = await runAllChecks(ctx);
    const report: ReportResult = {
      url: origin,
      timestamp: new Date().toISOString(),
      specUrl: '',
      results,
      summary: {
        total: results.length,
        pass: results.filter(r => r.status === 'pass').length,
        warn: results.filter(r => r.status === 'warn').length,
        fail: results.filter(r => r.status === 'fail').length,
        skip: results.filter(r => r.status === 'skip').length,
        error: results.filter(r => r.status === 'error').length,
      },
      samplingStrategy: ctx.options.samplingStrategy,
      ...(ctx._sampledPages && { testedPages: ctx._sampledPages.urls.length }),
      ...(ctx.fetchLedger && { requestSummary: summarizeRequests(ctx.fetchLedger.records) }),
    };
    if (Date.now() > deadline) {
      consoleLogger.warn(`[agent-docs] ${origin}: run exceeded ${RUN_DEADLINE_MS}ms; result not reported`);
      return '';
    }
    const score = computeScore(report);
    consoleLogger.info(`[agent-docs] ${origin}: ${score.overall}/100 (${score.grade})`);
    return formatAgentDocsMessage(score, results);
  } finally {
    await api.dispose().catch(() => undefined);
  }
};

// Deadline plus one in-flight request timeout: the first page on an origin
// waits out the whole run, inside Crawlee's 90s page-handler budget.
const FIRST_PAGE_WAIT_MS = RUN_DEADLINE_MS + AFDOCS_OPTIONS.requestTimeout + 5_000;

// Returns the site-level issue message to exactly one page per origin: the
// first page scanned after the run finishes. '' for every other page.
export const getAgentDocsFlag = async (pageUrl: string): Promise<string> => {
  let origin: string;
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    origin = u.origin;
  } catch {
    return '';
  }
  let run = runsByOrigin.get(origin);
  const isFirst = !run;
  if (!run) {
    const state = { message: undefined as string | undefined };
    run = runForOrigin(origin)
      .catch(err => {
        consoleLogger.warn(`[agent-docs] ${origin}: ${err instanceof Error ? err.message : String(err)}`);
        return '';
      })
      .then(m => (state.message = m));
    runsByOrigin.set(origin, run);
    runStates.set(origin, state);
  }
  const state = runStates.get(origin)!;
  if (state.message === undefined) {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      run,
      new Promise(r => {
        timer = setTimeout(r, isFirst ? FIRST_PAGE_WAIT_MS : 0);
      }),
    ]);
    clearTimeout(timer);
  }
  if (state.message === undefined || reportedOrigins.has(origin)) return '';
  reportedOrigins.add(origin);
  return state.message;
};
