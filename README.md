# FOS Complaints Tracker

Search-first analytics application for Financial Ombudsman decisions, built for MEMA Consultants.

## What changed in this cutover

- Dashboard now runs on `fos_decisions` only.
- Legacy dataset tables are retired by the cutover script after backup.
- UI is redesigned around:
  - global search
  - year and product drill-down
  - yearly insight summaries
  - full case slide-over detail
  - ingestion and data-quality diagnostics

## Core API routes

- `GET /api/fos/dashboard` - full dashboard snapshot (KPIs, trends, distributions, case list, filters, ingestion status)
- `GET /api/fos/analysis` - deep analysis snapshot (year/product matrix, firm benchmark, precedent/root-cause matrix, narratives)
- `GET /api/fos/overview` - top-level KPI overview
- `GET /api/fos/trends` - yearly trends, outcome split, and yearly insight cards
- `GET /api/fos/distribution/products` - product-level distribution
- `GET /api/fos/distribution/firms` - firm-level distribution
- `GET /api/fos/precedents` - precedent and root-cause frequencies
- `GET /api/fos/cases` - paginated case list with filters
- `GET /api/fos/cases/:caseId` - full case detail
- `GET /api/fos/ingestion-status` - ingestion status only
- `GET /api/fos/progress` - compatibility progress payload for old monitors
- `GET /api/fos/keepalive` - scheduled DB keepalive probe (cron)
- `GET /api/dashboard` - compatibility alias to FOS dashboard snapshot (same response shape + cache headers)
- Internal debug routes:
  - `GET /api/debug-data` (requires debug auth)
  - `GET /api/debug-products` (requires debug auth)

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Required env var:

- `DATABASE_URL` (PostgreSQL)

Optional DB runtime env vars:

- `DB_SSL_MODE` (`disable`, `require`, `verify-ca`, `verify-full`) to force TLS mode
- `DB_CONNECT_RETRIES` (default `3`) connection retry count for scripts/app DB calls
- `DB_RETRY_BASE_MS` (default `350`) initial retry delay
- `DB_RETRY_MAX_MS` (default `4000`) max retry delay
- `DEBUG_API_SECRET` (required for `/api/debug-*` endpoints, bearer token)
- `CRON_SECRET` (recommended in production for `/api/fos/keepalive`)

## Debug endpoint access

Both internal debug endpoints require:

`Authorization: Bearer <DEBUG_API_SECRET>`

Example:

```bash
curl -H "Authorization: Bearer $DEBUG_API_SECRET" \
  https://foscomplaints.memaconsultants.com/api/debug-data
```

If `DEBUG_API_SECRET` is missing, debug endpoints return `503`.

## Keepalive auth

`/api/fos/keepalive` enforces bearer auth only when `CRON_SECRET` is configured.

Recommended production header:

`Authorization: Bearer <CRON_SECRET>`

## Hetzner migration checks

1. Verify local and deploy env files target the same DB host:

```bash
npm run db:verify-targets
```

2. Probe connection stability (strict, fails if any attempt fails):

```bash
npm run db:probe-connectivity -- --attempts 10 --delay-ms 1000
```

3. Confirm schema/data health:

```bash
npm run db:check
```

## Database cutover flow

1. Check current table state:

```bash
npm run db:check
```

2. Run single maintenance-window cutover:

```bash
npm run db:cutover-fos
```

The cutover script does the following in one transaction:

- creates timestamped backup schema (`backup_fos_cutover_YYYYMMDD_HHMMSS`)
- copies legacy tables into that schema if they exist
- applies `db/migrations/20260219_fos_cutover.sql`
- drops legacy tables from `public`

3. Import parsed FOS decision corpus into `fos_decisions`:

```bash
npm run db:import-fos-parsed -- --batch-size 300
```

Optional flags:

- `--limit <n>` for partial import test
- `--no-resume` to ignore saved progress state
- `--state-file <path>` to override default state file
- `--include-full-text` to store full PDF text (off by default)

4. Add search/performance indexes (recommended after import):

```bash
npm run db:add-fos-search-indexes
npm run db:add-fos-performance-indexes
```

## Data quality runbook

1. Generate baseline coverage report:

```bash
npm run db:report-fos-quality
```

Optional report filters:

- `--year-from <yyyy>`
- `--year-to <yyyy>`
- `--sample-size <n>` for top-tag tables
- `--out <path>` custom report path

2. Execute canary enrichment pass:

```bash
npm run db:backfill-fos-enrichment:canary
```

3. Run full enrichment pass:

```bash
npm run db:backfill-fos-enrichment -- --batch-size 250 --report-file tmp/reports/fos-backfill-full-report.json
```

Optional flags:

- `--limit <n>` run subset only
- `--no-resume` ignore previous state
- `--state-file <path>` custom state location
- `--report-file <path>` writes enrichment confidence/source summary JSON

4. Re-run quality report and compare baseline vs post-run:

```bash
npm run db:report-fos-quality -- --out tmp/reports/fos-quality-post-backfill.json
```

## Notes

- The cutover script is destructive for legacy tables **after backup**.
- Keep the backup schema for the agreed retention window (default: 7 days).
