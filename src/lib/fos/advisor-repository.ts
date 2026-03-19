import { DatabaseClient } from '@/lib/database';
import {
  FOSAdvisorBrief,
  FOSAdvisorChecklist,
  FOSAdvisorPrecedent,
  FOSAdvisorQuery,
  FOSAdvisorRootCausePattern,
  FOSAdvisorSampleCase,
  FOSAdvisorThemeExtract,
  FOSAdvisorVulnerability,
} from './types';
import {
  caseIdExpression,
  ensureDatabaseConfigured,
  isMissingRelationError,
  normalizeOutcome,
  normalizeTagLabel,
  nullableString,
  outcomeExpression,
  parseJsonValue,
  parseStringArray,
  toInt,
  toIsoDate,
  toNumber,
} from './repo-helpers';

export async function getAdvisorOptions(): Promise<{ products: string[]; rootCauses: string[] }> {
  ensureDatabaseConfigured();

  try {
    const [productRows, rootCauseRows] = await Promise.all([
      DatabaseClient.query<{ product: string }>(
        `SELECT DISTINCT product FROM fos_advisor_briefs WHERE total_cases > 0 ORDER BY product`
      ),
      DatabaseClient.query<{ root_cause: string }>(
        `SELECT DISTINCT root_cause FROM fos_advisor_briefs WHERE root_cause IS NOT NULL AND total_cases > 0 ORDER BY root_cause`
      ),
    ]);

    return {
      products: productRows.map((r) => r.product),
      rootCauses: rootCauseRows.map((r) => r.root_cause),
    };
  } catch (error) {
    if (isMissingRelationError(error, 'fos_advisor_briefs')) {
      return { products: [], rootCauses: [] };
    }
    throw error;
  }
}

export async function getAdvisorBrief(query: FOSAdvisorQuery): Promise<FOSAdvisorBrief | null> {
  ensureDatabaseConfigured();

  try {
    let row = await DatabaseClient.queryOne<Record<string, unknown>>(
      `SELECT * FROM fos_advisor_briefs WHERE product = $1 AND root_cause IS NOT DISTINCT FROM $2`,
      [query.product, query.rootCause]
    );

    if (!row && query.rootCause) {
      row = await DatabaseClient.queryOne<Record<string, unknown>>(
        `SELECT * FROM fos_advisor_briefs WHERE product = $1 AND root_cause IS NULL`,
        [query.product]
      );
    }

    if (!row) return null;

    const totalCases = toInt(row.total_cases);
    const upheldRate = toNumber(row.upheld_rate);
    const notUpheldRate = toNumber(row.not_upheld_rate);

    const yearTrend = parseJsonValue<{ year: number; upheldRate: number; total: number }[]>(row.year_trend) || [];
    const keyPrecedents = parseJsonValue<FOSAdvisorPrecedent[]>(row.key_precedents) || [];
    const rootCausePatterns = parseJsonValue<FOSAdvisorRootCausePattern[]>(row.root_cause_patterns) || [];
    const whatWins = parseJsonValue<FOSAdvisorThemeExtract[]>(row.what_wins) || [];
    const whatLoses = parseJsonValue<FOSAdvisorThemeExtract[]>(row.what_loses) || [];
    const vulnerabilities = parseJsonValue<FOSAdvisorVulnerability[]>(row.vulnerabilities) || [];
    let sampleCases = parseJsonValue<FOSAdvisorSampleCase[]>(row.sample_cases) || [];
    const recommendedActions = parseJsonValue<FOSAdvisorChecklist[]>(row.recommended_actions) || [];

    if (query.freeText && query.freeText.trim()) {
      const textCases = await queryAdvisorTextMatchCases(query.product, query.rootCause, query.freeText.trim(), 5);
      if (textCases.length > 0) {
        const existingIds = new Set(sampleCases.map((c) => c.caseId));
        const newCases = textCases.filter((c) => !existingIds.has(c.caseId));
        sampleCases = [...newCases, ...sampleCases].slice(0, 10);
      }
    }

    const overallRow = await DatabaseClient.queryOne<{ rate: string }>(
      `SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS rate FROM fos_decisions d`
    );
    const overallUpheldRate = toNumber(overallRow?.rate);

    const riskLevel = String(row.risk_level || 'medium') as FOSAdvisorBrief['riskAssessment']['riskLevel'];
    const trendDirection = String(row.trend_direction || 'stable') as FOSAdvisorBrief['riskAssessment']['trendDirection'];

    return {
      query: {
        product: String(row.product),
        rootCause: nullableString(row.root_cause),
        freeText: query.freeText,
      },
      generatedAt: toIsoDate(row.generated_at) || new Date().toISOString(),
      riskAssessment: {
        totalCases,
        upheldRate,
        notUpheldRate,
        overallUpheldRate,
        riskLevel,
        trendDirection,
        yearTrend,
      },
      keyPrecedents,
      rootCausePatterns,
      whatWins,
      whatLoses,
      aiWhatWins: nullableString(row.ai_what_wins),
      aiWhatLoses: nullableString(row.ai_what_loses),
      aiGuidance: nullableString(row.ai_guidance),
      vulnerabilities,
      sampleCases,
      recommendedActions,
    };
  } catch (error) {
    if (isMissingRelationError(error, 'fos_advisor_briefs')) {
      return null;
    }
    throw error;
  }
}

