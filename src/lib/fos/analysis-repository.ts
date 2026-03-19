import { DatabaseClient } from '@/lib/database';
import {
  FOSAnalysisSnapshot,
  FOSDashboardFilters,
  FOSYearNarrative,
  FOSYearProductOutcomeCell,
} from './types';
import {
  buildFilteredAggregateCte,
  buildFilteredTagCte,
  ensureDatabaseConfigured,
  ensureFosDecisionsTableExists,
  hasActiveScopeFilters,
  hasTagValues,
  normalizeLabel,
  normalizeTagLabel,
  nullableString,
  outcomeExpression,
  percentage,
  querySummarySnapshot,
  SUMMARY_SNAPSHOT_KEYS,
  toInt,
  toNumber,
} from './repo-helpers';

export async function getAnalysisSnapshot(
  filters: FOSDashboardFilters,
  options: { includeTagMatrix?: boolean } = {}
): Promise<FOSAnalysisSnapshot> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();

  const includeTagMatrix = options.includeTagMatrix ?? true;
  if (!hasActiveScopeFilters(filters)) {
    const summary = await querySummarySnapshot<FOSAnalysisSnapshot>(SUMMARY_SNAPSHOT_KEYS.analysis);
    if (summary) {
      return summary;
    }
  }

  const [
    yearProductOutcomeRows,
    firmBenchmarkRows,
    precedentRootCauseRows,
    productTree,
    topFirmByYear,
    monthlyProductBreakdown,
    decisionDayMonthGrid,
  ] = await Promise.all([
    queryYearProductOutcome(filters),
    queryFirmBenchmark(filters),
    includeTagMatrix ? queryPrecedentRootCauseMatrix(filters) : Promise.resolve([]),
    queryProductTree(filters),
    queryTopFirmByYear(filters),
    queryMonthlyProductBreakdown(filters),
    queryDecisionDayMonthGrid(filters),
  ]);

  const yearProductOutcome = yearProductOutcomeRows.map((row) => ({
    year: toInt(row.year),
    product: normalizeLabel(row.product, 'Unspecified'),
    total: toInt(row.total),
    upheld: toInt(row.upheld),
    notUpheld: toInt(row.not_upheld),
    partiallyUpheld: toInt(row.partially_upheld),
    upheldRate: toNumber(row.upheld_rate),
    notUpheldRate: toNumber(row.not_upheld_rate),
  }));

  const firmBenchmark = firmBenchmarkRows.map((row) => ({
    firm: normalizeLabel(row.firm, 'Unknown firm'),
    total: toInt(row.total),
    upheldRate: toNumber(row.upheld_rate),
    notUpheldRate: toNumber(row.not_upheld_rate),
    avgDecisionYear: row.avg_decision_year == null ? null : Math.round(toNumber(row.avg_decision_year)),
    predominantProduct: nullableString(row.predominant_product),
  }));

  const precedentRootCauseMatrix = precedentRootCauseRows.map((row) => ({
    precedent: normalizeTagLabel(String(row.precedent || 'unknown')),
    rootCause: normalizeTagLabel(String(row.root_cause || 'unknown')),
    count: toInt(row.count),
  }));

  const yearNarratives = buildYearNarratives(yearProductOutcome, topFirmByYear);

  return {
    yearProductOutcome,
    firmBenchmark,
    precedentRootCauseMatrix,
    productTree,
    yearNarratives,
    monthlyProductBreakdown,
    decisionDayMonthGrid,
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function queryYearProductOutcome(filters: FOSDashboardFilters): Promise<Record<string, unknown>[]> {
  if (!hasActiveScopeFilters(filters)) {
    return DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT
          EXTRACT(YEAR FROM d.decision_date)::INT AS year,
          COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS product,
          COUNT(*)::INT AS total,
          COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::INT AS upheld,
          COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld')::INT AS not_upheld,
          COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'partially_upheld')::INT AS partially_upheld,
          ROUND(
            COALESCE(
              COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::NUMERIC
              / NULLIF(COUNT(*), 0) * 100,
              0
            ),
            2
          ) AS upheld_rate,
          ROUND(
            COALESCE(
              COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld')::NUMERIC
              / NULLIF(COUNT(*), 0) * 100,
              0
            ),
            2
          ) AS not_upheld_rate
        FROM fos_decisions d
        WHERE d.decision_date IS NOT NULL
        GROUP BY EXTRACT(YEAR FROM d.decision_date)::INT, COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')
        ORDER BY year ASC, total DESC, product ASC
      `
    );
  }

  const filtered = buildFilteredAggregateCte(filters);
  return DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT
        EXTRACT(YEAR FROM decision_date)::INT AS year,
        COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::INT AS upheld,
        COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::INT AS not_upheld,
        COUNT(*) FILTER (WHERE outcome_bucket = 'partially_upheld')::INT AS partially_upheld,
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
      WHERE decision_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM decision_date)::INT, COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
      ORDER BY year ASC, total DESC, product ASC
    `,
    filtered.params
  );
}

