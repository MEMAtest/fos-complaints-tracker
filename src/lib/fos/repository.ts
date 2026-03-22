import { DatabaseClient } from '@/lib/database';
import {
  FOSComparisonSnapshot,
  FOSDashboardFilters,
  FOSFirmComparisonData,
  FOSIngestionStatus,
  FOSRootCauseSnapshot,
  FOSTagCount,
} from './types';
import {
  buildFilteredTagCte,
  buildWhereClause,
  clamp,
  ensureDatabaseConfigured,
  ensureFosDecisionsTableExists,
  hasActiveScopeFilters,
  hasTagValues,
  normalizeLabel,
  normalizeTagLabel,
  outcomeExpression,
  queryIngestionStatus,
  querySummarySnapshot,
  SUMMARY_SNAPSHOT_KEYS,
  toInt,
  toIsoDate,
  toNumber,
  toObjectArray,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
} from './repo-helpers';

// ─── Barrel re-exports ───────────────────────────────────────────────────────

export { parseFilters, hasActiveScopeFilters } from './repo-helpers';
export { getDashboardSnapshot } from './dashboard-repository';
export { getAnalysisSnapshot } from './analysis-repository';
export { getCaseDetail, getCaseList, getSimilarCases, getCaseContext } from './cases-repository';
export {
  getAdvisorOptions,
  getAdvisorBrief,
  getReasoningTextsForAdvisor,
  generateAndStoreAdvisorBrief,
} from './advisor-repository';

// ─── Remaining functions ─────────────────────────────────────────────────────

export async function searchFirmDirectory(
  searchQuery: string,
  filters: FOSDashboardFilters,
  limit = 25
): Promise<Array<{ firm: string; totalCases: number; latestDecisionDate: string | null }>> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();

  const searchFilters: FOSDashboardFilters = {
    ...filters,
    query: '',
    firms: [],
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
  };
  const where = buildWhereClause(searchFilters, 'd', 1);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const safeLimit = clamp(limit, 1, 100);
  const firmExpression = `COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm')`;
  const params = [...where.params];
  let searchFilterSql = '';
  let orderSql = 'COUNT(*) DESC, firm ASC';

  if (normalizedSearch) {
    params.push(`${normalizedSearch}%`);
    const prefixIndex = params.length;
    params.push(`%${normalizedSearch}%`);
    const containsIndex = params.length;
    searchFilterSql = `AND LOWER(${firmExpression}) LIKE $${containsIndex}`;
    orderSql = `
      CASE
        WHEN LOWER(${firmExpression}) LIKE $${prefixIndex} THEN 0
        WHEN LOWER(${firmExpression}) LIKE $${containsIndex} THEN 1
        ELSE 2
      END ASC,
      COUNT(*) DESC,
      firm ASC
    `;
  }

  params.push(safeLimit);
  const limitIndex = params.length;

  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT
        ${firmExpression} AS firm,
        COUNT(*)::INT AS total_cases,
        MAX(d.decision_date) AS latest_decision_date
      FROM fos_decisions d
      ${where.whereSql || 'WHERE TRUE'}
      ${searchFilterSql}
      GROUP BY ${firmExpression}
      ORDER BY ${orderSql}
      LIMIT $${limitIndex}
    `,
    params
  );

  return rows.map((row) => ({
    firm: normalizeLabel(row.firm, 'Unknown firm'),
    totalCases: toInt(row.total_cases),
    latestDecisionDate: toIsoDate(row.latest_decision_date),
  }));
}

export async function getIngestionStatus(): Promise<FOSIngestionStatus> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();
  return queryIngestionStatus();
}

export async function getProgressSummary(startYear?: number): Promise<{
  years: Array<{ year: number; decisions: number }>;
  ingestion: FOSIngestionStatus;
}> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();

  const params: unknown[] = [];
  const whereParts = ['decision_date IS NOT NULL'];
  if (startYear && Number.isInteger(startYear)) {
    whereParts.push(`EXTRACT(YEAR FROM decision_date)::INT >= $${params.length + 1}`);
    params.push(startYear);
  }
  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [rows, ingestion] = await Promise.all([
    DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT
          EXTRACT(YEAR FROM decision_date)::INT AS year,
          COUNT(*)::INT AS decisions
        FROM fos_decisions
        ${whereSql}
        GROUP BY EXTRACT(YEAR FROM decision_date)::INT
        ORDER BY year ASC
      `,
      params
    ),
    queryIngestionStatus(),
  ]);

  return {
    years: rows.map((row) => ({
      year: toInt(row.year),
      decisions: toInt(row.decisions),
    })),
    ingestion,
  };
}

