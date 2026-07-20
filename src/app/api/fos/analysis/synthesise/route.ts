import { NextRequest } from 'next/server';
import { DatabaseClient } from '@/lib/database';
import { FOSDashboardFilters, FOSOutcome, FOSSubsetAnalysis } from '@/lib/fos/types';
import {
  buildFilteredCte,
  ensureDatabaseConfigured,
  ensureFosDecisionsTableExists,
  normalizeTagLabel,
  toInt,
  toNumber,
} from '@/lib/fos/repo-helpers';
import { callGroq } from '@/lib/fos/groq-client';
import { clientKeyFromRequest, RateLimitError, rateLimitOrThrow } from '@/lib/server/rate-limit';
import { logRouteMetric } from '@/lib/server/route-metrics';
import { FOSSynthesisApiResponse } from '@/types/fos-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const ROUTE = '/api/fos/analysis/synthesise';
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_FILTER_VALUE_LENGTH = 200;
const ALLOWED_OUTCOMES = new Set<FOSOutcome>([
  'upheld',
  'not_upheld',
  'partially_upheld',
  'settled',
  'not_settled',
  'unknown',
]);
const SYNTHESIS_RATE_LIMIT = parsePositiveInt(process.env.FOS_SYNTHESIS_RATE_LIMIT, 6, 1, 100);
const SYNTHESIS_RATE_WINDOW_MS = parsePositiveInt(
  process.env.FOS_SYNTHESIS_RATE_WINDOW_MS,
  10 * 60_000,
  10_000,
  24 * 60 * 60_000
);

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function boundedStrings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return [];
  return value
    .slice(0, limit)
    .map((item) => item.trim().slice(0, MAX_FILTER_VALUE_LENGTH))
    .filter(Boolean);
}

function boundedOutcomes(value: unknown): FOSOutcome[] {
  return boundedStrings(value, 10).filter((item): item is FOSOutcome => ALLOWED_OUTCOMES.has(item as FOSOutcome));
}

function logSynthesisMetric(startedAt: number, status: number, detail?: Record<string, unknown>) {
  logRouteMetric({
    route: ROUTE,
    method: 'POST',
    status,
    durationMs: Date.now() - startedAt,
    detail,
  });
}

function errorResponse(startedAt: number, status: number, message: string, detail?: Record<string, unknown>, headers?: HeadersInit) {
  logSynthesisMetric(startedAt, status, detail);
  return Response.json({ success: false, error: message }, { status, headers });
}

async function readBoundedJson(request: Request): Promise<{ body?: unknown; error?: 'invalid_json' | 'request_too_large' }> {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return { error: 'request_too_large' };
  }

  try {
    return { body: JSON.parse(rawBody) as unknown };
  } catch {
    return { error: 'invalid_json' };
  }
}

const SYSTEM_PROMPT = `You are a Principal Compliance Analyst at an FCA-authorised firm, specialising in Financial Ombudsman Service (FOS) complaint intelligence. You produce institutional-grade analysis briefs that compliance officers, risk managers, and financial advisors rely on to shape policy, training, and complaint-handling strategy.

Your analysis must be:
- EVIDENCE-BASED: Every claim must trace to the statistics or reasoning excerpts provided. Cite specific numbers (e.g., "In 67% of upheld cases...") and quote or paraphrase ombudsman reasoning where relevant.
- STRUCTURED: Use clear section headings. Each section should be 2-3 substantive paragraphs.
- ACTIONABLE: End every analytical observation with a concrete recommendation or risk flag.
- PROFESSIONAL: Write in formal British English. Use FCA/FOS terminology correctly (DISP, ICOBS, PRIN, TCF, Consumer Duty, vulnerability, root cause, redress).
- BALANCED: Analyse both upheld AND not-upheld outcomes to identify what distinguishes them.

Do NOT use filler phrases like "it's worth noting" or "interestingly". Do NOT speculate beyond the data. If the sample is small, say so and caveat accordingly.`;

