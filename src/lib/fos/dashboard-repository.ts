import { DatabaseClient } from '@/lib/database';
import {
  FOSDashboardFilters,
  FOSDashboardSnapshot,
  FOSYearInsight,
} from './types';
import {
  buildFilteredAggregateCte,
  clamp,
  DashboardSummaryPayload,
  ensureDatabaseConfigured,
  ensureFosDecisionsTableExists,
  hasActiveScopeFilters,
  normalizeLabel,
  normalizeOutcome,
  normalizeTagLabel,
  outcomeExpression,
  percentage,
  queryFilterOptions,
  queryIngestionStatus,
  querySummarySnapshot,
  queryTagFrequency,
  SUMMARY_SNAPSHOT_KEYS,
  toInt,
  toIsoDate,
  toNumber,
  toObjectArray,
} from './repo-helpers';
import { queryCases } from './cases-repository';

export async function getDashboardSnapshot(
  filters: FOSDashboardFilters,
  options: { includeCases?: boolean } = {}
): Promise<FOSDashboardSnapshot> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();
  const includeCases = options.includeCases ?? true;
  const hasScopeFilters = hasActiveScopeFilters(filters);

  if (!hasScopeFilters) {
    const [summary, ingestion] = await Promise.all([
      querySummarySnapshot<DashboardSummaryPayload>(SUMMARY_SNAPSHOT_KEYS.dashboard),
      queryIngestionStatus(),
    ]);

    if (summary) {
      const totalCases = summary.overview.totalCases;
      const caseBundle = includeCases
        ? await queryCases(filters, totalCases)
        : {
            items: [],
            pagination: {
              page: clamp(Math.max(1, filters.page), 1, Math.max(1, Math.ceil(totalCases / filters.pageSize))),
              pageSize: filters.pageSize,
              total: totalCases,
              totalPages: Math.max(1, Math.ceil(totalCases / filters.pageSize)),
            },
          };

      return {
        ...summary,
        cases: caseBundle.items,
        pagination: caseBundle.pagination,
        ingestion,
      };
    }
  }

  const precedentsPromise = hasScopeFilters ? queryTagFrequency(filters, 'precedents', 12) : Promise.resolve([]);
  const rootCausesPromise = hasScopeFilters ? queryTagFrequency(filters, 'root_cause_tags', 12) : Promise.resolve([]);

  const [
    aggregateRow,
    precedentRows,
    rootCauseRows,
    filterOptions,
    ingestion,
  ] = await Promise.all([
    queryDashboardAggregateBundle(filters),
    precedentsPromise,
    rootCausesPromise,
    queryFilterOptions(),
    queryIngestionStatus(),
  ]);

  const totalCases = toInt(aggregateRow?.total_cases);

  const caseBundle = includeCases
    ? await queryCases(filters, totalCases)
    : {
        items: [],
        pagination: {
          page: clamp(Math.max(1, filters.page), 1, Math.max(1, Math.ceil(totalCases / filters.pageSize))),
          pageSize: filters.pageSize,
          total: totalCases,
          totalPages: Math.max(1, Math.ceil(totalCases / filters.pageSize)),
        },
      };

  const overview = {
    totalCases,
    upheldCases: toInt(aggregateRow?.upheld_cases),
    notUpheldCases: toInt(aggregateRow?.not_upheld_cases),
    partiallyUpheldCases: toInt(aggregateRow?.partially_upheld_cases),
    upheldRate: toNumber(aggregateRow?.upheld_rate),
    notUpheldRate: toNumber(aggregateRow?.not_upheld_rate),
    topRootCause: rootCauseRows[0]?.label ? normalizeTagLabel(String(rootCauseRows[0].label)) : null,
    topPrecedent: precedentRows[0]?.label ? normalizeTagLabel(String(precedentRows[0].label)) : null,
    earliestDecisionDate: toIsoDate(aggregateRow?.earliest_decision_date),
    latestDecisionDate: toIsoDate(aggregateRow?.latest_decision_date),
  };

  const trends = toObjectArray(aggregateRow?.trends).map((row) => ({
    year: toInt(row.year),
    total: toInt(row.total),
    upheld: toInt(row.upheld),
    notUpheld: toInt(row.not_upheld),
    partiallyUpheld: toInt(row.partially_upheld),
    unknown: toInt(row.unknown_count),
  }));

  const outcomes = toObjectArray(aggregateRow?.outcomes).map((row) => ({
    outcome: normalizeOutcome(String(row.outcome || 'unknown')),
    count: toInt(row.count),
  }));

  const products = toObjectArray(aggregateRow?.products).map((row) => ({
    product: normalizeLabel(row.product, 'Unspecified'),
    total: toInt(row.total),
    upheldRate: toNumber(row.upheld_rate),
  }));

  const firms = toObjectArray(aggregateRow?.firms).map((row) => ({
    firm: normalizeLabel(row.firm, 'Unknown firm'),
    total: toInt(row.total),
    upheldRate: toNumber(row.upheld_rate),
    notUpheldRate: toNumber(row.not_upheld_rate),
  }));

  const precedents = precedentRows.map((row) => ({
    label: normalizeTagLabel(String(row.label || 'unknown')),
    count: toInt(row.count),
  }));

  const rootCauses = rootCauseRows.map((row) => ({
    label: normalizeTagLabel(String(row.label || 'unknown')),
    count: toInt(row.count),
  }));

  const insights = await queryYearInsights(trends);

  return {
    overview,
    trends,
    outcomes,
    products,
    firms,
    precedents,
    rootCauses,
    insights,
    cases: caseBundle.items,
    pagination: caseBundle.pagination,
    filters: filterOptions,
    ingestion,
    dataQuality: {
      missingDecisionDate: toInt(aggregateRow?.missing_decision_date),
      missingOutcome: toInt(aggregateRow?.missing_outcome),
      withReasoningText: toInt(aggregateRow?.with_reasoning_text),
    },
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function queryDashboardAggregateBundle(filters: FOSDashboardFilters): Promise<Record<string, unknown> | null> {
  if (!hasActiveScopeFilters(filters)) {
    const rows = await DatabaseClient.query<Record<string, unknown>>(
      `
        WITH base AS MATERIALIZED (
          SELECT
            d.decision_date,
            d.business_name,
            d.product_sector,
            d.ombudsman_reasoning_text,
            ${outcomeExpression('d')} AS outcome_bucket
          FROM fos_decisions d
        )
        SELECT
          (SELECT COUNT(*)::INT FROM base) AS total_cases,
          (SELECT COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::INT FROM base) AS upheld_cases,
          (SELECT COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::INT FROM base) AS not_upheld_cases,
          (SELECT COUNT(*) FILTER (WHERE outcome_bucket = 'partially_upheld')::INT FROM base) AS partially_upheld_cases,
          (
            SELECT ROUND(
              COALESCE(
                COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC
                / NULLIF(COUNT(*), 0) * 100,
                0
              ),
              2
            )
            FROM base
          ) AS upheld_rate,
          (
            SELECT ROUND(
              COALESCE(
                COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::NUMERIC
                / NULLIF(COUNT(*), 0) * 100,
                0
              ),
              2
            )
            FROM base
          ) AS not_upheld_rate,
          (SELECT MIN(decision_date) FROM base) AS earliest_decision_date,
          (SELECT MAX(decision_date) FROM base) AS latest_decision_date,
          (SELECT COUNT(*) FILTER (WHERE decision_date IS NULL)::INT FROM base) AS missing_decision_date,
          (SELECT COUNT(*) FILTER (WHERE outcome_bucket = 'unknown')::INT FROM base) AS missing_outcome,
          (
            SELECT COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(ombudsman_reasoning_text, '')), '') IS NOT NULL)::INT
            FROM base
          ) AS with_reasoning_text,
          COALESCE(
            (
              SELECT jsonb_agg(row_to_json(t) ORDER BY t.year)
              FROM (
                SELECT
                  EXTRACT(YEAR FROM decision_date)::INT AS year,
                  COUNT(*)::INT AS total,
                  COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::INT AS upheld,
                  COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::INT AS not_upheld,
                  COUNT(*) FILTER (WHERE outcome_bucket = 'partially_upheld')::INT AS partially_upheld,
                  COUNT(*) FILTER (WHERE outcome_bucket = 'unknown')::INT AS unknown_count
                FROM base
                WHERE decision_date IS NOT NULL
                GROUP BY EXTRACT(YEAR FROM decision_date)::INT
              ) t
            ),
            '[]'::jsonb
          ) AS trends,
          COALESCE(
            (
              SELECT jsonb_agg(row_to_json(o) ORDER BY o.count DESC, o.outcome ASC)
              FROM (
                SELECT outcome_bucket AS outcome, COUNT(*)::INT AS count
                FROM base
                GROUP BY outcome_bucket
              ) o
            ),
            '[]'::jsonb
          ) AS outcomes,
          COALESCE(
            (
              SELECT jsonb_agg(row_to_json(p) ORDER BY p.total DESC, p.product ASC)
              FROM (
                SELECT
                  COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
                  COUNT(*)::INT AS total,
                  ROUND(
                    COALESCE(
                      COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC
                      / NULLIF(COUNT(*), 0) * 100,
                      0
                    ),
                    2
                  ) AS upheld_rate
                FROM base
                GROUP BY COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
                ORDER BY total DESC, product ASC
                LIMIT 12
              ) p
            ),
            '[]'::jsonb
          ) AS products,
          COALESCE(
            (
              SELECT jsonb_agg(row_to_json(fm) ORDER BY fm.total DESC, fm.firm ASC)
              FROM (
                SELECT
                  COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm,
                  COUNT(*)::INT AS total,
                  ROUND(
                    COALESCE(
                      COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC
                      / NULLIF(COUNT(*), 0) * 100,
                      0
                    ),
                    2
                  ) AS upheld_rate,
                  ROUND(
                    COALESCE(
                      COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::NUMERIC
                      / NULLIF(COUNT(*), 0) * 100,
                      0
                    ),
                    2
                  ) AS not_upheld_rate
                FROM base
                GROUP BY COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')
                ORDER BY total DESC, firm ASC
                LIMIT 15
              ) fm
            ),
            '[]'::jsonb
          ) AS firms
      `
    );

    return rows[0] || null;
  }

  const filtered = buildFilteredAggregateCte(filters);
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT
        (SELECT COUNT(*)::INT FROM filtered) AS total_cases,
        (SELECT COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::INT FROM filtered) AS upheld_cases,
        (SELECT COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::INT FROM filtered) AS not_upheld_cases,
        (SELECT COUNT(*) FILTER (WHERE outcome_bucket = 'partially_upheld')::INT FROM filtered) AS partially_upheld_cases,
        (
          SELECT ROUND(
            COALESCE(
              COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC
              / NULLIF(COUNT(*), 0) * 100,
              0
            ),
            2
          )
          FROM filtered
        ) AS upheld_rate,
        (
          SELECT ROUND(
            COALESCE(
              COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::NUMERIC
              / NULLIF(COUNT(*), 0) * 100,
              0
            ),
            2
          )
          FROM filtered
        ) AS not_upheld_rate,
        (SELECT MIN(decision_date) FROM filtered) AS earliest_decision_date,
        (SELECT MAX(decision_date) FROM filtered) AS latest_decision_date,
        (SELECT COUNT(*) FILTER (WHERE decision_date IS NULL)::INT FROM filtered) AS missing_decision_date,
        (SELECT COUNT(*) FILTER (WHERE outcome_bucket = 'unknown')::INT FROM filtered) AS missing_outcome,
        (
          SELECT COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(ombudsman_reasoning_text, '')), '') IS NOT NULL)::INT
          FROM filtered
        ) AS with_reasoning_text,
        COALESCE(
          (
            SELECT jsonb_agg(row_to_json(t) ORDER BY t.year)
            FROM (
              SELECT
                EXTRACT(YEAR FROM decision_date)::INT AS year,
                COUNT(*)::INT AS total,
                COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::INT AS upheld,
                COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::INT AS not_upheld,
                COUNT(*) FILTER (WHERE outcome_bucket = 'partially_upheld')::INT AS partially_upheld,
                COUNT(*) FILTER (WHERE outcome_bucket = 'unknown')::INT AS unknown_count
              FROM filtered
              WHERE decision_date IS NOT NULL
              GROUP BY EXTRACT(YEAR FROM decision_date)::INT
            ) t
          ),
          '[]'::jsonb
        ) AS trends,
        COALESCE(
          (
            SELECT jsonb_agg(row_to_json(o) ORDER BY o.count DESC, o.outcome ASC)
            FROM (
              SELECT outcome_bucket AS outcome, COUNT(*)::INT AS count
              FROM filtered
              GROUP BY outcome_bucket
            ) o
          ),
          '[]'::jsonb
        ) AS outcomes,
        COALESCE(
          (
            SELECT jsonb_agg(row_to_json(p) ORDER BY p.total DESC, p.product ASC)
            FROM (
              SELECT
                COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
                COUNT(*)::INT AS total,
                ROUND(
                  COALESCE(
                    COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC
                    / NULLIF(COUNT(*), 0) * 100,
                    0
                  ),
                  2
                ) AS upheld_rate
              FROM filtered
              GROUP BY COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
              ORDER BY total DESC, product ASC
              LIMIT 12
            ) p
          ),
          '[]'::jsonb
        ) AS products,
        COALESCE(
          (
            SELECT jsonb_agg(row_to_json(fm) ORDER BY fm.total DESC, fm.firm ASC)
            FROM (
              SELECT
                COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm,
                COUNT(*)::INT AS total,
                ROUND(
                  COALESCE(
                    COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC
                    / NULLIF(COUNT(*), 0) * 100,
                    0
                  ),
                  2
                ) AS upheld_rate,
                ROUND(
                  COALESCE(
                    COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::NUMERIC
                    / NULLIF(COUNT(*), 0) * 100,
                    0
                  ),
                  2
                ) AS not_upheld_rate
              FROM filtered
              GROUP BY COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')
              ORDER BY total DESC, firm ASC
              LIMIT 15
            ) fm
          ),
          '[]'::jsonb
        ) AS firms
    `,
    filtered.params
  );

  return rows[0] || null;
}

async function queryYearInsights(trends: Array<{ year: number; total: number; upheld: number; notUpheld: number }>): Promise<FOSYearInsight[]> {
  if (!trends.length) return [];

  const sorted = [...trends].sort((a, b) => a.year - b.year);
  const insights: FOSYearInsight[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index];
    const upheldRate = percentage(item.upheld, item.total);
    const previous = sorted[index - 1];
    const delta = previous ? item.total - previous.total : null;
    const deltaText =
      delta == null
        ? 'baseline year in the current filter window'
        : `${delta > 0 ? '+' : ''}${delta} vs prior year`;

    insights.push({
      year: item.year,
      headline: `${item.year}: ${item.total.toLocaleString()} decisions, ${upheldRate.toFixed(1)}% upheld`,
      detail: `Upheld ${item.upheld.toLocaleString()} vs not upheld ${item.notUpheld.toLocaleString()}. Volume trend: ${deltaText}.`,
    });
  }

  return insights.sort((a, b) => b.year - a.year);
}