async function queryFirmBenchmark(filters: FOSDashboardFilters): Promise<Record<string, unknown>[]> {
  if (!hasActiveScopeFilters(filters)) {
    return DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm,
          COUNT(*)::INT AS total,
          ROUND(
            COALESCE(
              COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::NUMERIC
              / NULLIF(COUNT(*), 0) * 100,
              0
            ),
            2
          ) AS upheld_rate,
          ROUND(
            COALESCE(
              COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld')::NUMERIC
              / NULLIF(COUNT(*), 0) * 100,
              0
            ),
            2
          ) AS not_upheld_rate,
          ROUND(AVG(EXTRACT(YEAR FROM d.decision_date)))::INT AS avg_decision_year,
          MODE() WITHIN GROUP (ORDER BY COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')) AS predominant_product
        FROM fos_decisions d
        GROUP BY COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm')
        ORDER BY total DESC, firm ASC
        LIMIT 120
      `
    );
  }

  const filtered = buildFilteredAggregateCte(filters);
  return DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
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
        ) AS not_upheld_rate,
        ROUND(AVG(EXTRACT(YEAR FROM decision_date)))::INT AS avg_decision_year,
        MODE() WITHIN GROUP (ORDER BY COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')) AS predominant_product
      FROM filtered
      GROUP BY COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')
      ORDER BY total DESC, firm ASC
      LIMIT 120
    `,
    filtered.params
  );
}

async function queryPrecedentRootCauseMatrix(filters: FOSDashboardFilters): Promise<Record<string, unknown>[]> {
  const [hasPrecedentValues, hasRootCauseValues] = await Promise.all([
    hasTagValues('precedents'),
    hasTagValues('root_cause_tags'),
  ]);
  if (!hasPrecedentValues || !hasRootCauseValues) return [];

  if (!hasActiveScopeFilters(filters)) {
    return DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT
          LOWER(BTRIM(p.value)) AS precedent,
          LOWER(BTRIM(rc.value)) AS root_cause,
          COUNT(*)::INT AS count
        FROM fos_decisions d
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.precedents, '[]'::jsonb)) AS p(value)
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rc(value)
        WHERE BTRIM(p.value) <> '' AND BTRIM(rc.value) <> ''
        GROUP BY LOWER(BTRIM(p.value)), LOWER(BTRIM(rc.value))
        ORDER BY count DESC, precedent ASC, root_cause ASC
        LIMIT 180
      `
    );
  }

  const filtered = buildFilteredTagCte(filters);
  return DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT
        LOWER(BTRIM(p.value)) AS precedent,
        LOWER(BTRIM(rc.value)) AS root_cause,
        COUNT(*)::INT AS count
      FROM filtered f
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.precedents, '[]'::jsonb)) AS p(value)
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.root_cause_tags, '[]'::jsonb)) AS rc(value)
      WHERE BTRIM(p.value) <> '' AND BTRIM(rc.value) <> ''
      GROUP BY LOWER(BTRIM(p.value)), LOWER(BTRIM(rc.value))
      ORDER BY count DESC, precedent ASC, root_cause ASC
      LIMIT 180
    `,
    filtered.params
  );
}

