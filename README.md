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
- `DB_POOL_MAX` (default `8`) max pool size
- `DB_QUERY_TIMEOUT_MS` (default `15000`) per-query statement timeout
- `DB_IDLE_IN_TX_TIMEOUT_MS` (default `10000`) idle transaction timeout
- `DB_MAX_USES` (default `7500`) recycle long-lived connections
- `DB_APPLICATION_NAME` (default `fos-complaints-tracker`) Postgres application name
- `DB_CONNECT_RETRIES` (default `3` for scripts, `2` for app runtime) connection retry count
- `DB_RETRY_BASE_MS` (default `350` for scripts, `200` for app runtime) initial retry delay
- `DB_RETRY_MAX_MS` (default `4000` for scripts, `2000` for app runtime) max retry delay
- `DEBUG_API_SECRET` (required for `/api/debug-*` endpoints, bearer token)
- `CRON_SECRET` (recommended in production for `/api/fos/keepalive`)

## Local auth users

In non-production, the app bootstraps local workspace users automatically:

- `viewer@local.test` / `ViewerPass123!`
- `operator@local.test` / `OperatorPass123!`
- `reviewer@local.test` / `ReviewerPass123!`
- `manager@local.test` / `ManagerPass123!`
- `admin@local.test` / `AdminPass123!`

Override these with `APP_BOOTSTRAP_USERS_JSON` if needed.

## Rate limiting and route metrics

Heavier routes now use Postgres-backed fixed-window limits:

- `/api/fos/board-pack` preview
- `/api/fos/board-pack/generate`
- `/api/complaints/import`
- `/api/complaints/export`

When a limit is hit, the API returns `429` with `Retry-After`.

Operational route timings are logged as structured lines prefixed with:

```text
[route-metric]
```

Watch these in local logs or Vercel runtime logs to trace:

- route
- status
- duration
- actor
- request detail such as template key or export scope

## Public insights section

SEO-friendly public analysis pages are available under:

- `/insights`
- `/insights/years`
- `/insights/firms`
- `/insights/products`
- `/insights/types`

These pages are generated from the same FOS analytics corpus and publish public year, firm, product, and complaint-theme analysis without requiring sign-in.

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

## Daily ingestion automation

Daily scrape + parse + import now runs through GitHub Actions:

- Workflow: `.github/workflows/fos-daily-ingestion.yml`
- Schedule: `20 4 * * *` (daily at 04:20 UTC)
- Runtime command: `npm run fos:daily-ingest`
- Failure alerting: opens or updates a GitHub issue titled `FOS daily ingestion failed`

Required GitHub Actions secret:

- `DATABASE_URL` for the Hetzner PostgreSQL target

Workflow runtime notes:

- `DB_SSL_MODE=require` is forced in the workflow for Hetzner TLS
- `--allow-empty` is passed in the scheduled workflow, so days with no newly published decisions do not fail the job
- the daily ingestion path does not use OpenAI
- artifacts for each run are uploaded from `tmp/fos-daily`

Manual trigger options:

- `window_days` to control the recent overlap window
- `limit` to cap the number of parsed decisions
- `skip_import=true` to run scraper/parser only

Local smoke test:

```bash
npm run fos:daily-ingest -- --start-date 2025-01-01 --end-date 2025-12-31 --limit 1 --skip-import
```

## Summary read-model refresh

Unfiltered dashboard, analysis, and root-cause API paths can read from DB-backed summary snapshots when they exist.

- Schema: `db/migrations/20260307_fos_summary_snapshots.sql`
- Refresh command: `npm run db:refresh-fos-summaries`
- Scheduled workflow: `.github/workflows/fos-refresh-summaries.yml`
- Schedule: every 15 minutes

Manual refresh:

```bash
npm run db:refresh-fos-summaries
```

Optional targeted refresh:

```bash
npm run db:refresh-fos-summaries -- --keys dashboard,analysis
```

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
