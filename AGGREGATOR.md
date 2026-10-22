# Oobee Aggregator

The aggregator is a small, standalone Node server that keeps a durable copy of an Oobee CLI scan while it runs. If the scan crashes, is killed, or is interrupted, it can be resumed later from where it left off with `--resume <scan-id>`. After resuming, Oobee generates its normal report.

It is optional. Without `OOBEE_AGGREGATOR_URL`, Oobee behaves exactly as before.

## Architecture

```
┌──────────────────────────── Oobee CLI ────────────────────────────┐
│                                                                   │
│  cli.ts ── register / attach ─────────────┐                       │
│                                           │                       │
│  Crawlee Dataset.pushData ──┐             │                       │
│  RequestQueue add/handled ──┼─► buffer ──►│ POST /scans/:id/sync  │
│  urlsCrawled snapshot ──────┘  (every 2s) │  (one transaction)    │
│                                           │                       │
│  screenshots (html/pdf) ── PUT /scans/:id/files ─┐                │
│                                                  │                │
│  combine.ts ── restore on --resume ◄── GET results/requests/files │
└──────────────────────────────────────────────────┼────────────────┘
                                                   ▼
                          ┌────────── aggregator/server.mjs ──────────┐
                          │  node:http + node:sqlite (WAL), no deps   │
                          │  scans · results · requests · files       │
                          └───────────────────────────────────────────┘
```

### Components

| Piece | Location | Role |
| --- | --- | --- |
| Aggregator server | [aggregator/server.mjs](aggregator/server.mjs) | HTTP API backed by a single SQLite file |
| Client | [src/services/aggregatorClient.ts](src/services/aggregatorClient.ts) | Registers scans, streams data, restores state |
| Storage hooks | `createCrawleeSubFolders` in [src/crawlers/commonCrawlerFunc.ts](src/crawlers/commonCrawlerFunc.ts) | Wraps the Crawlee `Dataset` and `RequestQueue` |
| Screenshot hooks | [src/screenshotFunc/htmlScreenshotFunc.ts](src/screenshotFunc/htmlScreenshotFunc.ts), [src/screenshotFunc/pdfScreenshotFunc.ts](src/screenshotFunc/pdfScreenshotFunc.ts) | Upload each screenshot as it is written |
| Lifecycle | [src/cli.ts](src/cli.ts), [src/combine.ts](src/combine.ts), `cleanUpAndExit` in [src/utils.ts](src/utils.ts) | Register/resume, restore, set final status |

### What is stored

The SQLite database has four tables:

- **scans**: scan ID (UUID), status, metadata, and the latest `urlsCrawled` snapshot. The metadata holds the Oobee version, the original CLI answers, scan type, entry URL, `randomToken` and start time.
- **results**: every item Oobee pushed to its Crawlee dataset, i.e. the per-page axe results used to build the report.
- **requests**: the Crawlee request queue for each queue. Each row holds the serialized request and whether it has been handled. Request headers are stripped because they can carry credentials.
- **files**: screenshots stored as BLOBs (`elemScreenshots/html/*.jpeg`, `elemScreenshots/pdf/*.png`).

Deleting a scan cascades to its results, requests and files.

### Data flow during a scan

1. **Start.** After the URL connectivity check passes, `cli.ts` creates a UUID and registers the scan with `POST /scans`. The CLI prints the ID and the resume command. In `OOBEE_VERBOSE` mode it also sends `{type: 'aggregatorScanId'}` over IPC.
2. **Crawl.** The wrapped `pushData`, `addRequest(s)` and `markRequestHandled` calls write to Crawlee as usual and add an entry to an in-memory buffer. Every 2 seconds the buffer is flushed to `POST /scans/:id/sync`.
   - The server applies results, queue changes and the `urlsCrawled` snapshot in one transaction, so a crash can never save one without the others.
   - Large backlogs are sent in chunks of at most 8 MB. Failed flushes are kept in the buffer and retried.
3. **Screenshots.** These are uploaded in the background, at most 6 at a time.
4. **End.** After crawling, the status becomes `crawled`. After report generation it becomes `completed`, or `interrupted` if a shutdown signal was received. The final flush and status update are capped at 30 seconds, so an unreachable aggregator cannot hang the CLI.
5. **Abnormal exit.** `cleanUpAndExit` with a non-zero code (Ctrl+C, SIGTERM, fatal errors) flushes what it can and marks the scan `interrupted`. A hard kill (`kill -9`, OOM, power loss) leaves the status at `running`. Everything flushed up to about 2 seconds before the crash is still available.

### Resume flow

`--resume <uuid>`:

1. Fetches the scan from `GET /scans/:id` and reuses the saved CLI answers as the scan options. No other flags are needed.
2. Runs the usual `prepareData` and connectivity check, then sets the status back to `running`.
3. Before crawling, `restoreAggregatorScan` rebuilds local Crawlee state in the new storage folder:
   - Streams all results back into the `crawlee` dataset.
   - Restores the `urlsCrawled` lists. A page only counts as scanned if its result reached the aggregator. Pages recorded as scanned without a result (e.g. a PDF downloaded but not yet checked by veraPDF) are scanned again, and any redirects recorded for them are dropped.
   - Rebuilds each request queue. Handled requests are re-added with `handledAt` set, so Crawlee skips them and only pending requests are crawled.
   - Downloads screenshots into `elemScreenshots/`. Only paths under that folder are accepted.