async function queryProductTree(
  filters: FOSDashboardFilters
): Promise<Array<{ product: string; total: number; firms: Array<{ firm: string; total: number; upheldRate: number }> }>> {
  const rows = !hasActiveScopeFilters(filters)
    ? await DatabaseClient.query<Record<string, unknown>>(
        `
          WITH product_totals AS (
            SELECT
              COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS product,
              COUNT(*)::INT AS product_total
            FROM fos_decisions d
            GROUP BY COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')
          ),
          ranked_products AS (
            SELECT
              product,
              product_total,
              ROW_NUMBER() OVER (ORDER BY product_total DESC, product ASC) AS product_rank
            FROM product_totals
          ),
          firm_totals AS (
            SELECT
              COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS product,
              COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm,
              COUNT(*)::INT AS total,
              ROUND(
                COALESCE(
                  COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::NUMERIC
                  / NULLIF(COUNT(*), 0) * 100,
                  0
                ),
                2
              ) AS upheld_rate
            FROM fos_decisions d
            GROUP BY
              COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified'),
              COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm')
          ),
          ranked_firms AS (
            SELECT
              product,
              firm,
              total,
              upheld_rate,
              ROW_NUMBER() OVER (PARTITION BY product ORDER BY total DESC, firm ASC) AS firm_rank
            FROM firm_totals
          )
          SELECT
            rp.product,
            rp.product_total AS total,
            rf.firm,
            rf.total AS firm_total,
            rf.upheld_rate,
            rf.firm_rank
          FROM ranked_products rp
          LEFT JOIN ranked_firms rf
            ON rf.product = rp.product
           AND rf.firm_rank <= 10
          WHERE rp.product_rank <= 16
          ORDER BY rp.product_total DESC, rp.product ASC, rf.firm_rank ASC NULLS LAST, rf.firm ASC NULLS LAST
        `
      )
    : await (async () => {
        const filtered = buildFilteredAggregateCte(filters);
        return DatabaseClient.query<Record<string, unknown>>(
          `
            ${filtered.cteSql}
            ,
            product_totals AS (
              SELECT
                COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
                COUNT(*)::INT AS product_total
              FROM filtered
              GROUP BY COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
            ),
            ranked_products AS (
              SELECT
                product,
                product_total,
                ROW_NUMBER() OVER (ORDER BY product_total DESC, product ASC) AS product_rank
              FROM product_totals
            ),
            firm_totals AS (
              SELECT
                COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
                COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm,
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
              GROUP BY
                COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified'),
                COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')
            ),
            ranked_firms AS (
              SELECT
                product,
                firm,
                total,
                upheld_rate,
                ROW_NUMBER() OVER (PARTITION BY product ORDER BY total DESC, firm ASC) AS firm_rank
              FROM firm_totals
            )
            SELECT
              rp.product,
              rp.product_total AS total,
              rf.firm,
              rf.total AS firm_total,
              rf.upheld_rate,
              rf.firm_rank
            FROM ranked_products rp
            LEFT JOIN ranked_firms rf
              ON rf.product = rp.product
             AND rf.firm_rank <= 10
            WHERE rp.product_rank <= 16
            ORDER BY rp.product_total DESC, rp.product ASC, rf.firm_rank ASC NULLS LAST, rf.firm ASC NULLS LAST
          `,
          filtered.params
        );
      })();

  const productTreeMap = new Map<string, { product: string; total: number; firms: Array<{ firm: string; total: number; upheldRate: number }> }>();
  for (const row of rows) {
    const product = normalizeLabel(row.product, 'Unspecified');
    const node =
      productTreeMap.get(product) ||
      {
        product,
        total: toInt(row.total),
        firms: [],
      };

    if (nullableString(row.firm)) {
      node.firms.push({
        firm: normalizeLabel(row.firm, 'Unknown firm'),
        total: toInt(row.firm_total),
        upheldRate: toNumber(row.upheld_rate),
      });
    }

    productTreeMap.set(product, node);
  }

  return Array.from(productTreeMap.values());
}

