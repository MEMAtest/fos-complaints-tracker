# FOS Complaints Intelligence Platform — Project Documentation

**Production:** https://foscomplaints.memaconsultants.com
**Repository:** MEMAtest/fos-complaints-tracker
**Deploy:** Vercel (auto-deploys on push to `main`)
**Database:** PostgreSQL on Hetzner (89.167.95.173), DB `fos_complaints`, user `fos_app`
**Stack:** Next.js 14.2, React 18, TypeScript, Tailwind CSS, PostgreSQL (`pg`), Radix UI / shadcn/ui

---

## Current Status

- **Latest live release:** `dc81574` — estimator and public insights redesign
- **Public front door:** `/` marketing homepage, `/check` public estimator, `/insights` public analysis layer
- **Authenticated entry:** `/workspace`
- **Current product focus:** stronger public conversion path, higher-quality estimator firm overlays, public instrumentation, final visual polish

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Feature Inventory](#feature-inventory)
3. [Architecture](#architecture)
4. [Development Timeline](#development-timeline)
5. [Public Pages](#public-pages)
6. [Authenticated Workspace](#authenticated-workspace)
7. [API Reference](#api-reference)
8. [Data Pipeline](#data-pipeline)
9. [AI & Enrichment](#ai--enrichment)
10. [Security & Hardening](#security--hardening)
11. [E2E Test Coverage](#e2e-test-coverage)
12. [Infrastructure](#infrastructure)
13. [Environment Variables](#environment-variables)
14. [Scripts & CLI](#scripts--cli)

---

## Platform Overview

A search-first analytics application for Financial Ombudsman Service (FOS) decisions, built for MEMA Consultants. The platform ingests, enriches, and analyses 388,000+ published FOS decisions, providing:

- **Public intelligence layer** — SEO-friendly insight pages, a complaint outcome estimator, and a marketing homepage that anyone can access without sign-in.
- **Authenticated workspace** — Complaint tracking, board pack generation, letter drafting, evidence management, and deep analysis behind role-based auth.
- **Automated data pipeline** — Daily scraping of new FOS decisions, AI enrichment via Groq, and summary snapshot refreshes every 15 minutes.

---

## Feature Inventory

### Public Features (no auth required)

| Feature | Route | Description |
|---------|-------|-------------|
| Marketing homepage | `/` | Live stats, featured insights, CTAs to workspace and estimator |
| Complaint Outcome Estimator | `/check` | Free tool: select product + root cause + optional firm → see upheld rate, risk gauge, outcome breakdown, firm comparison, top precedents, what wins/loses cases |
| Insights Hub | `/insights` | SEO-optimised public analysis pages by year, firm, product, complaint theme |
| Year insights | `/insights/years`, `/insights/years/[year]` | Year-level analysis with outcome trends |
| Firm insights | `/insights/firms`, `/insights/firms/[slug]` | Firm-level FOS analysis |
| Product insights | `/insights/products`, `/insights/products/[slug]` | Product-sector analysis |
| Complaint type insights | `/insights/types`, `/insights/types/[slug]` | Complaint theme analysis |
| Cross-section insights | `/insights/year/[year]/product/[productSlug]`, `/insights/firm/[slug]/product/[productSlug]` | Curated cross-section pages |
| Advisor Brief | `/advisor` | On-demand AI-powered brief for any product + root cause combination |
| Deep Analysis | `/analysis` | Year/product matrix, firm benchmarks, precedent/root-cause analysis |

### Authenticated Features (workspace)

| Feature | Route | Description |
|---------|-------|-------------|
| Dashboard | `/workspace` | KPI cards, trends, case list, global search, year/product drill-down |
| Complaint Register | `/complaints` | Full CRUD for complaint tracking with filters, search, import/export |
| Complaint Detail | `/complaints/[id]` | Actions, evidence panel, letter drafting, SLA tracking |
| Letter Intelligence | `/complaints/[id]/letters` | AI-powered complaint letter drafting with review workflow |
| Board Pack | `/board-pack` | Template-based PDF/PPTX generation from live FOS analytics |
| Root Cause Analysis | `/root-causes` | Heatmaps, drill-down by root cause themes |
| Comparison | `/comparison` | Side-by-side firm comparison views |
| Import/Export | `/imports` | CSV/Excel complaint import, export |
| Settings | `/settings` | Admin controls, insight publication overrides, branding |
| FOS Scraper Monitor | `/fos-scraper` | Ingestion status dashboard |

---

## Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # REST API routes
│   │   ├── auth/                 # Login, logout, session
│   │   ├── complaints/           # Complaint CRUD, letters, evidence, import/export
│   │   ├── fos/                  # FOS analytics (dashboard, analysis, cases, advisor, check, etc.)
│   │   ├── insights/             # Public insight data
│   │   └── dashboard/            # Dashboard data
│   ├── check/                    # Complaint Outcome Estimator (public)
│   ├── advisor/                  # Advisor Brief (public)
│   ├── analysis/                 # Deep Analysis (public)
│   ├── insights/                 # Public insight pages
│   ├── complaints/               # Complaint workspace (auth required)
│   ├── board-pack/               # Board pack generator (auth required)
│   ├── workspace/                # Main workspace dashboard (auth required)
│   └── ...
├── components/
│   ├── check/                    # Estimator components (risk gauge, outcome breakdown, etc.)
│   ├── advisor/                  # Advisor brief components
│   ├── analysis/                 # Analysis components
│   ├── dashboard/                # Dashboard KPI cards, trends, case lists
│   ├── complaints/               # Complaint CRUD, letters, evidence
│   ├── board-pack/               # Board pack builder
│   ├── insights/                 # Public insight page components
│   ├── marketing/                # Marketing header, homepage sections
│   ├── illustrations/            # SVG illustrations
│   ├── layout/                   # Sidebar, marketing layout
│   └── ui/                       # Radix/shadcn primitives
├── hooks/
│   ├── use-fos-dashboard.ts      # Dashboard data hook
│   ├── use-fos-analysis.ts       # Analysis hook
│   ├── use-fos-advisor.ts        # Advisor brief hook
│   ├── use-check-estimator.ts    # Estimator hook (advisor API + firm overlay)
│   └── use-fos-filters.ts        # Filter state hook
├── lib/
│   ├── database.ts               # PostgreSQL pool (SSL, retries, configurable pool)
│   ├── fos/                      # FOS analytics core
│   │   ├── repository.ts         # Main query builder
│   │   ├── repo-helpers.ts       # Query helpers (25KB)
│   │   ├── dashboard-repository.ts
│   │   ├── analysis-repository.ts
│   │   ├── cases-repository.ts
│   │   ├── advisor-repository.ts # Advisor brief + estimator firm overlay
│   │   ├── groq-client.ts        # Groq LLM wrapper
│   │   ├── constants.ts          # Outcome colors, labels
│   │   └── types.ts              # Shared FOS types
│   ├── complaints/               # Complaint management logic
│   ├── board-pack/               # PDF/PPTX generation (pdf-lib, pptxgenjs)
│   ├── insights/                 # Public insight logic
│   ├── marketing/                # Homepage data
│   ├── auth/                     # JWT auth system
│   └── server/
│       ├── rate-limit.ts         # Postgres-backed rate limiter
│       └── route-metrics.ts      # Structured logging
├── scripts/                      # Data pipeline scripts
├── e2e/                          # Playwright E2E tests (19 test files)
├── db/migrations/                # SQL migrations (10 files)
└── middleware.ts                  # Auth middleware
```

---

## Development Timeline

Listed chronologically from earliest to latest, based on the git history.

### Phase 1 — Foundation & Dashboard

| Commit | What was done |
|--------|--------------|
| `ee16c9c` | Initial project — working test page |
| `a73c33e` → `d2ebe3e` | Production dashboard with real 2024 data, 217 firms, smart date parsing, SQL fixes, retry logic |
| `8db6683` | FOS summary read models for fast dashboard loads |
| `a797a68` | Parallelised dashboard summary + case loading |
| `053c4e2` | Chart UX overhaul: drill-through, 5-firm comparison, sunburst legend, year filter bar |
| `848dd02` | Gauge chart whitespace fix |

### Phase 2 — Complaints Workspace & Board Pack

| Commit | What was done |
|--------|--------------|
| `def5582` | Complaints workspace + board pack generation |
| `49f4a2a` | Complaint evidence panel + letter drafting |
| `b11955f` | Letter and board pack layout refinements |
| `5e6f626` | Letter compliance guidance hardening |
| `1d53a95` | Complaints branding and policy settings |
| `26de630` | Board pack DB connection fan-out reduction |

### Phase 3 — Repository Refactor & Advisor

| Commit | What was done |
|--------|--------------|
| `9ff5d23` | Split monolithic `repository.ts` into domain modules (all under 1K lines) |
| `4a3faf2` | Complaint letter intelligence (AI-powered draft helpers) |
| `fc2b90d` | Complaint Advisor feature with input validation and security |
| `a4b1b90` | Enriched complaint letter drafting scaffolds |
| `0a11838` | Letter approval versioning |
| `e4e454a` | Letter reviewer workflow |

### Phase 4 — Auth, Hardening & E2E

| Commit | What was done |
|--------|--------------|
| `f5e147e` | Auth system, evidence panel, letter review workflow, input validation, E2E tests |
| `2b530c4` | Complaints workspace hardening (full security pass) |
| `c555845` | Postgres-backed rate limiting on heavy routes |

### Phase 5 — Public Insights Hub

| Commit | What was done |
|--------|--------------|
| `ac0b1b7` | Public SEO insights hub (`/insights`) |
| `261bc7d` | Curated insight cross pages (year-products, firm-products) |
| `7131efc` | Insight publication overrides (admin controls) |
| `5f4b6b8` | Ingestion window increased from 14 → 90 days |

### Phase 6 — Deep Analysis, Advisor Briefs & Similar Decisions

| Commit | What was done |
|--------|--------------|
| `69f1fdd` | On-demand deep analysis, enhanced advisor briefs, similar decisions |
| `ab2ffc6` | SQL fix: replace HAVING with CTE + WHERE for similar decisions |
| `b589fbd` | Groq rate limiting improvements in brief generator |
| `a6a7ce3` | API route hardening + code review security fixes |
| `68b5ae5` | Comprehensive E2E tests for deep analysis, advisor, similar decisions |

### Phase 7 — Risk Model & Documentation

| Commit | What was done |
|--------|--------------|
| `bf9b20f` | Clarified uphold risk model (thresholds, labels) |
| `4866903` | Added CLAUDE.md project knowledge file |
| `5168252` | Risk model future development plan (Phases 2-4) |

### Phase 8 — Public Marketing Homepage

| Commit | What was done |
|--------|--------------|
| `a263b7f` | Public marketing homepage with live stats, CTAs |
| `9c38d85` | Redesigned public homepage |
| `a771687` | Fixed homepage navigation handoff |

### Phase 9 — Complaint Outcome Estimator (`/check`)

| Commit | What was done |
|--------|--------------|
| `9ee140e` | **Full feature build:** Complaint Outcome Estimator at `/check` |
| `dc81574` | **UI redesign:** Redesigned estimator + public insights |

### Phase 10 — Public Conversion, Overlay Quality, and Instrumentation

| Commit | What was done |
|--------|--------------|
| `dc81574` | Added stronger estimator example chips, illustration-led public insights/detail surfaces, and polished public conversion flow |
| `working tree` | Overlay fallback quality, lightweight CTA instrumentation, and final public-page polish pass |

**Estimator details:**

The `/check` page is a free public tool that lets anyone check the likely FOS upheld rate for a complaint context. Users select:

- **Product / sector** (required) — anchors the estimate in comparable published decisions
- **Root cause** (optional) — narrows by complaint theme
- **Firm name** (optional) — overlays firm-specific stats when published data exists

Results show:

1. **Summary cards** — Estimated upheld rate, uphold risk level, sample size, firm/overall context
2. **Risk Gauge** — SVG semicircular gauge with 4 colour zones (green/amber/orange/red), animated needle
3. **Outcome Breakdown** — Horizontal stacked bar showing upheld/not upheld/partial/other distribution
4. **Confidence Badge** — Sample size indicator (Very low / Low / Moderate / High)
5. **Firm Comparison** — 3 horizontal bars: firm rate vs product rate vs FOS overall (when firm overlay available)
6. **Top Precedents** — Up to 5 most-cited precedent themes with counts
7. **What Wins / Loses Cases** — AI-synthesised themes + data-driven patterns
8. **Example Chips** — 4 pre-built examples that auto-populate the form and load results
9. **Explainer Grid** — 4-step visual guide to reading the estimate
10. **CTA Section** — Links to full Advisor Brief and authenticated workspace

**Technical implementation:**

- **New API endpoint:** `GET /api/fos/check/firm-overlay?product=X&rootCause=Y&firm=Z` — firm-specific stats with 5-minute in-memory cache
- **Reuses existing advisor API** — `GET /api/fos/advisor?product=X&rootCause=Y` for the core brief data
- **Repository function:** `getEstimatorFirmOverlay()` in `advisor-repository.ts`
- **Client hook:** `useCheckEstimator()` orchestrates parallel API calls with AbortController + 30s timeout
- **SEO:** Full metadata, JSON-LD `WebApplication` structured data, Open Graph, Twitter cards
- **Overlay quality rule:** show firm overlay only when the published corpus has at least 10 matching decisions; if the root-cause slice is too thin, widen back to the product-level firm overlay

**Security hardening applied:**

- SQL ILIKE wildcard injection prevention (escape `%`, `_`, `\` in firm name)
- Product match uses exact `=` (not ILIKE)
- XSS prevention in JSON-LD (`<` escaped as `\u003c`)
- Input validation: deny-list regex blocks `<>{}[]\;`
- Error messages sanitised (no HTTP status codes or stack traces leaked)
- Cache keys use `JSON.stringify([...])` to prevent collision

**Components created:**

| Component | File |
|-----------|------|
| Risk Gauge | `src/components/check/risk-gauge.tsx` |
| Outcome Breakdown | `src/components/check/outcome-breakdown.tsx` |
| Confidence Badge | `src/components/check/confidence-badge.tsx` |
| Firm Comparison Bar | `src/components/check/firm-comparison-bar.tsx` |
| Results Summary | `src/components/check/check-results-summary.tsx` |
| Example Chips | `src/components/check/check-example-chips.tsx` |
| Explainer Grid | `src/components/check/check-explainer-grid.tsx` |
| Public Illustration | `src/components/illustrations/public-illustration.tsx` |
| Public CTA tracking | `src/components/analytics/public-tracked-link.tsx` |
| Public analytics helper | `src/lib/analytics/public-events.ts` |

**E2E tests:** 22 tests in `e2e/check-estimator.spec.ts` covering API validation, page loads, form interaction, results sections, firm overlay, error states, and CTAs.

---

## Public Pages

All public pages are crawlable, have canonical URLs, and include structured data (JSON-LD). No auth required.

| Page | URL | SEO |
|------|-----|-----|
| Homepage | `/` | Marketing landing with live corpus stats |
| Estimator | `/check` | `WebApplication` schema, Open Graph, Twitter |
| Insights Hub | `/insights` | Landing page with featured insights |
| Year pages | `/insights/year/[year]` | Year-level analysis |
| Firm pages | `/insights/firm/[slug]` | Firm-level analysis |
| Product pages | `/insights/product/[slug]` | Product-sector analysis |
| Type pages | `/insights/type/[slug]` | Complaint theme analysis |
| Cross pages | `/insights/year/[year]/product/[productSlug]`, `/insights/firm/[slug]/product/[productSlug]` | Curated cross-sections |
| Advisor Brief | `/advisor` | On-demand AI brief |
| Deep Analysis | `/analysis` | Year/product matrix, benchmarks |

---

## Authenticated Workspace

Protected by JWT auth (jose) with httpOnly cookies. Role-based access: `viewer`, `operator`, `reviewer`, `manager`, `admin`.

| Feature | Access | Description |
|---------|--------|-------------|
| Dashboard | All roles | KPI cards, trends, case drill-down, global search |
| Complaints | Operator+ | Full complaint lifecycle: create, track, update, close |
| Evidence | Operator+ | Upload/manage evidence per complaint |
| Letters | Operator+ | AI-drafted complaint letters with review/approval workflow |
| Board Pack | Manager+ | Generate PDF/PPTX board packs from live analytics |
| Import/Export | Manager+ | CSV/Excel complaint import, data export |
| Settings | Admin | Insight publication controls, branding, policy |

---

## API Reference

### FOS Analytics (public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fos/dashboard` | Full dashboard snapshot |
| GET | `/api/fos/analysis` | Deep analysis (year/product matrix, benchmarks) |
| GET | `/api/fos/overview` | Top-level KPI overview |
| GET | `/api/fos/trends` | Yearly trends, outcome split |
| GET | `/api/fos/distribution/products` | Product distribution |
| GET | `/api/fos/distribution/firms` | Firm distribution |
| GET | `/api/fos/precedents` | Precedent/root-cause frequencies |
| GET | `/api/fos/root-causes` | Root cause analysis |
| GET | `/api/fos/cases` | Paginated case list with filters |
| GET | `/api/fos/cases/[id]` | Full case detail |
| GET | `/api/fos/cases/[id]/similar` | Similar decisions |
| GET | `/api/fos/advisor` | On-demand advisor brief |
| GET | `/api/fos/advisor/options` | Available products and root causes |
| GET | `/api/fos/check/firm-overlay` | Estimator firm overlay stats |
| POST | `/api/fos/analysis/synthesise` | AI synthesis via Groq |
| GET | `/api/fos/firms` | Firm list |
| GET | `/api/fos/comparison` | Firm comparison data |
| GET | `/api/fos/ingestion-status` | Ingestion run status |
| GET | `/api/fos/keepalive` | Cron health probe |

### Complaints (auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/complaints` | List / create complaints |
| GET/PATCH/DELETE | `/api/complaints/[id]` | Read / update / delete |
| POST | `/api/complaints/[id]/evidence` | Upload evidence |
| POST | `/api/complaints/[id]/letters` | Draft complaint letter |
| POST | `/api/complaints/[id]/letter-intelligence` | AI letter intelligence |
| POST | `/api/complaints/[id]/actions` | Record actions |
| POST | `/api/complaints/import` | CSV/Excel import |
| GET | `/api/complaints/export` | Export data |

### Board Pack (auth required, rate-limited)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fos/board-pack` | Preview board pack data |
| POST | `/api/fos/board-pack/generate` | Generate PDF or PPTX |

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Current session |

---

## Data Pipeline

### Daily Ingestion

- **Schedule:** GitHub Actions, daily at 04:20 UTC
- **Workflow:** `.github/workflows/fos-daily-ingestion.yml`
- **Command:** `npm run fos:daily-ingest`
- **Process:** Playwright scrapes FOS website → downloads PDFs → parses with `pdf-parse` → extracts structured data (decision date, firm, outcome, precedents, root causes, vulnerability flags) → upserts into `fos_decisions`
- **Window:** Last 90 days (configurable)
- **Failure alerting:** Opens/updates GitHub issue titled "FOS daily ingestion failed"

### Summary Refresh

- **Schedule:** GitHub Actions, every 15 minutes
- **Workflow:** `.github/workflows/fos-refresh-summaries.yml`
- **Command:** `npm run db:refresh-fos-summaries`
- **Purpose:** Pre-computes dashboard, analysis, and root-cause snapshots for fast API responses

### Import Pipeline

- **Command:** `npm run db:import-fos-parsed`
- **Purpose:** Batch import of parsed FOS decision corpus into `fos_decisions`
- **Supports:** Resumable state, configurable batch size, optional full-text storage

---

## AI & Enrichment

- **Model:** Groq `llama-3.3-70b-versatile` (free tier)
- **Enrichment script:** `scripts/backfill-fos-enrichment.mjs` (36KB)
- **What it adds:** Confidence scores, enhanced categorisation, AI-synthesised summaries
- **Advisor briefs:** `scripts/generate-advisor-briefs.ts` — pre-generates AI analysis per product+root cause
- **Runtime synthesis:** `POST /api/fos/analysis/synthesise` — on-demand Groq synthesis
- **Letter intelligence:** AI-powered complaint letter drafting and compliance guidance

---

## Security & Hardening

### Authentication & Authorization

- JWT auth (jose) with httpOnly cookies
- 5 roles: viewer, operator, reviewer, manager, admin
- Middleware protects `/complaints/*`, `/board-pack/*`, `/imports/*`
- Public routes: `/`, `/login`, `/insights/*`, `/check`, `/advisor`, `/analysis`, FOS analytics API

### Rate Limiting

- Postgres-backed fixed-window rate limiting
- Applied to: board-pack generate, complaints import/export
- Returns 429 with `Retry-After` header

### Input Validation & Injection Prevention

- SQL parameterised queries throughout (no string concatenation)
- ILIKE wildcard escaping (`%`, `_`, `\`) for fuzzy search
- Deny-list input validation (`/[<>{}[\]\\;]/`) on user-facing text inputs
- XSS prevention in JSON-LD output (`<` → `\u003c`)
- Error messages sanitised (no stack traces or HTTP status codes leaked to users)

### Code Review Findings Applied

All findings from automated code review were fixed before deployment:

1. SQL ILIKE wildcard injection → escaped special chars
2. XSS in `dangerouslySetInnerHTML` → escaped `<`
3. Input validation too restrictive → switched from allowlist to deny-list
4. SVG arc parameter bug → renamed variable
5. Cache key collision → switched to `JSON.stringify`
6. NaN guard missing → added `Number() || 0` fallback
7. Missing ARIA → added `role="img"` + descriptive labels
8. Error message leakage → sanitised to user-friendly text
9. E2E race condition → used Playwright `.or()` pattern

---

## E2E Test Coverage

19 Playwright test files covering all major features:

| Test File | Coverage |
|-----------|----------|
| `smoke.spec.ts` | Basic page loads, health checks |
| `homepage.spec.ts` | Marketing homepage, live stats, navigation |
| `check-estimator.spec.ts` | Estimator API (7 tests), page loads (3), form interaction (7), results sections (5) — **22 tests** |
| `advisor.spec.ts` | Advisor brief page, options loading, brief generation |
| `analysis-deep-dive.spec.ts` | Deep analysis page, year/product matrix |
| `api-analysis.spec.ts` | Analysis API endpoints |
| `case-similarity.spec.ts` | Similar decisions feature |
| `insights.spec.ts` | Public insight pages |
| `insight-overrides.spec.ts` | Publication override admin controls |
| `auth.spec.ts` | Login, logout, session, role enforcement |
| `complaints-register-search.spec.ts` | Complaint list, filters, search |
| `evidence.spec.ts` | Evidence upload and management |
| `letters.spec.ts` | Complaint letter drafting |
| `letter-template-control.spec.ts` | Letter template management |
| `letter-review.spec.ts` | Letter review/approval workflow |
| `complaint-letter-intelligence.spec.ts` | AI letter intelligence |
| `actions-sla.spec.ts` | Complaint actions and SLA tracking |
| `board-pack-definitions.spec.ts` | Board pack template builder |
| `operational-hardening.spec.ts` | Rate limiting, error handling, edge cases |

**Run tests:**

```bash
npm run test:e2e             # All tests (headless)
npm run test:e2e:headed      # Headed browser mode
```

---

## Infrastructure

### Database

- **Host:** 89.167.95.173 (Hetzner CPX32, Helsinki)
- **Container:** Docker `postgres-migration`, port 5432
- **SSL:** Self-signed cert, TLSv1.3 — use `sslmode=no-verify`
- **App user:** `fos_app` with access to `fos_complaints` database
- **Key tables:**
  - `fos_decisions` (388,000+ rows) — all FOS decisions
  - `fos_ingestion_runs` — scraper run tracking
  - `fos_summary_snapshots` — cached summary read models
  - `complaints_*` — complaint workspace tables
  - `app_rate_limit_windows` — rate limit state
  - `insight_publication_overrides` — public page admin controls
- **Backups:** Daily at 2am UTC to `/data/db-backups`

### Deployment

- **Platform:** Vercel
- **Trigger:** Auto-deploy on push to `main`
- **Build time:** ~3-4 minutes
- **Custom domain:** `foscomplaints.memaconsultants.com`

---

## Environment Variables

### Required

```
DATABASE_URL=postgresql://fos_app:PASSWORD@89.167.95.173:5432/fos_complaints?sslmode=no-verify
```

### Optional

```
GROQ_API_KEY=                        # AI enrichment and synthesis
DEBUG_API_SECRET=                     # Bearer token for /api/debug-* endpoints
CRON_SECRET=                         # Bearer token for /api/fos/keepalive
NEXT_PUBLIC_SITE_URL=https://foscomplaints.memaconsultants.com
NEXT_PUBLIC_APP_BASE_URL=            # Public app origin for workspace CTAs
DB_POOL_MAX=8                        # Max pool size
DB_QUERY_TIMEOUT_MS=15000            # Per-query timeout
DB_IDLE_IN_TX_TIMEOUT_MS=10000       # Idle transaction timeout
DB_MAX_USES=7500                     # Connection recycle threshold
DB_APPLICATION_NAME=fos-complaints-tracker
DB_CONNECT_RETRIES=3                 # Retry count (scripts: 3, app: 2)
DB_RETRY_BASE_MS=350                 # Initial retry delay
DB_RETRY_MAX_MS=4000                 # Max retry delay
```

### Dev Auth Users

```
viewer@local.test   / ViewerPass123!
operator@local.test / OperatorPass123!
reviewer@local.test / ReviewerPass123!
manager@local.test  / ManagerPass123!
admin@local.test    / AdminPass123!
```

---

## Scripts & CLI

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:headed` | E2E tests in headed browser |
| `npm run fos:daily-ingest` | Daily FOS decision scraper |
| `npm run db:check` | Verify schema/data health |
| `npm run db:verify-targets` | Verify local & deploy target same DB |
| `npm run db:probe-connectivity` | Test connection stability |
| `npm run db:refresh-fos-summaries` | Refresh summary snapshots |
| `npm run db:import-fos-parsed` | Import parsed FOS corpus |
| `npm run db:backfill-fos-enrichment` | AI enrichment (Groq) |
| `npm run db:backfill-fos-enrichment:canary` | Canary enrichment (25K limit) |
| `npm run db:report-fos-quality` | Data quality report |
| `npm run db:add-fos-search-indexes` | Add search indexes |
| `npm run db:add-fos-performance-indexes` | Add performance indexes |
| `npm run db:cutover-fos` | Maintenance-window cutover |

---

*Last updated: 2026-04-01*