4. The original `startedAt` is kept as the scan start time.
5. Restored pages count against the `-p/--maxpages` budget. The sitemap phase also skips URLs that were already scanned.
6. Crawling continues. New data keeps going to the same aggregator scan, and the final report covers all pages from both runs.

A finished (`completed`) scan can also be resumed. It restores everything, finds nothing pending, and regenerates the report.

### Limitations

- A resumed scan gets a new local results folder name. The aggregator scan ID stays the same.
- On a resumed website scan, the click-through link discovery is not re-run for pages restored from the earlier run.
- Resume of custom-flow and local-file scans has not been specifically tested.
- The aggregator is a single process with a single SQLite file. Point one scanner, or a few, at it rather than a large fleet.

## Running the aggregator

Requires Node.js **22.13 or newer** for `node:sqlite`. It has no npm dependencies.

```sh
cd aggregator
npm start                # or: node server.mjs
```

Output:

```
Oobee aggregator listening on http://127.0.0.1:7777 (db: .../aggregator/data/aggregator.sqlite)
```

### Server environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `AGGREGATOR_PORT` (or `PORT`) | `7777` | Listen port |
| `AGGREGATOR_HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` to accept remote scanners |
| `AGGREGATOR_DB` | `aggregator/data/aggregator.sqlite` | SQLite file path. The directory is created if missing |
| `AGGREGATOR_TOKEN` | *(unset)* | If set, every request except `/health` must send `Authorization: Bearer <token>` |
| `AGGREGATOR_MAX_BODY_MB` | `100` | Maximum request body size |

### Remote / shared deployment

```sh
AGGREGATOR_HOST=0.0.0.0 \
AGGREGATOR_TOKEN="$(openssl rand -hex 32)" \
AGGREGATOR_DB=/var/lib/oobee-aggregator/aggregator.sqlite \
node aggregator/server.mjs
```

- Always set `AGGREGATOR_TOKEN` when binding to a non-loopback address. The server prints a warning if you don't.
- Put it behind TLS (a reverse proxy such as nginx or Caddy) when it is reached over an untrusted network. Stored results include page URLs, HTML snippets and screenshots.
- Back up the database by copying the `.sqlite` file while the server is stopped, or use `sqlite3 aggregator.sqlite ".backup backup.sqlite"` while it is running.

Health check: `curl http://127.0.0.1:7777/health` returns `{"ok":true}`.

## Running scans

### New scan

```sh
export OOBEE_AGGREGATOR_URL=http://127.0.0.1:7777
# export OOBEE_AGGREGATOR_TOKEN=<token>   # if the server requires one

npm run cli -- -c website -u https://example.com -p 200 -k "Jane Doe:jane@example.com"
```

At the start of the scan the CLI prints:

```
Aggregator scan ID: a67f4c81-c94e-46ab-bf25-67bccd6ad1d4
Resume with: --resume a67f4c81-c94e-46ab-bf25-67bccd6ad1d4
```

If `OOBEE_AGGREGATOR_URL` is set but the aggregator cannot be reached, the CLI exits rather than running a scan that can't be resumed.

### Resume a scan

```sh
export OOBEE_AGGREGATOR_URL=http://127.0.0.1:7777
npm run cli -- --resume a67f4c81-c94e-46ab-bf25-67bccd6ad1d4
```

`-c`, `-u` and `-k` are not required with `--resume`. Any other flags passed alongside `--resume` are ignored in favour of the saved settings.

The CLI logs:

```
Restored 3 scanned page(s) and 38 pending request(s) from aggregator.
```

The report is then generated as usual under `results/`.

### Client environment variables

| Variable | Description |
| --- | --- |
| `OOBEE_AGGREGATOR_URL` | Base URL of the aggregator. Enables the feature |
| `OOBEE_AGGREGATOR_TOKEN` | Bearer token, if the server has `AGGREGATOR_TOKEN` set |

## HTTP API

All routes except `/health` require the bearer token when `AGGREGATOR_TOKEN` is set. Scan IDs must be UUIDs.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/scans` | Create a scan: `{id, metadata}` → `201`, or `409` if it exists |
| `GET` | `/scans` | List scans (summary and metadata) |
| `GET` | `/scans/:id` | Scan metadata, status, `urlsCrawled` and row counts |
| `PATCH` | `/scans/:id` | `{status?, urlsCrawled?}`. Status is one of `running`, `crawled`, `completed`, `interrupted` |
| `DELETE` | `/scans/:id` | Delete a scan and all its data |
| `POST` | `/scans/:id/sync` | `{items?, ops?, urlsCrawled?}` applied in one transaction. `ops` entries are `{queue, uniqueKey, request?, state?: 'handled'\|'pending'}` |
| `GET` | `/scans/:id/results` | NDJSON stream of results, in insertion order |
| `GET` | `/scans/:id/requests` | NDJSON stream of `{queue, uniqueKey, request, handled}` |
| `GET` | `/scans/:id/files` | List of stored files: `[{path, size}]` |
| `GET` | `/scans/:id/files?path=<p>` | Raw file content |
| `PUT` | `/scans/:id/files?path=<p>` | Upload or replace a file (raw body). Path must be relative POSIX with no `..` |

Useful one-liners:

```sh
# List scans and their status
curl -s localhost:7777/scans | jq '.[] | {id, status, createdAt, entryUrl: .metadata.entryUrl}'

# Progress of one scan
curl -s localhost:7777/scans/<id> | jq '{status, counts}'

# Delete a scan
curl -X DELETE localhost:7777/scans/<id>
```