function buildUserPrompt(stats: SynthesisStats): string {
  const rootCauseLines = stats.rootCauses
    .map((rc) => `- ${rc.label}: ${rc.count} cases, ${rc.upheldRate.toFixed(1)}% upheld`)
    .join('\n');

  const precedentLines = stats.precedents
    .map((p) => `- ${p.label}: cited in ${p.count} cases (${p.percentOfCases.toFixed(1)}%)`)
    .join('\n');

  const vulnerabilityLines = stats.vulnerabilities
    .map((v) => `- ${v.label}: ${v.count} cases (${v.percentOfCases.toFixed(1)}%)`)
    .join('\n');

  const excerptLines = stats.excerpts
    .map(
      (e) =>
        `--- Decision ${e.decisionReference} | ${e.outcome} | ${e.productSector} | ${e.firmName} | ${e.decisionDate} ---\n${e.reasoningText}`
    )
    .join('\n\n');

  return `Produce a deep analysis brief for the following filtered subset of FOS decisions.

FILTER CRITERIA:
- Product sector(s): ${stats.filterDescription.products || 'All sectors'}
- Outcome filter: ${stats.filterDescription.outcomes || 'All outcomes'}
- Year(s): ${stats.filterDescription.years || 'All years'}
- Firm(s): ${stats.filterDescription.firms || 'All firms'}
- Tags/search: ${stats.filterDescription.tags || 'None'}

AGGREGATE STATISTICS FOR THIS SUBSET:
- Total decisions: ${stats.totalCases}
- Upheld: ${stats.upheldCount} (${stats.upheldRate.toFixed(1)}%)
- Not upheld: ${stats.notUpheldCount} (${stats.notUpheldRate.toFixed(1)}%)
- Partially upheld: ${stats.partialCount} (${stats.partialRate.toFixed(1)}%)

TOP ROOT CAUSES (with upheld rates in this subset):
${rootCauseLines || '- No root cause data available'}

TOP CITED PRECEDENTS / REGULATORY REFERENCES:
${precedentLines || '- No precedent data available'}

VULNERABILITY FLAGS PRESENT:
${vulnerabilityLines || '- No vulnerability data available'}

OMBUDSMAN REASONING EXCERPTS (from ${stats.excerpts.length} representative decisions):
${excerptLines || 'No reasoning excerpts available.'}

Generate the following sections. Use markdown headings (##). Each section must be 2-3 substantial paragraphs minimum.

## Executive Overview
Summarise the key findings from this subset in 2 paragraphs. State the total volume, the upheld rate relative to the FOS overall average (~40%), and the dominant patterns. Highlight the single most significant finding or risk.

## Root Cause Analysis
Analyse WHY these complaints arose. For each of the top 3-5 root causes, what specific conduct triggered the complaints? What did the ombudsman reasoning reveal? What is the upheld rate for each root cause? Flag any root cause with an upheld rate above 50% as high-risk.

## What Distinguishes Upheld from Not-Upheld Outcomes
This is the most critical section. In NOT-UPHELD cases, what did firms do right? In UPHELD cases, where did firms fall short? Are there specific tests the ombudsman applied repeatedly?

## Regulatory & Precedent Implications
Which rules are most frequently invoked? Are there emerging patterns in how the ombudsman interprets specific provisions? How do vulnerability flags intersect with outcomes?

## Strategic Recommendations
Provide 5-7 specific, prioritised recommendations. Each should state the action, reference the evidence, and assign a priority: CRITICAL, HIGH, or MEDIUM.`;
}

interface SynthesisStats {
  totalCases: number;
  upheldCount: number;
  upheldRate: number;
  notUpheldCount: number;
  notUpheldRate: number;
  partialCount: number;
  partialRate: number;
  rootCauses: { label: string; count: number; upheldRate: number }[];
  precedents: { label: string; count: number; percentOfCases: number }[];
  vulnerabilities: { label: string; count: number; percentOfCases: number }[];
  excerpts: {
    decisionReference: string;
    outcome: string;
    productSector: string;
    firmName: string;
    decisionDate: string;
    reasoningText: string;
  }[];
  filterDescription: {
    products: string;
    outcomes: string;
    years: string;
    firms: string;
    tags: string;
  };
}

