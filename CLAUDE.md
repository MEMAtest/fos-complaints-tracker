# FOS Complaints Tracker - Project Knowledge

## Project Overview

FOS (Financial Ombudsman Service) decision analytics platform with 386k+ decisions, complaint tracking, board pack generation, and AI-powered insights. Next.js 14.2, React 18, TypeScript, PostgreSQL (Hetzner), Radix UI.
**Prod:** https://foscomplaints.memaconsultants.com | **Deploy:** Vercel (auto on push to `main`)

## Key Commands

```bash
npm run dev                  # Next.js dev server
npm run build                # Production build
npm run lint                 # ESLint
npm run test:e2e             # Playwright E2E tests
npm run test:e2e:headed      # Headed browser mode
npm run fos:daily-ingest     # Daily FOS decision scraper (also runs via GitHub Actions at 04:20 UTC)
npm run db:check             # Verify schema/data health
npm run db:verify-targets    # Verify local & deploy target same DB host
npm run db:probe-connectivity # Test connection stability (10 attempts)
npm run db:refresh-fos-summaries  # Refresh summary snapshots
npm run db:import-fos-parsed      # Import parsed FOS corpus
npm run db:backfill-fos-enrichment      # AI enrichment (Groq)
npm run db:backfill-fos-enrichment:canary # Canary enrichment (25k limit)
npm run db:report-fos-quality    # Data quality baseline report
npm run db:add-fos-search-indexes      # Add search indexes
npm run db:add-fos-performance-indexes # Add performance indexes
npm run db:cutover-fos       # Maintenance-window cutover (backup → migrate → drop legacy)
```

## Architecture

- **Framework:** Next.js 14.2 (App Router)
- **Database:** PostgreSQL on Hetzner via `pg` driver (`lib/database.ts`)
- **Auth:** JWT (jose) with httpOnly cookies, role-based (viewer, operator, reviewer, manager, admin)
- **AI:** Groq `llama-3.3-70b-versatile` for enrichment and synthesis
- **PDF/PPTX:** pdf-lib (PDF), pptxgenjs (PowerPoint)
- **Charts:** Recharts
- **UI:** Radix UI + shadcn/ui primitives
- **Path alias:** `@/*` → `./src/*`
- **Rate limiting:** Postgres-backed fixed-window on heavy routes

## Directory Structure

```
├── src/
│   ├── app/
│   │   ├── api/                # REST API routes
│   │   │   ├── fos/            # FOS analytics (dashboard, analysis, cases, trends, etc.)
│   │   │   ├── complaints/     # Complaint CRUD, letters, evidence, import/export
│   │   │   ├── auth/           # Login, logout, me
│   │   │   └── insights/       # Public insight pages
│   │   ├── advisor/            # Advisor brief page
│   │   ├── analysis/           # Deep analysis page
│   │   ├── board-pack/         # Board pack generation
│   │   ├── complaints/         # Complaint tracking UI
│   │   ├── insights/           # Public SEO-friendly insights
│   │   ├── root-causes/        # Root cause analysis
│   │   └── settings/           # Admin settings
│   ├── components/
│   │   ├── dashboard/          # KPI cards, trends, case lists
│   │   ├── advisor/            # Advisor brief components
│   │   ├── analysis/           # Year/product matrix, benchmarks
│   │   ├── board-pack/         # Template builder, PDF/PPTX preview
│   │   ├── complaints/         # Complaint CRUD, letters, evidence
│   │   ├── insights/           # Public insight page components
│   │   ├── root-causes/        # Heatmaps, drill-down
│   │   └── ui/                 # Radix/shadcn primitives
│   ├── hooks/
│   │   ├── use-fos-dashboard.ts
│   │   ├── use-fos-analysis.ts
│   │   ├── use-fos-advisor.ts
│   │   ├── use-fos-filters.ts
│   │   └── use-loading-progress.ts
│   ├── lib/
│   │   ├── database.ts         # PostgreSQL pool + SSL + retries
│   │   ├── fos/                # FOS analytics core
│   │   │   ├── repository.ts   # Main query builder
│   │   │   ├── repo-helpers.ts # Query helpers (25KB)
│   │   │   ├── dashboard-repository.ts
│   │   │   ├── analysis-repository.ts
│   │   │   ├── cases-repository.ts
│   │   │   ├── advisor-repository.ts
│   │   │   └── groq-client.ts  # Groq LLM wrapper
│   │   ├── complaints/         # Complaint management
│   │   │   ├── repository.ts, schema.ts, types.ts
│   │   │   ├── letter-drafting.ts, letter-intelligence.ts
│   │   │   └── build-letter-pdf.ts
│   │   ├── board-pack/         # Board pack export
│   │   │   ├── build-board-pack-pdf.ts
│   │   │   └── build-board-pack-pptx.ts
│   │   ├── insights/           # Public insights
│   │   ├── auth/               # JWT auth system
│   │   └── server/
│   │       ├── rate-limit.ts   # Postgres-backed rate limiter
│   │       └── route-metrics.ts # Structured logging
│   └── types/
├── scripts/
│   ├── fos/daily-ingestion.mjs # Playwright + PDF parsing scraper
│   ├── backfill-fos-enrichment.mjs  # Groq AI enrichment (36KB)
│   ├── refresh-fos-summaries.mjs    # Summary snapshot refresh (30KB)
│   ├── import-fos-parsed.mjs        # Batch corpus import
│   ├── cutover-fos.mjs              # Maintenance cutover
│   └── generate-advisor-briefs.ts   # AI advisor brief generation
├── db/migrations/              # SQL migrations (10 files)
├── e2e/                        # Playwright E2E tests (19 dirs)
├── .github/workflows/
│   ├── fos-daily-ingestion.yml    # Daily at 04:20 UTC
│   └── fos-refresh-summaries.yml  # Every 15 minutes
└── middleware.ts               # Auth middleware (protects /complaints, /board-pack)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/database.ts` | PostgreSQL pool with SSL, retries, pool config |
| `src/lib/fos/repository.ts` | Main FOS query builder |
| `src/lib/fos/repo-helpers.ts` | Query helpers, aggregation, filters (25KB) |
| `src/lib/fos/groq-client.ts` | Groq LLM wrapper for synthesis |
| `scripts/fos/daily-ingestion.mjs` | Playwright scraper + PDF parser |
| `scripts/backfill-fos-enrichment.mjs` | AI enrichment pipeline (36KB) |
| `scripts/refresh-fos-summaries.mjs` | Summary snapshot refresh (30KB) |
| `middleware.ts` | Auth middleware protecting complaints & board-pack routes |

