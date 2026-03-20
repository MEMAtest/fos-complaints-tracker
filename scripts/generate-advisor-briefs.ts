/**
 * Offline generation script for FOS Advisor Briefs.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npx tsx scripts/generate-advisor-briefs.ts
 *
 * This script:
 * 1. Creates the fos_advisor_briefs table if it doesn't exist
 * 2. Queries all distinct product × root_cause combos from fos_decisions
 * 3. For each combo, calls generateAndStoreAdvisorBrief() to compute stats
 *    (AI narratives can be added manually or via a separate process)
 *
 * For AI-enhanced briefs, the generation functions in repository.ts accept
 * an aiAnalysis parameter with whatWins/whatLoses/guidance narratives.
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
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
      vulnerabilities JSONB NOT NULL,
      sample_cases JSONB NOT NULL,
      recommended_actions JSONB NOT NULL,
      generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(product, root_cause)
    );
    CREATE INDEX IF NOT EXISTS idx_advisor_briefs_product ON fos_advisor_briefs(product);
  `);
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

  const riskLevel = upheldRate >= 60 ? 'very_high' : upheldRate >= 45 ? 'high' : upheldRate >= 30 ? 'medium' : 'low';
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

  // Sample cases
  const caseIdExpr = `COALESCE(NULLIF(decision_reference, ''), NULLIF(pdf_sha256, ''), MD5(CONCAT_WS('|', COALESCE(pdf_url, ''), COALESCE(source_url, ''), COALESCE(business_name, ''), COALESCE(decision_date::TEXT, ''))))`;

  const sampleUpheld = await query<Record<string, unknown>>(`
    SELECT ${caseIdExpr} AS case_id, decision_reference, decision_date,
      COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm_name,
      ${outcomeExpr} AS outcome, decision_summary, root_cause_tags, precedents
    FROM fos_decisions
    WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1 ${rcFilter}
    AND ${outcomeExpr} = 'upheld'
    ORDER BY decision_date DESC NULLS LAST LIMIT 3
  `, params);

  const sampleNotUpheld = await query<Record<string, unknown>>(`
    SELECT ${caseIdExpr} AS case_id, decision_reference, decision_date,
      COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm_name,
      ${outcomeExpr} AS outcome, decision_summary, root_cause_tags, precedents
    FROM fos_decisions
    WHERE COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') = $1 ${rcFilter}
    AND ${outcomeExpr} = 'not_upheld'
    ORDER BY decision_date DESC NULLS LAST LIMIT 2
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

  // UPSERT
  await query(`
    INSERT INTO fos_advisor_briefs (
      product, root_cause, total_cases, upheld_rate, not_upheld_rate,
      risk_level, trend_direction, year_trend, key_precedents,
      root_cause_patterns, what_wins, what_loses, ai_what_wins, ai_what_loses,
      ai_guidance, vulnerabilities, sample_cases, recommended_actions, generated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8::jsonb, $9::jsonb,
      $10::jsonb, $11::jsonb, $12::jsonb, $13, $14,
      $15, $16::jsonb, $17::jsonb, $18::jsonb, NOW()
    )
    ON CONFLICT (product, root_cause) DO UPDATE SET
      total_cases = EXCLUDED.total_cases, upheld_rate = EXCLUDED.upheld_rate,
      not_upheld_rate = EXCLUDED.not_upheld_rate, risk_level = EXCLUDED.risk_level,
      trend_direction = EXCLUDED.trend_direction, year_trend = EXCLUDED.year_trend,
      key_precedents = EXCLUDED.key_precedents, root_cause_patterns = EXCLUDED.root_cause_patterns,
      what_wins = EXCLUDED.what_wins, what_loses = EXCLUDED.what_loses,
      ai_what_wins = EXCLUDED.ai_what_wins, ai_what_loses = EXCLUDED.ai_what_loses,
      ai_guidance = EXCLUDED.ai_guidance, vulnerabilities = EXCLUDED.vulnerabilities,
      sample_cases = EXCLUDED.sample_cases, recommended_actions = EXCLUDED.recommended_actions,
      generated_at = NOW()
  `, [
    product, rootCause, totalCases, upheldRate, notUpheldRate,
    riskLevel, trendDirection, JSON.stringify(yearTrend), JSON.stringify(keyPrecedents),
    JSON.stringify(rootCausePatterns), JSON.stringify([]), JSON.stringify([]), null, null,
    null, JSON.stringify(vulnerabilities), JSON.stringify(sampleCases), JSON.stringify(recommendedActions),
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
  console.log('Starting FOS Advisor Brief generation...\n');

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

  // Final count
  const countRow = await queryOne<{ count: string }>('SELECT COUNT(*)::INT AS count FROM fos_advisor_briefs');
  console.log(`\nDone. Generated ${generated} briefs (${skipped} skipped). Total in DB: ${countRow?.count || 0}.`);

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