async function gatherSynthesisStats(filters: FOSDashboardFilters): Promise<SynthesisStats> {
  const filtered = buildFilteredCte(filters);

  // Get aggregate stats
  const [statsRows, rootCauseRows, precedentRows, vulnerabilityRows, excerptRows] = await Promise.all([
    DatabaseClient.query<Record<string, unknown>>(
      `${filtered.cteSql}
      SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE f.outcome_bucket = 'upheld')::INT AS upheld,
        COUNT(*) FILTER (WHERE f.outcome_bucket = 'not_upheld')::INT AS not_upheld,
        COUNT(*) FILTER (WHERE f.outcome_bucket = 'partially_upheld')::INT AS partial
      FROM filtered f`,
      filtered.params
    ),
    DatabaseClient.query<Record<string, unknown>>(
      `${filtered.cteSql}
      SELECT
        BTRIM(rc.value) AS label,
        COUNT(*)::INT AS count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE f.outcome_bucket = 'upheld') / NULLIF(COUNT(*), 0), 1) AS upheld_rate
      FROM filtered f
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.root_cause_tags, '[]'::jsonb)) AS rc(value)
      WHERE BTRIM(rc.value) <> ''
      GROUP BY BTRIM(rc.value)
      ORDER BY count DESC
      LIMIT 8`,
      filtered.params
    ),
    DatabaseClient.query<Record<string, unknown>>(
      `${filtered.cteSql}
      SELECT
        BTRIM(p.value) AS label,
        COUNT(*)::INT AS count
      FROM filtered f
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.precedents, '[]'::jsonb)) AS p(value)
      WHERE BTRIM(p.value) <> ''
      GROUP BY BTRIM(p.value)
      ORDER BY count DESC
      LIMIT 8`,
      filtered.params
    ),
    DatabaseClient.query<Record<string, unknown>>(
      `${filtered.cteSql}
      SELECT
        BTRIM(v.value) AS label,
        COUNT(*)::INT AS count
      FROM filtered f
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.vulnerability_flags, '[]'::jsonb)) AS v(value)
      WHERE BTRIM(v.value) <> ''
      GROUP BY BTRIM(v.value)
      ORDER BY count DESC
      LIMIT 6`,
      filtered.params
    ),
    DatabaseClient.query<Record<string, unknown>>(
      `${filtered.cteSql}
      SELECT
        f.decision_reference,
        f.outcome_bucket AS outcome,
        COALESCE(NULLIF(BTRIM(f.product_sector), ''), 'Unspecified') AS product_sector,
        COALESCE(NULLIF(BTRIM(f.business_name), ''), 'Unknown firm') AS firm_name,
        COALESCE(f.decision_date::TEXT, 'Unknown') AS decision_date,
        LEFT(COALESCE(f.ombudsman_reasoning_text, f.decision_logic, ''), 700) AS reasoning_text
      FROM filtered f
      WHERE f.ombudsman_reasoning_text IS NOT NULL OR f.decision_logic IS NOT NULL
      ORDER BY f.decision_date DESC NULLS LAST
      LIMIT 15`,
      filtered.params
    ),
  ]);

  const total = toInt(statsRows[0]?.total);
  const upheld = toInt(statsRows[0]?.upheld);
  const notUpheld = toInt(statsRows[0]?.not_upheld);
  const partial = toInt(statsRows[0]?.partial);
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return {
    totalCases: total,
    upheldCount: upheld,
    upheldRate: pct(upheld),
    notUpheldCount: notUpheld,
    notUpheldRate: pct(notUpheld),
    partialCount: partial,
    partialRate: pct(partial),
    rootCauses: rootCauseRows.map((r) => ({
      label: normalizeTagLabel(String(r.label || '')),
      count: toInt(r.count),
      upheldRate: toNumber(r.upheld_rate),
    })),
    precedents: precedentRows.map((r) => ({
      label: normalizeTagLabel(String(r.label || '')),
      count: toInt(r.count),
      percentOfCases: total > 0 ? (toInt(r.count) / total) * 100 : 0,
    })),
    vulnerabilities: vulnerabilityRows.map((r) => ({
      label: normalizeTagLabel(String(r.label || '')),
      count: toInt(r.count),
      percentOfCases: total > 0 ? (toInt(r.count) / total) * 100 : 0,
    })),
    excerpts: excerptRows
      .filter((r) => String(r.reasoning_text || '').trim().length > 50)
      .map((r) => ({
        decisionReference: String(r.decision_reference || 'Unknown'),
        outcome: String(r.outcome || 'unknown'),
        productSector: String(r.product_sector || 'Unspecified'),
        firmName: String(r.firm_name || 'Unknown firm'),
        decisionDate: String(r.decision_date || 'Unknown'),
        reasoningText: String(r.reasoning_text || '').trim(),
      })),
    filterDescription: {
      products: filters.products.join(', '),
      outcomes: filters.outcomes.join(', '),
      years: filters.years.join(', '),
      firms: filters.firms.join(', '),
      tags: [...filters.tags, filters.query].filter(Boolean).join(', '),
    },
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return errorResponse(startedAt, 413, 'Request body is too large.', { reason: 'request_too_large' });
    }

    const parsedBody = await readBoundedJson(request);
    if (parsedBody.error === 'request_too_large') {
      return errorResponse(startedAt, 413, 'Request body is too large.', { reason: 'request_too_large' });
    }
    if (parsedBody.error === 'invalid_json') {
      return errorResponse(startedAt, 400, 'Invalid JSON request body.', { reason: 'invalid_json' });
    }

    const raw = (parsedBody.body as { filters?: unknown } | null)?.filters;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return errorResponse(startedAt, 400, 'Missing filters in request body.', { reason: 'invalid_filters' });
    }

    const rawFilters = raw as Record<string, unknown>;
    const years = Array.isArray(rawFilters.years)
      ? rawFilters.years.filter((item): item is number => Number.isInteger(item) && item >= 1900 && item <= 2200).slice(0, 20)
      : [];

    const filters: FOSDashboardFilters = {
      years,
      outcomes: boundedOutcomes(rawFilters.outcomes),
      products: boundedStrings(rawFilters.products, 50),
      firms: boundedStrings(rawFilters.firms, 50),
      tags: boundedStrings(rawFilters.tags, 20),
      query: typeof rawFilters.query === 'string' ? rawFilters.query.trim().slice(0, 500) : '',
      page: 1,
      pageSize: 25,
    };

    await rateLimitOrThrow(
      clientKeyFromRequest(request, 'fos-synthesis'),
      SYNTHESIS_RATE_LIMIT,
      SYNTHESIS_RATE_WINDOW_MS
    );

    ensureDatabaseConfigured();
    await ensureFosDecisionsTableExists();

    const stats = await gatherSynthesisStats(filters);

    if (stats.totalCases < 5) {
      return errorResponse(
        startedAt,
        400,
        `Too few decisions (${stats.totalCases}) for meaningful analysis. Apply fewer filters.`,
        { reason: 'insufficient_sample', totalCases: stats.totalCases }
      );
    }

    const narrative = await callGroq(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(stats) },
      ],
      { maxTokens: 2500, temperature: 0.3 }
    );

    const result: FOSSubsetAnalysis = {
      narrative,
      rootCauses: stats.rootCauses.slice(0, 5),
      precedents: stats.precedents.slice(0, 5),
      totalCases: stats.totalCases,
      upheldRate: stats.upheldRate,
    };

    logSynthesisMetric(startedAt, 200, { totalCases: stats.totalCases, cached: false });

    return Response.json(
      {
        success: true,
        data: result,
        meta: {
          cached: false,
          queryMs: Date.now() - startedAt,
          snapshotAt: new Date().toISOString(),
        },
      } satisfies FOSSynthesisApiResponse,
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return errorResponse(
        startedAt,
        error.status,
        'Too many analysis requests. Please try again later.',
        { reason: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds },
        { 'Retry-After': String(error.retryAfterSeconds) }
      );
    }

    const internalMessage = error instanceof Error ? error.message : 'Unknown synthesis failure.';
    return errorResponse(
      startedAt,
      500,
      'AI analysis service is temporarily unavailable. Please try again later.',
      { reason: 'synthesis_failed', internalMessage }
    );
  }
}
