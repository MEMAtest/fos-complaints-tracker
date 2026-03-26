/**
 * Offline generation script for FOS Advisor Briefs.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npx tsx scripts/generate-advisor-briefs.ts
 *   DATABASE_URL="postgres://..." GROQ_API_KEY="..." npx tsx scripts/generate-advisor-briefs.ts --with-ai
 *
 * Flags:
 *   --with-ai   Enable AI narrative generation via Groq (requires GROQ_API_KEY)
 */

import { Pool } from 'pg';
import { callGroq } from './lib/groq-client';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const WITH_AI = process.argv.includes('--with-ai');
if (WITH_AI && !(process.env.GROQ_API_KEY || '').trim()) {
  console.error('ERROR: --with-ai requires GROQ_API_KEY environment variable.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=') ? { rejectUnauthorized: false } : false,
});

async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

async function ensureTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS fos_advisor_briefs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product TEXT NOT NULL,
      root_cause TEXT,
      total_cases INT NOT NULL,
      upheld_rate NUMERIC(5,2) NOT NULL,
      not_upheld_rate NUMERIC(5,2) NOT NULL,
      risk_level TEXT NOT NULL,
      trend_direction TEXT NOT NULL,
      year_trend JSONB NOT NULL,
      key_precedents JSONB NOT NULL,
      root_cause_patterns JSONB NOT NULL,
      what_wins JSONB NOT NULL,
      what_loses JSONB NOT NULL,
      ai_what_wins TEXT,
      ai_what_loses TEXT,
      ai_guidance TEXT,
      ai_executive_summary TEXT,
      outcome_distribution JSONB,
      vulnerabilities JSONB NOT NULL,
      sample_cases JSONB NOT NULL,
      recommended_actions JSONB NOT NULL,
      generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(product, root_cause)
    );
    CREATE INDEX IF NOT EXISTS idx_advisor_briefs_product ON fos_advisor_briefs(product);
  `);
  // Ensure new columns exist on older tables
  await query(`ALTER TABLE fos_advisor_briefs ADD COLUMN IF NOT EXISTS ai_executive_summary TEXT`);
  await query(`ALTER TABLE fos_advisor_briefs ADD COLUMN IF NOT EXISTS outcome_distribution JSONB`);
  console.log('Table fos_advisor_briefs ensured.');
}

const outcomeExpr = `
  CASE
    WHEN outcome IS NULL OR BTRIM(outcome) = '' THEN 'unknown'
    WHEN LOWER(outcome) LIKE '%not upheld%' THEN 'not_upheld'
    WHEN LOWER(outcome) LIKE '%did not uphold%' THEN 'not_upheld'
    WHEN LOWER(outcome) LIKE '%not_upheld%' THEN 'not_upheld'
    WHEN LOWER(outcome) LIKE '%partially upheld%' THEN 'partially_upheld'
    WHEN LOWER(outcome) LIKE '%partly upheld%' THEN 'partially_upheld'
    WHEN LOWER(outcome) LIKE '%partially_upheld%' THEN 'partially_upheld'
    WHEN LOWER(outcome) LIKE '%not settled%' THEN 'not_settled'
    WHEN LOWER(outcome) LIKE '%not_settled%' THEN 'not_settled'
    WHEN LOWER(outcome) LIKE '%settled%' THEN 'settled'
    WHEN LOWER(outcome) LIKE '%upheld%' THEN 'upheld'
    ELSE 'unknown'
  END
`;

function normalizeTag(label: string): string {
  return label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const AI_SYSTEM_PROMPT = `You are a Principal Compliance Analyst specialising in FOS complaint intelligence.