async function queryTopFirmByYear(filters: FOSDashboardFilters): Promise<Array<{ year: number; firm: string }>> {
  const rows = !hasActiveScopeFilters(filters)
    ? await DatabaseClient.query<Record<string, unknown>>(
        `
          WITH ranked AS (
            SELECT
              EXTRACT(YEAR FROM d.decision_date)::INT AS year,
              COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm,
              COUNT(*)::INT AS total,
              ROW_NUMBER() OVER (
                PARTITION BY EXTRACT(YEAR FROM d.decision_date)::INT
                ORDER BY COUNT(*) DESC, COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') ASC
              ) AS rank_in_year
            FROM fos_decisions d
            WHERE d.decision_date IS NOT NULL
            GROUP BY EXTRACT(YEAR FROM d.decision_date)::INT, COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm')
          )
          SELECT year, firm
          FROM ranked
          WHERE rank_in_year = 1
          ORDER BY year ASC
        `
      )
    : await (async () => {
        const filtered = buildFilteredAggregateCte(filters);
        return DatabaseClient.query<Record<string, unknown>>(
          `
            ${filtered.cteSql}
            ,
            ranked AS (
              SELECT
                EXTRACT(YEAR FROM decision_date)::INT AS year,
                COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm,
                COUNT(*)::INT AS total,
                ROW_NUMBER() OVER (
                  PARTITION BY EXTRACT(YEAR FROM decision_date)::INT
                  ORDER BY COUNT(*) DESC, COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') ASC
                ) AS rank_in_year
              FROM filtered
              WHERE decision_date IS NOT NULL
              GROUP BY EXTRACT(YEAR FROM decision_date)::INT, COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')
            )
            SELECT year, firm
            FROM ranked
            WHERE rank_in_year = 1
            ORDER BY year ASC
          `,
          filtered.params
        );
      })();

  return rows.map((row) => ({
    year: toInt(row.year),
    firm: normalizeLabel(row.firm, 'Unknown firm'),
  }));
}

async function queryMonthlyProductBreakdown(
  filters: FOSDashboardFilters
): Promise<{ month: string; product: string; count: number }[]> {
  const hasFilters = hasActiveScopeFilters(filters);
  const filtered = hasFilters ? buildFilteredAggregateCte(filters) : null;
  const rows = hasFilters
    ? await DatabaseClient.query<Record<string, unknown>>(
        `
          ${filtered!.cteSql}
          SELECT
            TO_CHAR(decision_date, 'YYYY-MM') AS month,
            COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
            COUNT(*)::INT AS count
          FROM filtered
          WHERE decision_date IS NOT NULL
          GROUP BY TO_CHAR(decision_date, 'YYYY-MM'),
                   COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
          ORDER BY month ASC, count DESC
        `,
        filtered!.params
      )
    : await DatabaseClient.query<Record<string, unknown>>(
        `
          SELECT
            TO_CHAR(d.decision_date, 'YYYY-MM') AS month,
            COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS product,
            COUNT(*)::INT AS count
          FROM fos_decisions d
          WHERE d.decision_date IS NOT NULL
          GROUP BY TO_CHAR(d.decision_date, 'YYYY-MM'),
                   COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')
          ORDER BY month ASC, count DESC
        `
      );
  return rows.map((row) => ({
    month: String(row.month),
    product: String(row.product),
    count: toInt(row.count),
  }));
}

