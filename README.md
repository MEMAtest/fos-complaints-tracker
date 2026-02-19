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
- `GET /api/fos/overview` - top-level KPI overview
- `GET /api/fos/trends` - yearly trends, outcome split, and yearly insight cards
- `GET /api/fos/distribution/products` - product-level distribution
- `GET /api/fos/distribution/firms` - firm-level distribution
- `GET /api/fos/precedents` - precedent and root-cause frequencies
- `GET /api/fos/cases` - paginated case list with filters
- `GET /api/fos/cases/:caseId` - full case detail
- `GET /api/fos/ingestion-status` - ingestion status only
- `GET /api/fos/progress` - compatibility progress payload for old monitors
- `GET /api/dashboard` - compatibility alias to FOS dashboard snapshot

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Required env var:

- `DATABASE_URL` (PostgreSQL)

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

## Notes

- The cutover script is destructive for legacy tables **after backup**.
- Keep the backup schema for the agreed retention window (default: 7 days).