export async function getReasoningTextsForAdvisor(
  product: string,
  rootCause: string | null,
  outcome: 'upheld' | 'not_upheld',
  limit: number
): Promise<string[]> {
  ensureDatabaseConfigured();
  const params: unknown[] = [product, outcome, limit];
  let rootCauseFilter = '';

  if (rootCause) {
    rootCauseFilter = `AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rt(value)
      WHERE LOWER(BTRIM(rt.value)) = LOWER($4)
    )`;
    params.push(rootCause);
  }

  const rows = await DatabaseClient.query<{ text: string }>(
    `
    SELECT COALESCE(d.ombudsman_reasoning_text, '') || E'\n' || COALESCE(d.decision_logic, '') AS text
    FROM fos_decisions d
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    AND ${outcomeExpression('d')} = $2
    ${rootCauseFilter}
    AND (d.ombudsman_reasoning_text IS NOT NULL OR d.decision_logic IS NOT NULL)
    ORDER BY d.decision_date DESC NULLS LAST
    LIMIT $3
    `,
    params
  );

  return rows.map((r) => r.text).filter((t) => t.trim().length > 50);
}

export async function generateAndStoreAdvisorBrief(
  product: string,
  rootCause: string | null,
  aiAnalysis: { whatWins: string; whatLoses: string; guidance: string }
): Promise<void> {
  ensureDatabaseConfigured();

  const params: unknown[] = [product];
  let rootCauseFilter = '';
  if (rootCause) {
    rootCauseFilter = `AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rt(value)
      WHERE LOWER(BTRIM(rt.value)) = LOWER($2)
    )`;
    params.push(rootCause);
  }
  const paramOffset = params.length;

  const statsRow = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
    SELECT
      COUNT(*)::INT AS total_cases,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld') / NULLIF(COUNT(*), 0), 2) AS not_upheld_rate
    FROM fos_decisions d
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    ${rootCauseFilter}
    `,
    params
  );

  const totalCases = toInt(statsRow?.total_cases);
  const upheldRate = toNumber(statsRow?.upheld_rate);
  const notUpheldRate = toNumber(statsRow?.not_upheld_rate);

  if (totalCases === 0) return;

  const yearTrendRows = await DatabaseClient.query<Record<string, unknown>>(
    `
    SELECT
      EXTRACT(YEAR FROM d.decision_date)::INT AS year,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
      COUNT(*)::INT AS total
    FROM fos_decisions d
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    ${rootCauseFilter}
    AND d.decision_date IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM d.decision_date)
    HAVING COUNT(*) >= 3
    ORDER BY year
    `,
    params
  );
  const yearTrend = yearTrendRows.map((r) => ({
    year: toInt(r.year),
    upheldRate: toNumber(r.upheld_rate),
    total: toInt(r.total),
  }));

  const riskLevel = upheldRate >= 60 ? 'very_high' : upheldRate >= 45 ? 'high' : upheldRate >= 30 ? 'medium' : 'low';
  let trendDirection: 'improving' | 'stable' | 'worsening' = 'stable';
  if (yearTrend.length >= 2) {
    const recent = yearTrend[yearTrend.length - 1].upheldRate;
    const prior = yearTrend[yearTrend.length - 2].upheldRate;
    if (recent > prior + 5) trendDirection = 'worsening';
    else if (recent < prior - 5) trendDirection = 'improving';
  }

  const precedentRows = await DatabaseClient.query<Record<string, unknown>>(
    `
    SELECT
      BTRIM(p.value) AS label,
      COUNT(*)::INT AS count,
      ROUND(100.0 * COUNT(*) / $${paramOffset + 1}::NUMERIC, 1) AS pct
    FROM fos_decisions d,
      jsonb_array_elements_text(COALESCE(d.precedents, '[]'::jsonb)) AS p(value)
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    ${rootCauseFilter}
    GROUP BY BTRIM(p.value)
    ORDER BY count DESC
    LIMIT 10
    `,
    [...params, totalCases]
  );
  const keyPrecedents: FOSAdvisorPrecedent[] = precedentRows.map((r) => ({
    label: normalizeTagLabel(String(r.label || '')),
    count: toInt(r.count),
    percentOfCases: toNumber(r.pct),
  }));

  const rcRows = await DatabaseClient.query<Record<string, unknown>>(
    `
    SELECT
      BTRIM(rc.value) AS label,
      COUNT(*)::INT AS count,
      ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate
    FROM fos_decisions d,
      jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rc(value)
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    ${rootCauseFilter}
    GROUP BY BTRIM(rc.value)
    ORDER BY count DESC
    LIMIT 12
    `,
    params
  );
  const rootCausePatterns: FOSAdvisorRootCausePattern[] = rcRows.map((r) => ({
    label: normalizeTagLabel(String(r.label || '')),
    count: toInt(r.count),
    upheldRate: toNumber(r.upheld_rate),
  }));

  const vulnRows = await DatabaseClient.query<Record<string, unknown>>(
    `
    SELECT
      BTRIM(v.value) AS label,
      COUNT(*)::INT AS count,
      ROUND(100.0 * COUNT(*) / $${paramOffset + 1}::NUMERIC, 1) AS pct
    FROM fos_decisions d,
      jsonb_array_elements_text(COALESCE(d.vulnerability_flags, '[]'::jsonb)) AS v(value)
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    ${rootCauseFilter}
    GROUP BY BTRIM(v.value)
    ORDER BY count DESC
    LIMIT 8
    `,
    [...params, totalCases]
  );
  const vulnerabilities: FOSAdvisorVulnerability[] = vulnRows.map((r) => ({
    label: normalizeTagLabel(String(r.label || '')),
    count: toInt(r.count),
    percentOfCases: toNumber(r.pct),
  }));

  const sampleUpheld = await DatabaseClient.query<Record<string, unknown>>(
    `
    SELECT
      ${caseIdExpression('d')} AS case_id,
      d.decision_reference, d.decision_date,
      COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm_name,
      ${outcomeExpression('d')} AS outcome,
      d.decision_summary, d.root_cause_tags, d.precedents
    FROM fos_decisions d
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    ${rootCauseFilter}
    AND ${outcomeExpression('d')} = 'upheld'
    ORDER BY d.decision_date DESC NULLS LAST
    LIMIT 3
    `,
    params
  );
  const sampleNotUpheld = await DatabaseClient.query<Record<string, unknown>>(
    `
    SELECT
      ${caseIdExpression('d')} AS case_id,
      d.decision_reference, d.decision_date,
      COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm_name,
      ${outcomeExpression('d')} AS outcome,
      d.decision_summary, d.root_cause_tags, d.precedents
    FROM fos_decisions d
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    ${rootCauseFilter}
    AND ${outcomeExpression('d')} = 'not_upheld'
    ORDER BY d.decision_date DESC NULLS LAST
    LIMIT 2
    `,
    params
  );

  const mapSample = (r: Record<string, unknown>): FOSAdvisorSampleCase => ({
    caseId: String(r.case_id || r.decision_reference || ''),
    decisionReference: String(r.decision_reference || ''),
    decisionDate: toIsoDate(r.decision_date),
    firmName: nullableString(r.firm_name),
    outcome: normalizeOutcome(String(r.outcome || 'unknown')),
    decisionSummary: nullableString(r.decision_summary),
    rootCauseTags: parseStringArray(r.root_cause_tags),
    precedents: parseStringArray(r.precedents),
  });
  const sampleCases = [...sampleUpheld.map(mapSample), ...sampleNotUpheld.map(mapSample)];

  const recommendedActions: FOSAdvisorChecklist[] = [];

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
      priority: v.percentOfCases > 15 ? 'critical' : 'recommended',
    });
  }

  const whatWins: FOSAdvisorThemeExtract[] = extractThemes(aiAnalysis.whatWins);
  const whatLoses: FOSAdvisorThemeExtract[] = extractThemes(aiAnalysis.whatLoses);

  await DatabaseClient.query(
    `
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
      total_cases = EXCLUDED.total_cases,
      upheld_rate = EXCLUDED.upheld_rate,
      not_upheld_rate = EXCLUDED.not_upheld_rate,
      risk_level = EXCLUDED.risk_level,
      trend_direction = EXCLUDED.trend_direction,
      year_trend = EXCLUDED.year_trend,
      key_precedents = EXCLUDED.key_precedents,
      root_cause_patterns = EXCLUDED.root_cause_patterns,
      what_wins = EXCLUDED.what_wins,
      what_loses = EXCLUDED.what_loses,
      ai_what_wins = EXCLUDED.ai_what_wins,
      ai_what_loses = EXCLUDED.ai_what_loses,
      ai_guidance = EXCLUDED.ai_guidance,
      vulnerabilities = EXCLUDED.vulnerabilities,
      sample_cases = EXCLUDED.sample_cases,
      recommended_actions = EXCLUDED.recommended_actions,
      generated_at = NOW()
    `,
    [
      product,
      rootCause,
      totalCases,
      upheldRate,
      notUpheldRate,
      riskLevel,
      trendDirection,
      JSON.stringify(yearTrend),
      JSON.stringify(keyPrecedents),
      JSON.stringify(rootCausePatterns),
      JSON.stringify(whatWins),
      JSON.stringify(whatLoses),
      aiAnalysis.whatWins || null,
      aiAnalysis.whatLoses || null,
      aiAnalysis.guidance || null,
      JSON.stringify(vulnerabilities),
      JSON.stringify(sampleCases),
      JSON.stringify(recommendedActions),
    ]
  );
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function queryAdvisorTextMatchCases(
  product: string,
  rootCause: string | null,
  freeText: string,
  limit: number
): Promise<FOSAdvisorSampleCase[]> {
  const escaped = freeText.replace(/[%_\\]/g, '\\$&');
  const pattern = `%${escaped}%`;
  const params: unknown[] = [product, pattern, limit];
  let rootCauseFilter = '';

  if (rootCause) {
    rootCauseFilter = `AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rt(value)
      WHERE LOWER(BTRIM(rt.value)) = LOWER($4)
    )`;
    params.push(rootCause);
  }

  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
    SELECT
      ${caseIdExpression('d')} AS case_id,
      d.decision_reference,
      d.decision_date,
      COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm_name,
      ${outcomeExpression('d')} AS outcome,
      d.decision_summary,
      d.root_cause_tags,
      d.precedents
    FROM fos_decisions d
    WHERE COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1
    ${rootCauseFilter}
    AND (
      d.decision_summary ILIKE $2
      OR d.decision_logic ILIKE $2
      OR d.ombudsman_reasoning_text ILIKE $2
    )
    ORDER BY d.decision_date DESC NULLS LAST
    LIMIT $3
    `,
    params
  );

  return rows.map((row) => ({
    caseId: String(row.case_id || row.decision_reference || ''),
    decisionReference: String(row.decision_reference || ''),
    decisionDate: toIsoDate(row.decision_date),
    firmName: nullableString(row.firm_name),
    outcome: normalizeOutcome(String(row.outcome || 'unknown')),
    decisionSummary: nullableString(row.decision_summary),
    rootCauseTags: parseStringArray(row.root_cause_tags),
    precedents: parseStringArray(row.precedents),
  }));
}

function extractThemes(text: string): FOSAdvisorThemeExtract[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\n/).filter((l) => l.trim());
  const themes: FOSAdvisorThemeExtract[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[\s\-*•\d.]+/, '').trim();
    if (cleaned.length > 10 && cleaned.length < 300) {
      themes.push({ theme: cleaned, frequency: 1, sampleCaseIds: [] });
    }
  }
  return themes.slice(0, 8);
}