async function queryDecisionDayMonthGrid(
  filters: FOSDashboardFilters
): Promise<{ month: number; dayOfWeek: number; count: number }[]> {
  const hasFilters = hasActiveScopeFilters(filters);
  const filtered = hasFilters ? buildFilteredAggregateCte(filters) : null;
  const rows = hasFilters
    ? await DatabaseClient.query<Record<string, unknown>>(
        `
          ${filtered!.cteSql}
          SELECT
            EXTRACT(MONTH FROM decision_date)::INT AS month,
            EXTRACT(DOW FROM decision_date)::INT AS day_of_week,
            COUNT(*)::INT AS count
          FROM filtered
          WHERE decision_date IS NOT NULL
          GROUP BY EXTRACT(MONTH FROM decision_date)::INT,
                   EXTRACT(DOW FROM decision_date)::INT
          ORDER BY month ASC, day_of_week ASC
        `,
        filtered!.params
      )
    : await DatabaseClient.query<Record<string, unknown>>(
        `
          SELECT
            EXTRACT(MONTH FROM d.decision_date)::INT AS month,
            EXTRACT(DOW FROM d.decision_date)::INT AS day_of_week,
            COUNT(*)::INT AS count
          FROM fos_decisions d
          WHERE d.decision_date IS NOT NULL
          GROUP BY EXTRACT(MONTH FROM d.decision_date)::INT,
                   EXTRACT(DOW FROM d.decision_date)::INT
          ORDER BY month ASC, day_of_week ASC
        `
      );
  return rows.map((row) => ({
    month: toInt(row.month),
    dayOfWeek: toInt(row.day_of_week),
    count: toInt(row.count),
  }));
}

function buildYearNarratives(
  yearProductOutcome: FOSYearProductOutcomeCell[],
  topFirmByYear: Array<{ year: number; firm: string }>
): FOSYearNarrative[] {
  if (!yearProductOutcome.length) return [];

  const byYear = new Map<number, FOSYearProductOutcomeCell[]>();
  for (const row of yearProductOutcome) {
    const list = byYear.get(row.year) || [];
    list.push(row);
    byYear.set(row.year, list);
  }

  const topFirmLookup = new Map<number, string>();
  for (const item of topFirmByYear) {
    if (!item.year || !item.firm) continue;
    topFirmLookup.set(item.year, item.firm);
  }

  const sortedYears = Array.from(byYear.keys()).sort((a, b) => a - b);
  const yearlyTotals = sortedYears.map((year) => {
    const items = byYear.get(year) || [];
    const total = items.reduce((sum, item) => sum + item.total, 0);
    const upheld = items.reduce((sum, item) => sum + item.upheld, 0);
    const topProduct = [...items].sort((a, b) => b.total - a.total || a.product.localeCompare(b.product))[0]?.product || null;
    return {
      year,
      total,
      upheldRate: percentage(upheld, total),
      topProduct,
    };
  });

  return yearlyTotals
    .map((item, index) => {
      const previous = yearlyTotals[index - 1];
      const delta = previous ? item.total - previous.total : null;
      const deltaLabel =
        delta == null
          ? 'baseline period'
          : `${delta > 0 ? '+' : ''}${delta.toLocaleString()} decisions vs prior year`;

      return {
        year: item.year,
        total: item.total,
        upheldRate: Number(item.upheldRate.toFixed(2)),
        changeVsPrior: delta,
        topProduct: item.topProduct,
        topFirm: topFirmLookup.get(item.year) || null,
        headline: `${item.year}: ${item.total.toLocaleString()} decisions (${item.upheldRate.toFixed(1)}% upheld)`,
        detail: `Trend ${deltaLabel}. Top product: ${item.topProduct || 'n/a'}. Highest-volume firm: ${
          topFirmLookup.get(item.year) || 'n/a'
        }.`,
      };
    })
    .sort((a, b) => b.year - a.year);
}