export async function getRootCauseSnapshot(
  filters: FOSDashboardFilters
): Promise<FOSRootCauseSnapshot> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();

  if (!hasActiveScopeFilters(filters)) {
    const summary = await querySummarySnapshot<FOSRootCauseSnapshot>(SUMMARY_SNAPSHOT_KEYS.rootCauses);
    if (summary) {
      return summary;
    }
  }

  const hasRootCauses = await hasTagValues('root_cause_tags');
  if (!hasRootCauses) {
    return { rootCauses: [], hierarchy: [], frequency: [] };
  }

  const filtered = buildFilteredTagCte(filters);
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql},
      tag_exploded AS (
        SELECT
          LOWER(BTRIM(tag.value)) AS tag_label,
          EXTRACT(YEAR FROM f.decision_date)::INT AS year
        FROM filtered f
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.root_cause_tags, '[]'::jsonb)) AS tag(value)
        WHERE BTRIM(tag.value) <> ''
      )
      SELECT
        tag_label,
        COUNT(*)::INT AS total,
        COALESCE(
          (
            SELECT jsonb_agg(row_to_json(yt) ORDER BY yt.year ASC)
            FROM (
              SELECT year, COUNT(*)::INT AS count
              FROM tag_exploded t2
              WHERE t2.tag_label = tag_exploded.tag_label AND t2.year IS NOT NULL
              GROUP BY year
            ) yt
          ),
          '[]'::jsonb
        ) AS trend
      FROM tag_exploded
      GROUP BY tag_label
      ORDER BY total DESC
      LIMIT 30
    `,
    filtered.params
  );

  const rootCauses = rows.map((row) => ({
    label: normalizeTagLabel(String(row.tag_label)),
    count: toInt(row.total),
    trend: toObjectArray(row.trend).map((t) => ({
      year: toInt(t.year),
      count: toInt(t.count),
    })),
  }));

  const categoryMap = new Map<string, Map<string, number>>();
  for (const rc of rootCauses) {
    const parts = rc.label.split(/[\s\-:\/]+/);
    const category = parts[0] || 'Other';
    if (!categoryMap.has(category)) categoryMap.set(category, new Map());
    categoryMap.get(category)!.set(rc.label, rc.count);
  }
  const hierarchy = Array.from(categoryMap.entries())
    .map(([name, children]) => ({
      name,
      children: Array.from(children.entries())
        .map(([childName, value]) => ({ name: childName, value }))
        .sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => {
      const aTotal = a.children.reduce((s, c) => s + c.value, 0);
      const bTotal = b.children.reduce((s, c) => s + c.value, 0);
      return bTotal - aTotal;
    });

  const frequency: FOSTagCount[] = rootCauses.map((rc) => ({
    label: rc.label,
    count: rc.count,
  }));

  return { rootCauses, hierarchy, frequency };
}

export async function getComparisonSnapshot(
  firmNames: string[],
  filters: FOSDashboardFilters
): Promise<FOSComparisonSnapshot> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();

  const firms = await Promise.all(
    firmNames.map((name) => queryFirmComparisonData(name, filters))
  );

  return { firms };
}

async function queryFirmComparisonData(
  firmName: string,
  filters: FOSDashboardFilters
): Promise<FOSFirmComparisonData> {
  const where = buildWhereClause(filters, 'd', 1);
  const firmIndex = where.nextIndex;
  const firmCondition = `COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') = $${firmIndex}`;
  const fullWhere = where.whereSql
    ? `${where.whereSql} AND ${firmCondition}`
    : `WHERE ${firmCondition}`;

  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT
        COUNT(*)::INT AS total_cases,
        ROUND(
          COALESCE(
            COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::NUMERIC
            / NULLIF(COUNT(*), 0) * 100, 0
          ), 2
        ) AS upheld_rate,
        ROUND(
          COALESCE(
            COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld')::NUMERIC
            / NULLIF(COUNT(*), 0) * 100, 0
          ), 2
        ) AS not_upheld_rate,
        COALESCE(
          (
            SELECT jsonb_agg(row_to_json(tp) ORDER BY tp.total DESC)
            FROM (
              SELECT
                COALESCE(NULLIF(BTRIM(d2.product_sector), ''), 'Unspecified') AS product,
                COUNT(*)::INT AS total,
                ROUND(
                  COALESCE(
                    COUNT(*) FILTER (WHERE ${outcomeExpression('d2')} = 'upheld')::NUMERIC
                    / NULLIF(COUNT(*), 0) * 100, 0
                  ), 2
                ) AS upheld_rate
              FROM fos_decisions d2
              WHERE COALESCE(NULLIF(BTRIM(d2.business_name), ''), 'Unknown firm') = $${firmIndex}
              GROUP BY COALESCE(NULLIF(BTRIM(d2.product_sector), ''), 'Unspecified')
              ORDER BY total DESC
              LIMIT 10
            ) tp
          ),
          '[]'::jsonb
        ) AS top_products,
        COALESCE(
          (
            SELECT jsonb_agg(row_to_json(yb) ORDER BY yb.year ASC)
            FROM (
              SELECT
                EXTRACT(YEAR FROM d3.decision_date)::INT AS year,
                COUNT(*)::INT AS total,
                ROUND(
                  COALESCE(
                    COUNT(*) FILTER (WHERE ${outcomeExpression('d3')} = 'upheld')::NUMERIC
                    / NULLIF(COUNT(*), 0) * 100, 0
                  ), 2
                ) AS upheld_rate
              FROM fos_decisions d3
              WHERE COALESCE(NULLIF(BTRIM(d3.business_name), ''), 'Unknown firm') = $${firmIndex}
                AND d3.decision_date IS NOT NULL
              GROUP BY EXTRACT(YEAR FROM d3.decision_date)::INT
              ORDER BY year ASC
            ) yb
          ),
          '[]'::jsonb
        ) AS year_breakdown
      FROM fos_decisions d
      ${fullWhere}
    `,
    [...where.params, firmName]
  );

  const row = rows[0] || {};
  return {
    name: firmName,
    totalCases: toInt(row.total_cases),
    upheldRate: toNumber(row.upheld_rate),
    notUpheldRate: toNumber(row.not_upheld_rate),
    topProducts: toObjectArray(row.top_products).map((p) => ({
      product: normalizeLabel(p.product, 'Unspecified'),
      total: toInt(p.total),
      upheldRate: toNumber(p.upheld_rate),
    })),
    yearBreakdown: toObjectArray(row.year_breakdown).map((y) => ({
      year: toInt(y.year),
      total: toInt(y.total),
      upheldRate: toNumber(y.upheld_rate),
    })),
  };
}