Generate three analytical sections for a pre-computed intelligence brief. Each section
must be 2-3 paragraphs of substantive, evidence-based analysis in formal British English.
Cite the statistics provided. Do not use filler phrases. Be specific and actionable.`;

function buildAiUserPrompt(data: {
  product: string;
  rootCause: string | null;
  totalCases: number;
  upheldRate: number;
  notUpheldRate: number;
  upholdRiskLevel: string;
  trendDirection: string;
  yearTrend: { year: number; upheldRate: number; total: number }[];
  keyPrecedents: { label: string; count: number; percentOfCases: number }[];
  rootCausePatterns: { label: string; count: number; upheldRate: number }[];
  vulnerabilities: { label: string; count: number; percentOfCases: number }[];
  upheldTexts: string[];
  notUpheldTexts: string[];
}): string {
  const yearTrendStr = data.yearTrend.map((y) => `${y.year}: ${y.upheldRate}% (${y.total} cases)`).join(', ');
  const precedentsStr = data.keyPrecedents.map((p) => `${p.label}: ${p.count} cases (${p.percentOfCases}%)`).join(', ');
  const rcStr = data.rootCausePatterns.map((r) => `${r.label}: ${r.count} cases (${r.upheldRate}% upheld)`).join(', ');
  const vulnStr = data.vulnerabilities.map((v) => `${v.label}: ${v.count} cases`).join(', ');

  return `Intelligence brief for: ${data.product}${data.rootCause ? ' / ' + data.rootCause : ''}

STATISTICS:
- Total cases: ${data.totalCases}
- Upheld rate: ${data.upheldRate}% (FOS overall average: ~40%)
- Not upheld rate: ${data.notUpheldRate}%
- Uphold risk: ${data.upholdRiskLevel} | Trend: ${data.trendDirection}
- Year trend: ${yearTrendStr || 'Insufficient data'}

TOP PRECEDENTS: ${precedentsStr || 'None'}
TOP ROOT CAUSES: ${rcStr || 'None'}
VULNERABILITY FLAGS: ${vulnStr || 'None'}

SAMPLE UPHELD REASONING (${data.upheldTexts.length} excerpts):
${data.upheldTexts.map((t, i) => `[${i + 1}] ${t}`).join('\n\n') || 'None available'}

SAMPLE NOT-UPHELD REASONING (${data.notUpheldTexts.length} excerpts):
${data.notUpheldTexts.map((t, i) => `[${i + 1}] ${t}`).join('\n\n') || 'None available'}

Generate FOUR sections in EXACTLY this format (use these exact delimiters):

=== EXECUTIVE SUMMARY ===
[2 paragraphs: overview of risk profile, volume, trend, and the single most important finding.]

=== WHAT WINS CASES (Firm Defences That Succeed) ===
[2-3 paragraphs: Analyse not-upheld decisions. What evidence and processes persuaded the ombudsman?]

=== WHAT LOSES CASES (Common Firm Failures) ===
[2-3 paragraphs: Analyse upheld decisions. What failures led to upheld findings?]