## API Routes

**FOS Analytics:**
- `GET /api/fos/dashboard` — Full dashboard (KPIs, trends, distributions, cases)
- `GET /api/fos/analysis` — Deep analysis (year/product matrix, benchmarks, precedents)
- `GET /api/fos/cases` — Paginated case list with filters
- `GET /api/fos/cases/:id` — Case detail
- `GET /api/fos/cases/:id/similar` — Similar cases
- `GET /api/fos/trends`, `/overview`, `/distribution/products`, `/distribution/firms`
- `GET /api/fos/precedents`, `/root-causes`
- `POST /api/fos/analysis/synthesise` — AI synthesis via Groq

**Complaints:**
- `GET/POST /api/complaints` — List/create
- `GET/PATCH/DELETE /api/complaints/:id`
- `POST /api/complaints/:id/evidence`, `/letters`, `/actions`
- `POST /api/complaints/import` — CSV/Excel import
- `GET /api/complaints/export`

**Board Pack:**
- `GET /api/fos/board-pack` — Preview
- `POST /api/fos/board-pack/generate` — Generate PDF/PPTX

**Auth:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`

**Public:** `/api/insights/*`, `/api/fos/keepalive` (cron every 5 min)

## Common Patterns

### Database Query
```typescript
import { pool } from '@/lib/database';

const { rows } = await pool.query<FosDecision>(
  'SELECT * FROM fos_decisions WHERE business_name ILIKE $1 LIMIT $2',
  [`%${search}%`, limit]
);
```

### Auth Check (API Route)
```typescript
// Protected routes check session cookie via middleware.ts
// Public FOS analytics routes don't require auth
```

### Rate Limiting
```typescript
// Postgres-backed fixed-window on heavy routes
// Returns 429 with Retry-After header when exceeded
// Applied to: /api/fos/board-pack, /api/complaints/import, /api/complaints/export
```

## Environment Variables

**Required:**
```
DATABASE_URL=postgresql://fos_app:PASSWORD@89.167.95.173:5432/fos_complaints?sslmode=no-verify
```

**Optional:**
```
GROQ_API_KEY=               # AI enrichment & synthesis
DEBUG_API_SECRET=            # Bearer token for /api/debug-* endpoints
CRON_SECRET=                 # Bearer token for keepalive (only enforced if set)
NEXT_PUBLIC_SITE_URL=https://foscomplaints.memaconsultants.com
DB_POOL_MAX=8               # Max pool size (default: 8)
DB_QUERY_TIMEOUT_MS=15000   # Per-query timeout
```

**Dev bootstrap users:**
```
viewer@local.test / ViewerPass123!
operator@local.test / OperatorPass123!
admin@local.test / AdminPass123!
```

## Gotchas

- **`fos_decisions` table has 386k+ rows** — always use LIMIT and indexes for queries
- **Daily ingestion runs at 04:20 UTC** via GitHub Actions (Playwright scraper)
- **Summary snapshots refresh every 15 min** via GitHub Actions
- **Groq model:** Use `llama-3.3-70b-versatile` (NOT `llama-3.1-70b-versatile` — retired)
- **SSL:** Use `sslmode=no-verify` for Hetzner self-signed cert
- **Public routes** (no auth): `/`, `/login`, `/insights/*`, FOS analytics API routes
- **Protected routes** (auth required): `/complaints/*`, `/board-pack/*`, `/imports/*`
- **Rate-limited routes:** board-pack generate, complaints import/export

## Database

- **Host:** 89.167.95.173 (Hetzner), user `fos_app`, DB `fos_complaints`
- **Key tables:**
  - `fos_decisions` (386k+) — All FOS decisions (reference, date, firm, product, outcome, full text, precedents, root causes, vulnerability flags)
  - `fos_ingestion_runs` — Scraper run tracking
  - `fos_summary_snapshots` — Cached dashboard/analysis snapshots
  - `complaints_*` — Complaint tracking workspace tables
  - `app_rate_limit_windows` — Postgres-backed rate limiting
  - `insight_publication_overrides` — Public insight page customization

## Ingestion Pipeline

1. **Daily scrape** (GitHub Actions, 04:20 UTC): Playwright navigates FOS website → downloads PDFs → parses with pdf-parse → extracts structured data (decision date, firm, outcome, precedents, root causes, vulnerability flags)
2. **Enrichment** (`db:backfill-fos-enrichment`): Groq AI adds confidence scores, enhanced categorization
3. **Summary refresh** (every 15 min): Pre-computes dashboard/analysis snapshots for fast API responses
