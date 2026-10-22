#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.AGGREGATOR_PORT || process.env.PORT || 7777);
const HOST = process.env.AGGREGATOR_HOST || '127.0.0.1';
const DB_PATH = path.resolve(process.env.AGGREGATOR_DB || path.join(import.meta.dirname, 'data', 'aggregator.sqlite'));
const TOKEN = process.env.AGGREGATOR_TOKEN || '';
const MAX_BODY_BYTES = Number(process.env.AGGREGATOR_MAX_BODY_MB || 100) * 1024 * 1024;
const PAGE_SIZE = 500;

const SCAN_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['running', 'crawled', 'completed', 'interrupted']);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    metadata TEXT NOT NULL,
    urls_crawled TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS results (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    url TEXT,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS results_by_scan ON results(scan_id, seq);
  CREATE TABLE IF NOT EXISTS requests (
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    queue TEXT NOT NULL,
    unique_key TEXT NOT NULL,
    data TEXT,
    handled INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scan_id, queue, unique_key)
  );
  CREATE TABLE IF NOT EXISTS files (
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content BLOB NOT NULL,
    size INTEGER NOT NULL,
    PRIMARY KEY (scan_id, path)
  );
`);

const stmt = {
  insertScan: db.prepare(
    'INSERT INTO scans (id, status, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ),
  getScan: db.prepare('SELECT * FROM scans WHERE id = ?'),
  listScans: db.prepare(
    'SELECT id, status, metadata, created_at, updated_at FROM scans ORDER BY created_at DESC',
  ),
  setStatus: db.prepare('UPDATE scans SET status = ?, updated_at = ? WHERE id = ?'),
  setUrlsCrawled: db.prepare('UPDATE scans SET urls_crawled = ?, updated_at = ? WHERE id = ?'),
  touch: db.prepare('UPDATE scans SET updated_at = ? WHERE id = ?'),
  deleteScan: db.prepare('DELETE FROM scans WHERE id = ?'),
  insertResult: db.prepare('INSERT INTO results (scan_id, url, data) VALUES (?, ?, ?)'),
  pageResults: db.prepare(
    'SELECT seq, data FROM results WHERE scan_id = ? AND seq > ? ORDER BY seq LIMIT ?',
  ),
  upsertRequest: db.prepare(`
    INSERT INTO requests (scan_id, queue, unique_key, data, handled) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (scan_id, queue, unique_key) DO UPDATE SET data = excluded.data
  `),
  setRequestHandled: db.prepare(`
    INSERT INTO requests (scan_id, queue, unique_key, data, handled) VALUES (?, ?, ?, NULL, ?)
    ON CONFLICT (scan_id, queue, unique_key) DO UPDATE SET handled = excluded.handled
  `),
  pageRequests: db.prepare(`
    SELECT rowid, queue, unique_key, data, handled FROM requests
    WHERE scan_id = ? AND rowid > ? ORDER BY rowid LIMIT ?
  `),
  upsertFile: db.prepare(`
    INSERT INTO files (scan_id, path, content, size) VALUES (?, ?, ?, ?)
    ON CONFLICT (scan_id, path) DO UPDATE SET content = excluded.content, size = excluded.size
  `),
  listFiles: db.prepare('SELECT path, size FROM files WHERE scan_id = ? ORDER BY path'),
  getFile: db.prepare('SELECT content FROM files WHERE scan_id = ? AND path = ?'),
  counts: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM results WHERE scan_id = ?1) AS results,
      (SELECT COUNT(*) FROM requests WHERE scan_id = ?1) AS requests,
      (SELECT COUNT(*) FROM requests WHERE scan_id = ?1 AND handled = 1) AS handledRequests,
      (SELECT COUNT(*) FROM files WHERE scan_id = ?1) AS files
  `),
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const now = () => new Date().toISOString();