=== GUIDANCE ===
[2-3 paragraphs: 4-6 specific recommendations tied to the data.]`;
}

function parseAiSections(text: string): { executiveSummary: string; whatWins: string; whatLoses: string; guidance: string } {
  const sections = { executiveSummary: '', whatWins: '', whatLoses: '', guidance: '' };
  const parts = text.split(/===\s*/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('EXECUTIVE SUMMARY')) {
      sections.executiveSummary = trimmed.replace(/^EXECUTIVE SUMMARY\s*===?\s*/, '').trim();
    } else if (trimmed.startsWith('WHAT WINS')) {
      sections.whatWins = trimmed.replace(/^WHAT WINS[^=]*===?\s*/, '').trim();
    } else if (trimmed.startsWith('WHAT LOSES')) {
      sections.whatLoses = trimmed.replace(/^WHAT LOSES[^=]*===?\s*/, '').trim();
    } else if (trimmed.startsWith('GUIDANCE')) {
      sections.guidance = trimmed.replace(/^GUIDANCE\s*===?\s*/, '').trim();
    }
  }
  return sections;
}

async function generateBrief(product: string, rootCause: string | null): Promise<void> {
  const params: unknown[] = [product];
  let rcFilter = '';
  if (rootCause) {
    rcFilter = `AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(root_cause_tags, '[]'::jsonb)) AS rt(value)
      WHERE LOWER(BTRIM(rt.value)) = LOWER($2)
    )`;
    params.push(rootCause);
  }
  const paramOffset = params.length;

  // Stats
  const stats = await queryOne<Record<string, unknown>>(`
    SELECT
      COUNT(*)::INT AS total_cases,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpr} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpr} = 'not_upheld') / NULLIF(COUNT(*), 0), 2) AS not_upheld_rate
    FROM fos_decisions
    WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1
    ${rcFilter}
  `, params);

  const totalCases = Number(stats?.total_cases || 0);
  if (totalCases === 0) return;

  const upheldRate = Number(stats?.upheld_rate || 0);
  const notUpheldRate = Number(stats?.not_upheld_rate || 0);

  // Outcome distribution
  const outcomeRows = await query<Record<string, unknown>>(`
    SELECT ${outcomeExpr} AS outcome, COUNT(*)::INT AS count
    FROM fos_decisions
    WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1
    ${rcFilter}
    GROUP BY ${outcomeExpr}
    ORDER BY count DESC
  `, params);
  const outcomeDistribution = outcomeRows.map((r) => ({ outcome: String(r.outcome), count: Number(r.count) }));

  // Year trend
  const yearTrendRows = await query<Record<string, unknown>>(`
    SELECT
      EXTRACT(YEAR FROM decision_date)::INT AS year,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpr} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
      COUNT(*)::INT AS total
    FROM fos_decisions
    WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1
    ${rcFilter}
    AND decision_date IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM decision_date)
    HAVING COUNT(*) >= 3
    ORDER BY year
  `, params);
  const yearTrend = yearTrendRows.map((r) => ({ year: Number(r.year), upheldRate: Number(r.upheld_rate), total: Number(r.total) }));

  const upholdRiskLevel = upheldRate >= 60 ? 'very_high' : upheldRate >= 45 ? 'high' : upheldRate >= 30 ? 'medium' : 'low';
  let trendDirection = 'stable';
  if (yearTrend.length >= 2) {
    const recent = yearTrend[yearTrend.length - 1].upheldRate;
    const prior = yearTrend[yearTrend.length - 2].upheldRate;
    if (recent > prior + 5) trendDirection = 'worsening';
    else if (recent < prior - 5) trendDirection = 'improving';
  }

  // Precedents
  const precRows = await query<Record<string, unknown>>(`
    SELECT BTRIM(p.value) AS label, COUNT(*)::INT AS count,
      ROUND(100.0 * COUNT(*) / $${paramOffset + 1}::NUMERIC, 1) AS pct
    FROM fos_decisions d, jsonb_array_elements_text(COALESCE(d.precedents, '[]'::jsonb)) AS p(value)
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1 ${rcFilter}
    GROUP BY BTRIM(p.value) ORDER BY count DESC LIMIT 10
  `, [...params, totalCases]);
  const keyPrecedents = precRows.map((r) => ({ label: normalizeTag(String(r.label)), count: Number(r.count), percentOfCases: Number(r.pct) }));

  // Root cause patterns
  const rcRows = await query<Record<string, unknown>>(`
    SELECT BTRIM(rc.value) AS label, COUNT(*)::INT AS count,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpr} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate
    FROM fos_decisions d, jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rc(value)
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1 ${rcFilter}
    GROUP BY BTRIM(rc.value) ORDER BY count DESC LIMIT 12
  `, params);
  const rootCausePatterns = rcRows.map((r) => ({ label: normalizeTag(String(r.label)), count: Number(r.count), upheldRate: Number(r.upheld_rate) }));

  // Vulnerabilities
  const vulnRows = await query<Record<string, unknown>>(`
    SELECT BTRIM(v.value) AS label, COUNT(*)::INT AS count,
      ROUND(100.0 * COUNT(*) / $${paramOffset + 1}::NUMERIC, 1) AS pct
    FROM fos_decisions d, jsonb_array_elements_text(COALESCE(d.vulnerability_flags, '[]'::jsonb)) AS v(value)
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1 ${rcFilter}
    GROUP BY BTRIM(v.value) ORDER BY count DESC LIMIT 8
  `, [...params, totalCases]);
  const vulnerabilities = vulnRows.map((r) => ({ label: normalizeTag(String(r.label)), count: Number(r.count), percentOfCases: Number(r.pct) }));

  // Sample cases — expanded to 10 upheld + 10 not upheld = 20
  const caseIdExpr = `COALESCE(NULLIF(decision_reference, ''), NULLIF(pdf_sha256, ''), MD5(CONCAT_WS('|', COALESCE(pdf_url, ''), COALESCE(source_url, ''), COALESCE(business_name, ''), COALESCE(decision_date::TEXT, ''))))`;

  const sampleUpheld = await query<Record<string, unknown>>(`
    SELECT ${caseIdExpr} AS case_id, decision_reference, decision_date,
      COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm_name,
      ${outcomeExpr} AS outcome, decision_summary, root_cause_tags, precedents
    FROM fos_decisions
    WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1 ${rcFilter}
    AND ${outcomeExpr} = 'upheld'
    ORDER BY decision_date DESC NULLS LAST LIMIT 10
  `, params);

  const sampleNotUpheld = await query<Record<string, unknown>>(`
    SELECT ${caseIdExpr} AS case_id, decision_reference, decision_date,
      COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm_name,
      ${outcomeExpr} AS outcome, decision_summary, root_cause_tags, precedents
    FROM fos_decisions
    WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1 ${rcFilter}
    AND ${outcomeExpr} = 'not_upheld'
    ORDER BY decision_date DESC NULLS LAST LIMIT 10
  `, params);

  const mapCase = (r: Record<string, unknown>) => ({
    caseId: String(r.case_id || r.decision_reference || ''),
    decisionReference: String(r.decision_reference || ''),
    decisionDate: r.decision_date ? new Date(r.decision_date as string).toISOString().split('T')[0] : null,
    firmName: r.firm_name ? String(r.firm_name) : null,
    outcome: String(r.outcome || 'unknown'),
    decisionSummary: r.decision_summary ? String(r.decision_summary) : null,
    rootCauseTags: parseJsonArray(r.root_cause_tags),
    precedents: parseJsonArray(r.precedents),
  });
  const sampleCases = [...sampleUpheld.map(mapCase), ...sampleNotUpheld.map(mapCase)];

  // Recommended actions
  const recommendedActions: { item: string; source: string; priority: string }[] = [];
  for (const p of keyPrecedents.slice(0, 3)) {
    recommendedActions.push({
      item: `Review ${p.label} precedent (appears in ${p.percentOfCases}% of cases)`,
      source: 'precedent',
      priority: p.percentOfCases > 20 ? 'critical' : 'important',
    });
  }
  for (const rc of rootCausePatterns.filter((r) => r.upheldRate > 50).slice(0, 3)) {
    recommendedActions.push({
      item: `Address "${rc.label}" root cause (${rc.upheldRate}% upheld rate)`,
      source: 'root_cause',
      priority: rc.upheldRate > 65 ? 'critical' : 'important',
    });
  }
  for (const v of vulnerabilities.slice(0, 2)) {
    recommendedActions.push({
      item: `Ensure vulnerability protections for "${v.label}" consumers (${v.percentOfCases}% of cases)`,
      source: 'vulnerability',
      priority: Number(v.percentOfCases) > 15 ? 'critical' : 'recommended',
    });
  }

  // AI generation (opt-in)
  let aiWhatWins: string | null = null;
  let aiWhatLoses: string | null = null;
  let aiGuidance: string | null = null;
  let aiExecutiveSummary: string | null = null;

  if (WITH_AI && totalCases >= 10) {
    try {
      // Fetch reasoning texts for AI analysis (shorter excerpts to reduce token count)
      const upheldTexts = await query<{ text: string }>(`
        SELECT LEFT(COALESCE(ombudsman_reasoning_text, '') || E'\n' || COALESCE(decision_logic, ''), 400) AS text
        FROM fos_decisions
        WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1
        ${rcFilter}
        AND ${outcomeExpr} = 'upheld'
        AND (ombudsman_reasoning_text IS NOT NULL OR decision_logic IS NOT NULL)
        ORDER BY decision_date DESC NULLS LAST
        LIMIT 3
      `, params);

      const notUpheldTexts = await query<{ text: string }>(`
        SELECT LEFT(COALESCE(ombudsman_reasoning_text, '') || E'\n' || COALESCE(decision_logic, ''), 400) AS text
        FROM fos_decisions
        WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1
        ${rcFilter}
        AND ${outcomeExpr} = 'not_upheld'
        AND (ombudsman_reasoning_text IS NOT NULL OR decision_logic IS NOT NULL)
        ORDER BY decision_date DESC NULLS LAST
        LIMIT 3
      `, params);

      const prompt = buildAiUserPrompt({
        product,
        rootCause,
        totalCases,
        upheldRate,
        notUpheldRate,
        upholdRiskLevel,
        trendDirection,
        yearTrend: yearTrend.slice(-5),
        keyPrecedents: keyPrecedents.slice(0, 5),
        rootCausePatterns: rootCausePatterns.slice(0, 5),
        vulnerabilities: vulnerabilities.slice(0, 4),
        upheldTexts: upheldTexts.map((r) => r.text).filter((t) => t.trim().length > 50),
        notUpheldTexts: notUpheldTexts.map((r) => r.text).filter((t) => t.trim().length > 50),
      });

      // Retry with backoff on 429 (Groq free tier: 12k TPM)
      let aiResponse: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          aiResponse = await callGroq(
            [
              { role: 'system', content: AI_SYSTEM_PROMPT },
              { role: 'user', content: prompt },
            ],
            { maxTokens: 1500, temperature: 0.3 }
          );
          break;
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          if (msg.includes('429') && attempt < 2) {
            const backoff = 20_000 * (attempt + 1);
            console.log(`    Rate limited, waiting ${backoff / 1000}s (attempt ${attempt + 1}/3)...`);
            await delay(backoff);
          } else {
            throw retryErr;
          }
        }
      }

      if (aiResponse) {
        const sections = parseAiSections(aiResponse);
        aiExecutiveSummary = sections.executiveSummary || null;
        aiWhatWins = sections.whatWins || null;
        aiWhatLoses = sections.whatLoses || null;
        aiGuidance = sections.guidance || null;
      }

      // Rate limit: 15s between Groq calls (12k TPM free tier)
      await delay(15_000);
    } catch (err) {
      console.error(`    AI generation failed for ${product}/${rootCause || 'all'}:`, err instanceof Error ? err.message : err);
    }
  }

  // UPSERT
  await query(`
    INSERT INTO fos_advisor_briefs (
      product, root_cause, total_cases, upheld_rate, not_upheld_rate,
      risk_level, trend_direction, year_trend, key_precedents,
      root_cause_patterns, what_wins, what_loses, ai_what_wins, ai_what_loses,
      ai_guidance, ai_executive_summary, outcome_distribution,
      vulnerabilities, sample_cases, recommended_actions, generated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8::jsonb, $9::jsonb,
      $10::jsonb, $11::jsonb, $12::jsonb, $13, $14,
      $15, $16, $17::jsonb,
      $18::jsonb, $19::jsonb, $20::jsonb, NOW()
    )
    ON CONFLICT (product, root_cause) DO UPDATE SET
      total_cases = EXCLUDED.total_cases, upheld_rate = EXCLUDED.upheld_rate,
      not_upheld_rate = EXCLUDED.not_upheld_rate, risk_level = EXCLUDED.risk_level,
      trend_direction = EXCLUDED.trend_direction, year_trend = EXCLUDED.year_trend,
      key_precedents = EXCLUDED.key_precedents, root_cause_patterns = EXCLUDED.root_cause_patterns,
      what_wins = EXCLUDED.what_wins, what_loses = EXCLUDED.what_loses,
      ai_what_wins = COALESCE(EXCLUDED.ai_what_wins, fos_advisor_briefs.ai_what_wins),
      ai_what_loses = COALESCE(EXCLUDED.ai_what_loses, fos_advisor_briefs.ai_what_loses),
      ai_guidance = COALESCE(EXCLUDED.ai_guidance, fos_advisor_briefs.ai_guidance),
      ai_executive_summary = COALESCE(EXCLUDED.ai_executive_summary, fos_advisor_briefs.ai_executive_summary),
      outcome_distribution = EXCLUDED.outcome_distribution,
      vulnerabilities = EXCLUDED.vulnerabilities,
      sample_cases = EXCLUDED.sample_cases, recommended_actions = EXCLUDED.recommended_actions,
      generated_at = NOW()
  `, [
    product, rootCause, totalCases, upheldRate, notUpheldRate,
    upholdRiskLevel, trendDirection, JSON.stringify(yearTrend), JSON.stringify(keyPrecedents),
    JSON.stringify(rootCausePatterns), JSON.stringify([]), JSON.stringify([]), aiWhatWins, aiWhatLoses,
    aiGuidance, aiExecutiveSummary, JSON.stringify(outcomeDistribution),
    JSON.stringify(vulnerabilities), JSON.stringify(sampleCases), JSON.stringify(recommendedActions),
  ]);
}

function parseJsonArray(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { return []; }
  }
  return [];
}

async function main() {
  console.log(`Starting FOS Advisor Brief generation${WITH_AI ? ' (with AI narratives)' : ''}...\n`);

  await ensureTable();

  // Get all distinct products
  const productRows = await query<{ product: string }>(`
    SELECT DISTINCT COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product
    FROM fos_decisions
    ORDER BY product
  `);
  console.log(`Found ${productRows.length} distinct products.\n`);

  let generated = 0;
  let skipped = 0;
  let aiGenerated = 0;

  for (const { product } of productRows) {
    // Product-level brief (root_cause = NULL)
    try {
      await generateBrief(product, null);
      generated++;
      console.log(`  [${generated}] ${product} (product-level)`);
    } catch (err) {
      console.error(`  FAILED: ${product} (product-level):`, err);
      skipped++;
    }

    // Get root causes for this product
    const rcRows = await query<{ root_cause: string }>(`
      SELECT DISTINCT BTRIM(rc.value) AS root_cause
      FROM fos_decisions d, jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rc(value)
      WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
      AND BTRIM(rc.value) != ''
      ORDER BY root_cause
    `, [product]);

    for (const { root_cause } of rcRows) {
      try {
        await generateBrief(product, root_cause);
        generated++;
        if (generated % 10 === 0) console.log(`  [${generated}] ${product} / ${root_cause}`);
      } catch (err) {
        console.error(`  FAILED: ${product} / ${root_cause}:`, err);
        skipped++;
      }
    }
  }

  if (WITH_AI) {
    const aiCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::INT AS count FROM fos_advisor_briefs WHERE ai_executive_summary IS NOT NULL`
    );
    aiGenerated = Number(aiCount?.count || 0);
  }

  // Final count
  const countRow = await queryOne<{ count: string }>('SELECT COUNT(*)::INT AS count FROM fos_advisor_briefs');
  console.log(`\nDone. Generated ${generated} briefs (${skipped} skipped). Total in DB: ${countRow?.count || 0}.`);
  if (WITH_AI) console.log(`AI narratives populated: ${aiGenerated}.`);

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
