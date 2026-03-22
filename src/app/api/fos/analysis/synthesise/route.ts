import { NextRequest } from 'next/server';
import { DatabaseClient } from '@/lib/database';
import { FOSDashboardFilters, FOSSubsetAnalysis } from '@/lib/fos/types';
import {
  buildFilteredCte,
  ensureDatabaseConfigured,
  ensureFosDecisionsTableExists,
  hasActiveScopeFilters,
  normalizeTagLabel,
  outcomeExpression,
  toInt,
  toNumber,
} from '@/lib/fos/repo-helpers';
import { callGroq } from '@/lib/fos/groq-client';
import { FOSSynthesisApiResponse } from '@/types/fos-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

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
    ensureDatabaseConfigured();
    await ensureFosDecisionsTableExists();

    const body = await request.json();
    const filters = body?.filters as FOSDashboardFilters | undefined;
    if (!filters) {
      return Response.json({ success: false, error: 'Missing filters in request body.' }, { status: 400 });
    }

    const stats = await gatherSynthesisStats(filters);

    if (stats.totalCases < 5) {
      return Response.json(
        { success: false, error: `Too few decisions (${stats.totalCases}) for meaningful analysis. Apply fewer filters.` },
        { status: 400 }
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
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate synthesis.',
      },
      { status: 500 }
    );
  }
}