const inTransaction = fn => {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

const isAuthorized = req => {
  if (!TOKEN) return true;
  const header = req.headers.authorization || '';
  const expected = Buffer.from(`Bearer ${TOKEN}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const readBody = req =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, `Body exceeds ${MAX_BODY_BYTES} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const readJson = async req => {
  const body = await readBody(req);
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
};

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
};

const sendEmpty = res => {
  res.writeHead(204);
  res.end();
};

const writeChunk = (res, chunk) =>
  res.write(chunk) ? Promise.resolve() : new Promise(resolve => res.once('drain', resolve));

const streamNdjson = async (res, fetchPage) => {
  res.writeHead(200, { 'content-type': 'application/x-ndjson' });
  let cursor = 0;
  for (;;) {
    const rows = fetchPage(cursor);
    if (rows.length === 0) break;
    for (const { line } of rows) await writeChunk(res, `${line}\n`);
    cursor = rows[rows.length - 1].cursor;
    if (res.destroyed) return;
  }
  res.end();
};

// Relative POSIX path with no traversal; mirrors what oobee writes under its storage folder.
const validateFilePath = p => {
  if (typeof p !== 'string' || p.length === 0 || p.length > 1024) return false;
  if (p.includes('\\') || p.includes('\0') || p.startsWith('/')) return false;
  return p.split('/').every(seg => seg !== '' && seg !== '.' && seg !== '..');
};

const requireScan = id => {
  if (!SCAN_ID_RE.test(id)) throw new HttpError(400, 'Scan id must be a UUID');
  const scan = stmt.getScan.get(id);
  if (!scan) throw new HttpError(404, `Scan ${id} not found`);
  return scan;
};

const scanSummary = row => ({
  id: row.id,
  status: row.status,
  metadata: JSON.parse(row.metadata),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const handlers = {
  async createScan(req, res) {
    const { id, metadata } = await readJson(req);
    if (!SCAN_ID_RE.test(id || '')) throw new HttpError(400, 'Scan id must be a UUID');
    if (!metadata || typeof metadata !== 'object') throw new HttpError(400, 'metadata object is required');
    if (stmt.getScan.get(id)) throw new HttpError(409, `Scan ${id} already exists`);
    const ts = now();
    stmt.insertScan.run(id, 'running', JSON.stringify(metadata), ts, ts);
    sendJson(res, 201, { id, status: 'running', createdAt: ts });
  },

  listScans(req, res) {
    sendJson(res, 200, stmt.listScans.all().map(scanSummary));
  },

  getScan(req, res, id) {
    const row = requireScan(id);
    sendJson(res, 200, {
      ...scanSummary(row),
      urlsCrawled: row.urls_crawled ? JSON.parse(row.urls_crawled) : null,
      counts: { ...stmt.counts.get(id) },
    });
  },

  async patchScan(req, res, id) {
    requireScan(id);
    const { status, urlsCrawled } = await readJson(req);
    if (status !== undefined && !STATUSES.has(status)) {
      throw new HttpError(400, `status must be one of ${[...STATUSES].join(', ')}`);
    }
    const ts = now();
    inTransaction(() => {
      if (status !== undefined) stmt.setStatus.run(status, ts, id);
      if (urlsCrawled !== undefined) stmt.setUrlsCrawled.run(JSON.stringify(urlsCrawled), ts, id);
    });
    sendEmpty(res);
  },

  deleteScan(req, res, id) {
    requireScan(id);
    stmt.deleteScan.run(id);
    sendEmpty(res);
  },

  // Results, request-queue ops and the urlsCrawled snapshot are applied in one transaction
  // so a crash can never persist one without the others.
  async sync(req, res, id) {
    requireScan(id);
    const { items = [], ops = [], urlsCrawled } = await readJson(req);
    if (!Array.isArray(items) || !Array.isArray(ops)) {
      throw new HttpError(400, 'items and ops must be arrays');
    }
    for (const op of ops) {
      const { queue, uniqueKey, state } = op || {};
      if (typeof queue !== 'string' || typeof uniqueKey !== 'string') {
        throw new HttpError(400, 'Each op needs string queue and uniqueKey');
      }
      if (state !== undefined && state !== 'handled' && state !== 'pending') {
        throw new HttpError(400, 'op.state must be "handled" or "pending"');
      }
    }
    const ts = now();
    inTransaction(() => {
      for (const item of items) {
        const url = item && typeof item.url === 'string' ? item.url : null;
        stmt.insertResult.run(id, url, JSON.stringify(item));
      }
      for (const { queue, uniqueKey, request, state } of ops) {
        if (request) stmt.upsertRequest.run(id, queue, uniqueKey, JSON.stringify(request), 0);
        if (state) stmt.setRequestHandled.run(id, queue, uniqueKey, state === 'handled' ? 1 : 0);
      }
      if (urlsCrawled !== undefined) stmt.setUrlsCrawled.run(JSON.stringify(urlsCrawled), ts, id);
      else stmt.touch.run(ts, id);
    });
    sendEmpty(res);
  },

  async getResults(req, res, id) {
    requireScan(id);
    await streamNdjson(res, cursor =>
      stmt.pageResults.all(id, cursor, PAGE_SIZE).map(r => ({ cursor: r.seq, line: r.data })),
    );
  },

  async getRequests(req, res, id) {
    requireScan(id);
    await streamNdjson(res, cursor =>
      stmt.pageRequests.all(id, cursor, PAGE_SIZE).map(r => ({
        cursor: r.rowid,
        line: JSON.stringify({
          queue: r.queue,
          uniqueKey: r.unique_key,
          request: r.data ? JSON.parse(r.data) : null,
          handled: r.handled === 1,
        }),
      })),
    );
  },

  async putFile(req, res, id, filePath) {
    requireScan(id);
    if (!validateFilePath(filePath)) throw new HttpError(400, 'Invalid file path');
    const content = await readBody(req);
    stmt.upsertFile.run(id, filePath, content, content.length);
    sendEmpty(res);
  },

  listFiles(req, res, id) {
    requireScan(id);
    sendJson(res, 200, stmt.listFiles.all(id).map(f => ({ path: f.path, size: f.size })));
  },

  getFile(req, res, id, filePath) {
    requireScan(id);
    if (!validateFilePath(filePath)) throw new HttpError(400, 'Invalid file path');
    const row = stmt.getFile.get(id, filePath);
    if (!row) throw new HttpError(404, 'File not found');
    const buf = Buffer.from(row.content);
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': buf.length });
    res.end(buf);
  },
};

const route = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  const { method } = req;

  if (method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true });
  if (!isAuthorized(req)) throw new HttpError(401, 'Unauthorized');
  if (parts[0] !== 'scans') throw new HttpError(404, 'Not found');

  const [, id, sub] = parts;
  if (parts.length === 1) {
    if (method === 'POST') return handlers.createScan(req, res);
    if (method === 'GET') return handlers.listScans(req, res);
  } else if (parts.length === 2) {
    if (method === 'GET') return handlers.getScan(req, res, id);
    if (method === 'PATCH') return handlers.patchScan(req, res, id);
    if (method === 'DELETE') return handlers.deleteScan(req, res, id);
  } else if (parts.length === 3) {
    if (sub === 'sync' && method === 'POST') return handlers.sync(req, res, id);
    if (sub === 'results' && method === 'GET') return handlers.getResults(req, res, id);
    if (sub === 'requests' && method === 'GET') return handlers.getRequests(req, res, id);
    if (sub === 'files' && method === 'GET') {
      const filePath = url.searchParams.get('path');
      return filePath === null
        ? handlers.listFiles(req, res, id)
        : handlers.getFile(req, res, id, filePath);
    }
    if (sub === 'files' && method === 'PUT') {
      return handlers.putFile(req, res, id, url.searchParams.get('path'));
    }
  }
  throw new HttpError(parts.length <= 3 ? 405 : 404, 'Unsupported route');
};

const server = http.createServer((req, res) => {
  route(req, res).catch(err => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(`${req.method} ${req.url}:`, err);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    sendJson(res, status, { error: err.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Oobee aggregator listening on http://${HOST}:${PORT} (db: ${DB_PATH})`);
  if (!TOKEN && HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
    console.warn('Warning: AGGREGATOR_TOKEN is not set and the server is not bound to loopback.');
  }
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
