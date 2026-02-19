import { DatabaseClient } from '@/lib/database';
import {
  FOSCaseDetail,
  FOSCaseListItem,
  FOSDashboardFilters,
  FOSDashboardSnapshot,
  FOSFilterOptions,
  FOSIngestionStatus,
  FOSOutcome,
  FOSYearInsight,
} from './types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const TABLE_CHECK_TTL_MS = 60_000;
const SUPPORTED_OUTCOMES: FOSOutcome[] = [
  'upheld',
  'not_upheld',
  'partially_upheld',
  'settled',
  'not_settled',
  'unknown',
];

const DEFAULT_INGESTION_STATUS: FOSIngestionStatus = {
  status: 'idle',
  source: 'derived',
  lastRunAt: null,
  lastSuccessAt: null,
  activeYear: null,
  windowsDone: null,
  windowsTotal: null,
  failedWindows: null,
  recordsIngested: null,
};

type WhereBuildResult = {
  whereSql: string;
  params: unknown[];
  nextIndex: number;
};

type CteBuildResult = {
  cteSql: string;
  params: unknown[];
  nextIndex: number;
};

let tableCheckCache: { exists: boolean; checkedAt: number } | null = null;
let tagPresenceCache:
  | {
      checkedAt: number;
      precedents: boolean;
      rootCauseTags: boolean;
    }
  | null = null;

export function parseFilters(searchParams: URLSearchParams): FOSDashboardFilters {
  const years = parseIntegerList(searchParams, 'year');
  const outcomes = parseStringList(searchParams, 'outcome')
    .map((value) => normalizeOutcome(value))
    .filter((value, index, all) => all.indexOf(value) === index);

  return {
    query: (searchParams.get('query') || '').trim(),
    years,
    outcomes,
    products: parseStringList(searchParams, 'product'),
    firms: parseStringList(searchParams, 'firm'),
    tags: parseStringList(searchParams, 'tag').map((value) => value.toLowerCase()),
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_PAGE),
    pageSize: clamp(parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE), 5, MAX_PAGE_SIZE),
  };
}

export async function getDashboardSnapshot(filters: FOSDashboardFilters): Promise<FOSDashboardSnapshot> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();

  const [
    overviewRow,
    trendsRows,
    outcomesRows,
    productsRows,
    firmsRows,
    precedentsRows,
    rootCauseRows,
    qualityRow,
    caseBundle,
    options,
    ingestion,
  ] = await Promise.all([
    queryOverview(filters),
    queryTrends(filters),
    queryOutcomeDistribution(filters),
    queryProducts(filters),
    queryFirms(filters),
    queryTagFrequency(filters, 'precedents', 12),
    queryTagFrequency(filters, 'root_cause_tags', 12),
    queryDataQuality(filters),
    queryCases(filters),
    queryFilterOptions(),
    queryIngestionStatus(),
  ]);

  const overview = {
    totalCases: toInt(overviewRow?.total_cases),
    upheldCases: toInt(overviewRow?.upheld_cases),
    notUpheldCases: toInt(overviewRow?.not_upheld_cases),
    partiallyUpheldCases: toInt(overviewRow?.partially_upheld_cases),
    upheldRate: toNumber(overviewRow?.upheld_rate),
    notUpheldRate: toNumber(overviewRow?.not_upheld_rate),
    topRootCause: nullableString(rootCauseRows[0]?.label),
    topPrecedent: nullableString(precedentsRows[0]?.label),
    earliestDecisionDate: toIsoDate(overviewRow?.earliest_decision_date),
    latestDecisionDate: toIsoDate(overviewRow?.latest_decision_date),
  };

  const trends = trendsRows.map((row) => ({
    year: toInt(row.year),
    total: toInt(row.total),
    upheld: toInt(row.upheld),
    notUpheld: toInt(row.not_upheld),
    partiallyUpheld: toInt(row.partially_upheld),
    unknown: toInt(row.unknown_count),
  }));

  const outcomes = outcomesRows.map((row) => ({
    outcome: normalizeOutcome(String(row.outcome || 'unknown')),
    count: toInt(row.count),
  }));

  const products = productsRows.map((row) => ({
    product: normalizeLabel(row.product, 'Unspecified'),
    total: toInt(row.total),
    upheldRate: toNumber(row.upheld_rate),
  }));

  const firms = firmsRows.map((row) => ({
    firm: normalizeLabel(row.firm, 'Unknown firm'),
    total: toInt(row.total),
    upheldRate: toNumber(row.upheld_rate),
    notUpheldRate: toNumber(row.not_upheld_rate),
  }));

  const precedents = precedentsRows.map((row) => ({
    label: normalizeTagLabel(String(row.label || 'unknown')),
    count: toInt(row.count),
  }));

  const rootCauses = rootCauseRows.map((row) => ({
    label: normalizeTagLabel(String(row.label || 'unknown')),
    count: toInt(row.count),
  }));

  const insights = await queryYearInsights(filters, trends);

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
    filters: options,
    ingestion,
    dataQuality: {
      missingDecisionDate: toInt(qualityRow?.missing_decision_date),
      missingOutcome: toInt(qualityRow?.missing_outcome),
      withReasoningText: toInt(qualityRow?.with_reasoning_text),
    },
  };
}

export async function getCaseDetail(caseId: string): Promise<FOSCaseDetail | null> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();

  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT
        ${caseIdExpression('d')} AS case_id,
        d.decision_reference,
        d.decision_date,
        EXTRACT(YEAR FROM d.decision_date)::INT AS year,
        NULLIF(BTRIM(d.business_name), '') AS firm_name,
        NULLIF(BTRIM(d.product_sector), '') AS product_group,
        ${outcomeExpression('d')} AS outcome,
        NULLIF(BTRIM(d.ombudsman_name), '') AS ombudsman_name,
        d.decision_summary,
        d.decision_logic,
        d.precedents,
        d.root_cause_tags,
        d.vulnerability_flags,
        d.pdf_url,
        d.source_url,
        d.complaint_text,
        d.firm_response_text,
        d.ombudsman_reasoning_text,
        d.final_decision_text,
        d.full_text
      FROM fos_decisions d
      WHERE ${caseIdExpression('d')} = $1
         OR d.decision_reference = $1
         OR COALESCE(d.pdf_sha256, '') = $1
      LIMIT 1
    `,
    [caseId]
  );

  if (!rows[0]) return null;

  const row = rows[0];
  return enrichCaseDetail({
    caseId: String(row.case_id || caseId),
    decisionReference: String(row.decision_reference || row.case_id || caseId),
    decisionDate: toIsoDate(row.decision_date),
    year: row.year == null ? null : toInt(row.year),
    firmName: nullableString(row.firm_name),
    productGroup: nullableString(row.product_group),
    outcome: normalizeOutcome(String(row.outcome || 'unknown')),
    ombudsmanName: nullableString(row.ombudsman_name),
    decisionSummary: nullableString(row.decision_summary),
    decisionLogic: nullableString(row.decision_logic),
    precedents: parseStringArray(row.precedents),
    rootCauseTags: parseStringArray(row.root_cause_tags),
    vulnerabilityFlags: parseStringArray(row.vulnerability_flags),
    pdfUrl: nullableString(row.pdf_url),
    sourceUrl: nullableString(row.source_url),
    complaintText: nullableString(row.complaint_text),
    firmResponseText: nullableString(row.firm_response_text),
    ombudsmanReasoningText: nullableString(row.ombudsman_reasoning_text),
    finalDecisionText: nullableString(row.final_decision_text),
    fullText: nullableString(row.full_text),
  });
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

async function queryOverview(filters: FOSDashboardFilters): Promise<Record<string, unknown> | null> {
  const filtered = buildFilteredCte(filters);
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT
        COUNT(*)::INT AS total_cases,
        COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::INT AS upheld_cases,
        COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::INT AS not_upheld_cases,
        COUNT(*) FILTER (WHERE outcome_bucket = 'partially_upheld')::INT AS partially_upheld_cases,
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
        MIN(decision_date) AS earliest_decision_date,
        MAX(decision_date) AS latest_decision_date
      FROM filtered
    `,
    filtered.params
  );

  return rows[0] || null;
}

async function queryDataQuality(filters: FOSDashboardFilters): Promise<Record<string, unknown> | null> {
  const filtered = buildFilteredCte(filters);
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT
        COUNT(*) FILTER (WHERE decision_date IS NULL)::INT AS missing_decision_date,
        COUNT(*) FILTER (WHERE outcome_bucket = 'unknown')::INT AS missing_outcome,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(ombudsman_reasoning_text, '')), '') IS NOT NULL)::INT AS with_reasoning_text
      FROM filtered
    `,
    filtered.params
  );

  return rows[0] || null;
}

async function queryTrends(filters: FOSDashboardFilters): Promise<Record<string, unknown>[]> {
  const filtered = buildFilteredCte(filters);
  return DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
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
      ORDER BY year ASC
    `,
    filtered.params
  );
}

async function queryOutcomeDistribution(filters: FOSDashboardFilters): Promise<Record<string, unknown>[]> {
  const filtered = buildFilteredCte(filters);
  return DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT
        outcome_bucket AS outcome,
        COUNT(*)::INT AS count
      FROM filtered
      GROUP BY outcome_bucket
      ORDER BY count DESC, outcome_bucket ASC
    `,
    filtered.params
  );
}

async function queryProducts(filters: FOSDashboardFilters): Promise<Record<string, unknown>[]> {
  const filtered = buildFilteredCte(filters);
  return DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
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
    `,
    filtered.params
  );
}

async function queryFirms(filters: FOSDashboardFilters): Promise<Record<string, unknown>[]> {
  const filtered = buildFilteredCte(filters);
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
        ) AS not_upheld_rate
      FROM filtered
      GROUP BY COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')
      ORDER BY total DESC, firm ASC
      LIMIT 15
    `,
    filtered.params
  );
}

async function queryTagFrequency(
  filters: FOSDashboardFilters,
  column: 'precedents' | 'root_cause_tags',
  limit: number
): Promise<Record<string, unknown>[]> {
  const hasTags = await hasTagValues(column);
  if (!hasTags) return [];

  const filtered = buildFilteredCte(filters);
  const limitIndex = filtered.nextIndex;

  return DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT
        LOWER(BTRIM(tag.value)) AS label,
        COUNT(*)::INT AS count
      FROM filtered f
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.${column}, '[]'::jsonb)) AS tag(value)
      WHERE BTRIM(tag.value) <> ''
      GROUP BY LOWER(BTRIM(tag.value))
      ORDER BY count DESC, label ASC
      LIMIT $${limitIndex}
    `,
    [...filtered.params, limit]
  );
}

async function queryCases(filters: FOSDashboardFilters): Promise<{
  items: FOSCaseListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const filtered = buildFilteredCte(filters);
  const countRows = await DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT COUNT(*)::INT AS total FROM filtered
    `,
    filtered.params
  );

  const total = toInt(countRows[0]?.total);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const safePage = clamp(filters.page, 1, totalPages);
  const offset = (safePage - 1) * filters.pageSize;

  const limitIndex = filtered.nextIndex;
  const offsetIndex = filtered.nextIndex + 1;
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT
        ${caseIdExpression('f')} AS case_id,
        f.decision_reference,
        f.decision_date,
        EXTRACT(YEAR FROM f.decision_date)::INT AS year,
        NULLIF(BTRIM(f.business_name), '') AS firm_name,
        NULLIF(BTRIM(f.product_sector), '') AS product_group,
        f.outcome_bucket AS outcome,
        NULLIF(BTRIM(f.ombudsman_name), '') AS ombudsman_name,
        f.decision_summary,
        f.decision_logic,
        f.precedents,
        f.root_cause_tags,
        f.vulnerability_flags,
        f.pdf_url,
        f.source_url
      FROM filtered f
      ORDER BY f.decision_date DESC NULLS LAST, f.decision_reference ASC NULLS LAST
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    [...filtered.params, filters.pageSize, offset]
  );

  return {
    items: rows.map((row) => mapCaseListItem(row)),
    pagination: {
      page: safePage,
      pageSize: filters.pageSize,
      total,
      totalPages,
    },
  };
}

async function queryFilterOptions(): Promise<FOSFilterOptions> {
  const [yearRows, productRows, firmRows] = await Promise.all([
    DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT DISTINCT EXTRACT(YEAR FROM decision_date)::INT AS year
        FROM fos_decisions
        WHERE decision_date IS NOT NULL
        ORDER BY year DESC
      `
    ),
    DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product
        FROM fos_decisions
        GROUP BY COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
        ORDER BY COUNT(*) DESC, product ASC
        LIMIT 40
      `
    ),
    DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm
        FROM fos_decisions
        GROUP BY COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')
        ORDER BY COUNT(*) DESC, firm ASC
        LIMIT 120
      `
    ),
  ]);

  return {
    years: yearRows.map((row) => toInt(row.year)).filter((year) => year > 0),
    outcomes: SUPPORTED_OUTCOMES,
    products: productRows.map((row) => normalizeLabel(row.product, 'Unspecified')).filter(Boolean),
    firms: firmRows.map((row) => normalizeLabel(row.firm, 'Unknown firm')).filter(Boolean),
    tags: [],
  };
}

async function queryYearInsights(
  filters: FOSDashboardFilters,
  trends: Array<{ year: number; total: number; upheld: number; notUpheld: number }>
): Promise<FOSYearInsight[]> {
  if (!trends.length) return [];

  const filtered = buildFilteredCte(filters);
  const topProducts = await DatabaseClient.query<Record<string, unknown>>(
    `
      ${filtered.cteSql}
      SELECT year, product, total
      FROM (
        SELECT
          EXTRACT(YEAR FROM decision_date)::INT AS year,
          COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
          COUNT(*)::INT AS total,
          ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM decision_date)::INT
            ORDER BY COUNT(*) DESC, COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') ASC
          ) AS rank
        FROM filtered
        WHERE decision_date IS NOT NULL
        GROUP BY EXTRACT(YEAR FROM decision_date)::INT, COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
      ) ranked
      WHERE rank = 1
    `,
    filtered.params
  );

  const productByYear = new Map<number, string>();
  topProducts.forEach((row) => {
    productByYear.set(toInt(row.year), normalizeLabel(row.product, 'Unspecified'));
  });

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

    const topProduct = productByYear.get(item.year) || 'Unspecified';

    insights.push({
      year: item.year,
      headline: `${item.year}: ${item.total.toLocaleString()} decisions, ${upheldRate.toFixed(1)}% upheld`,
      detail: `Primary product group: ${topProduct}. Root-cause tagging pending enrichment. Volume trend: ${deltaText}.`,
    });
  }

  return insights.sort((a, b) => b.year - a.year);
}

async function hasTagValues(column: 'precedents' | 'root_cause_tags'): Promise<boolean> {
  const now = Date.now();
  if (tagPresenceCache && now - tagPresenceCache.checkedAt < TABLE_CHECK_TTL_MS) {
    return column === 'precedents' ? tagPresenceCache.precedents : tagPresenceCache.rootCauseTags;
  }

  const row = await DatabaseClient.queryOne<{ precedents_exists: boolean; root_cause_exists: boolean }>(`
    SELECT
      EXISTS (
        SELECT 1
        FROM fos_decisions
        WHERE jsonb_typeof(COALESCE(precedents, '[]'::jsonb)) = 'array'
          AND jsonb_array_length(COALESCE(precedents, '[]'::jsonb)) > 0
        LIMIT 1
      ) AS precedents_exists,
      EXISTS (
        SELECT 1
        FROM fos_decisions
        WHERE jsonb_typeof(COALESCE(root_cause_tags, '[]'::jsonb)) = 'array'
          AND jsonb_array_length(COALESCE(root_cause_tags, '[]'::jsonb)) > 0
        LIMIT 1
      ) AS root_cause_exists
  `);

  tagPresenceCache = {
    checkedAt: now,
    precedents: Boolean(row?.precedents_exists),
    rootCauseTags: Boolean(row?.root_cause_exists),
  };

  return column === 'precedents' ? tagPresenceCache.precedents : tagPresenceCache.rootCauseTags;
}

async function queryIngestionStatus(): Promise<FOSIngestionStatus> {
  const tableExistsRow = await DatabaseClient.queryOne<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'fos_ingestion_runs'
      ) AS exists
    `
  );

  if (!tableExistsRow?.exists) {
    return deriveIngestionStatus();
  }

  const columnRows = await DatabaseClient.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'fos_ingestion_runs'
    `
  );
  const columns = new Set(columnRows.map((row) => row.column_name));

  const selectable: string[] = [];
  if (columns.has('status')) selectable.push('status');
  if (columns.has('started_at')) selectable.push('started_at');
  if (columns.has('updated_at')) selectable.push('updated_at');
  if (columns.has('finished_at')) selectable.push('finished_at');
  if (columns.has('active_year')) selectable.push('active_year');
  if (columns.has('windows_done')) selectable.push('windows_done');
  if (columns.has('windows_total')) selectable.push('windows_total');
  if (columns.has('failed_windows')) selectable.push('failed_windows');
  if (columns.has('records_ingested')) selectable.push('records_ingested');
  if (columns.has('last_success_at')) selectable.push('last_success_at');

  if (!selectable.length) return deriveIngestionStatus();

  const orderBy = columns.has('updated_at')
    ? 'updated_at'
    : columns.has('finished_at')
      ? 'finished_at'
      : columns.has('started_at')
        ? 'started_at'
        : null;

  if (!orderBy) return deriveIngestionStatus();

  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT ${selectable.join(', ')}
      FROM fos_ingestion_runs
      ORDER BY ${orderBy} DESC NULLS LAST
      LIMIT 1
    `
  );

  if (!rows[0]) return deriveIngestionStatus();

  const row = rows[0];
  const status = normalizeRunStatus(nullableString(row.status));
  const lastRunAt = toIsoTimestamp(row.updated_at || row.finished_at || row.started_at);

  return {
    status,
    source: 'fos_ingestion_runs',
    lastRunAt,
    lastSuccessAt: toIsoTimestamp(row.last_success_at || row.finished_at),
    activeYear: row.active_year == null ? null : toInt(row.active_year),
    windowsDone: row.windows_done == null ? null : toInt(row.windows_done),
    windowsTotal: row.windows_total == null ? null : toInt(row.windows_total),
    failedWindows: row.failed_windows == null ? null : toInt(row.failed_windows),
    recordsIngested: row.records_ingested == null ? null : toInt(row.records_ingested),
  };
}

async function deriveIngestionStatus(): Promise<FOSIngestionStatus> {
  const summary = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
      SELECT
        COUNT(*)::INT AS total_cases,
        MAX(decision_date) AS latest_decision_date
      FROM fos_decisions
    `
  );

  return {
    ...DEFAULT_INGESTION_STATUS,
    source: 'derived',
    lastRunAt: toIsoDate(summary?.latest_decision_date),
    lastSuccessAt: toIsoDate(summary?.latest_decision_date),
    recordsIngested: toInt(summary?.total_cases),
  };
}

async function ensureFosDecisionsTableExists(): Promise<void> {
  const now = Date.now();
  if (tableCheckCache && now - tableCheckCache.checkedAt < TABLE_CHECK_TTL_MS) {
    if (!tableCheckCache.exists) {
      throw new Error('FOS dataset table `fos_decisions` is unavailable.');
    }
    return;
  }

  const result = await DatabaseClient.queryOne<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'fos_decisions'
      ) AS exists
    `
  );

  const exists = Boolean(result?.exists);
  tableCheckCache = { exists, checkedAt: now };

  if (!exists) {
    throw new Error('FOS dataset table `fos_decisions` is unavailable.');
  }
}

function ensureDatabaseConfigured(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }
}

function buildFilteredCte(filters: FOSDashboardFilters): CteBuildResult {
  const where = buildWhereClause(filters, 'd', 1);
  return {
    cteSql: `
      WITH filtered AS (
        SELECT
          d.*,
          ${outcomeExpression('d')} AS outcome_bucket
        FROM fos_decisions d
        ${where.whereSql}
      )
    `,
    params: where.params,
    nextIndex: where.nextIndex,
  };
}

function buildWhereClause(filters: FOSDashboardFilters, alias: string, startIndex: number): WhereBuildResult {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let index = startIndex;

  if (filters.years.length > 0) {
    conditions.push(`EXTRACT(YEAR FROM ${alias}.decision_date)::INT = ANY($${index}::INT[])`);
    params.push(filters.years);
    index += 1;
  }

  if (filters.outcomes.length > 0) {
    conditions.push(`${outcomeExpression(alias)} = ANY($${index}::TEXT[])`);
    params.push(filters.outcomes);
    index += 1;
  }

  if (filters.products.length > 0) {
    conditions.push(`COALESCE(NULLIF(BTRIM(${alias}.product_sector), ''), 'Unspecified') = ANY($${index}::TEXT[])`);
    params.push(filters.products);
    index += 1;
  }

  if (filters.firms.length > 0) {
    conditions.push(`COALESCE(NULLIF(BTRIM(${alias}.business_name), ''), 'Unknown firm') = ANY($${index}::TEXT[])`);
    params.push(filters.firms);
    index += 1;
  }

  if (filters.tags.length > 0) {
    conditions.push(`
      (
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(${alias}.root_cause_tags, '[]'::jsonb)) AS root_tag(value)
          WHERE LOWER(BTRIM(root_tag.value)) = ANY($${index}::TEXT[])
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(${alias}.precedents, '[]'::jsonb)) AS precedent_tag(value)
          WHERE LOWER(BTRIM(precedent_tag.value)) = ANY($${index}::TEXT[])
        )
      )
    `);
    params.push(filters.tags.map((tag) => tag.toLowerCase()));
    index += 1;
  }

  if (filters.query) {
    const searchPattern = `%${filters.query}%`;
    conditions.push(`
      (
        COALESCE(${alias}.decision_reference, '') ILIKE $${index}
        OR COALESCE(${alias}.business_name, '') ILIKE $${index}
        OR COALESCE(${alias}.product_sector, '') ILIKE $${index}
        OR COALESCE(${alias}.decision_summary, '') ILIKE $${index}
        OR COALESCE(${alias}.decision_logic, '') ILIKE $${index}
        OR COALESCE(${alias}.final_decision_text, '') ILIKE $${index}
        OR COALESCE(${alias}.ombudsman_reasoning_text, '') ILIKE $${index}
      )
    `);
    params.push(searchPattern);
    index += 1;
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIndex: index,
  };
}

function outcomeExpression(alias: string): string {
  return `
    CASE
      WHEN ${alias}.outcome IS NULL OR BTRIM(${alias}.outcome) = '' THEN 'unknown'
      WHEN LOWER(${alias}.outcome) LIKE '%not upheld%' THEN 'not_upheld'
      WHEN LOWER(${alias}.outcome) LIKE '%did not uphold%' THEN 'not_upheld'
      WHEN LOWER(${alias}.outcome) LIKE '%not_upheld%' THEN 'not_upheld'
      WHEN LOWER(${alias}.outcome) LIKE '%partially upheld%' THEN 'partially_upheld'
      WHEN LOWER(${alias}.outcome) LIKE '%partly upheld%' THEN 'partially_upheld'
      WHEN LOWER(${alias}.outcome) LIKE '%partially_upheld%' THEN 'partially_upheld'
      WHEN LOWER(${alias}.outcome) LIKE '%not settled%' THEN 'not_settled'
      WHEN LOWER(${alias}.outcome) LIKE '%not_settled%' THEN 'not_settled'
      WHEN LOWER(${alias}.outcome) LIKE '%settled%' THEN 'settled'
      WHEN LOWER(${alias}.outcome) LIKE '%upheld%' THEN 'upheld'
      ELSE 'unknown'
    END
  `;
}

function caseIdExpression(alias: string): string {
  return `
    COALESCE(
      NULLIF(${alias}.decision_reference, ''),
      NULLIF(${alias}.pdf_sha256, ''),
      MD5(
        CONCAT_WS(
          '|',
          COALESCE(${alias}.pdf_url, ''),
          COALESCE(${alias}.source_url, ''),
          COALESCE(${alias}.business_name, ''),
          COALESCE(${alias}.decision_date::TEXT, '')
        )
      )
    )
  `;
}

function mapCaseListItem(row: Record<string, unknown>): FOSCaseListItem {
  const caseId = String(row.case_id || row.decision_reference || '');
  return {
    caseId,
    decisionReference: String(row.decision_reference || caseId),
    decisionDate: toIsoDate(row.decision_date),
    year: row.year == null ? null : toInt(row.year),
    firmName: nullableString(row.firm_name),
    productGroup: nullableString(row.product_group),
    outcome: normalizeOutcome(String(row.outcome || 'unknown')),
    ombudsmanName: nullableString(row.ombudsman_name),
    decisionSummary: nullableString(row.decision_summary),
    decisionLogic: nullableString(row.decision_logic),
    precedents: parseStringArray(row.precedents),
    rootCauseTags: parseStringArray(row.root_cause_tags),
    vulnerabilityFlags: parseStringArray(row.vulnerability_flags),
    pdfUrl: nullableString(row.pdf_url),
    sourceUrl: nullableString(row.source_url),
  };
}

function enrichCaseDetail(detail: FOSCaseDetail): FOSCaseDetail {
  const fullText = cleanDecisionText(detail.fullText);
  const complaintText =
    detail.complaintText ||
    extractSection(fullText, COMPLAINT_MARKERS, [FIRM_RESPONSE_MARKERS, OMBUDSMAN_REASONING_MARKERS, FINAL_DECISION_MARKERS]);
  const firmResponseText =
    detail.firmResponseText || extractSection(fullText, FIRM_RESPONSE_MARKERS, [OMBUDSMAN_REASONING_MARKERS, FINAL_DECISION_MARKERS]);
  const ombudsmanReasoningText =
    detail.ombudsmanReasoningText || extractSection(fullText, OMBUDSMAN_REASONING_MARKERS, [FINAL_DECISION_MARKERS]);
  const finalDecisionText = detail.finalDecisionText || extractSection(fullText, FINAL_DECISION_MARKERS, []);
  const fallbackFinalDecision = finalDecisionText || extractFinalDecisionSentence(fullText);
  const tagSource = [
    detail.decisionLogic,
    detail.decisionSummary,
    complaintText,
    firmResponseText,
    ombudsmanReasoningText,
    fallbackFinalDecision,
    fullText?.slice(0, 12000),
  ]
    .filter(Boolean)
    .join('\n');

  const precedents = detail.precedents.length > 0 ? detail.precedents : detectTags(tagSource, PRECEDENT_RULES);
  const rootCauseTags = detail.rootCauseTags.length > 0 ? detail.rootCauseTags : detectTags(tagSource, ROOT_CAUSE_RULES);
  const vulnerabilityFlags =
    detail.vulnerabilityFlags.length > 0 ? detail.vulnerabilityFlags : detectTags(tagSource, VULNERABILITY_RULES);
  const decisionLogic = detail.decisionLogic || synthesizeDecisionLogic(detail.decisionSummary, ombudsmanReasoningText, fallbackFinalDecision);

  return {
    ...detail,
    decisionLogic,
    complaintText,
    firmResponseText,
    ombudsmanReasoningText,
    finalDecisionText: fallbackFinalDecision,
    precedents,
    rootCauseTags,
    vulnerabilityFlags,
  };
}

type TagRule = { label: string; pattern: RegExp };

const COMPLAINT_MARKERS = [
  /\bthe complaint\b/i,
  /\bbackground to the complaint\b/i,
  /\bwhat happened\b/i,
  /\bmy understanding\b/i,
];

const FIRM_RESPONSE_MARKERS = [
  /\bwhat (the )?(business|firm) says\b/i,
  /\bthe (business|firm) says\b/i,
  /\bthe insurer says\b/i,
  /\bthe lender says\b/i,
  /\bour investigator thought\b/i,
];

const OMBUDSMAN_REASONING_MARKERS = [
  /\bwhat i[' ]?ve decided\b/i,
  /\bwhat i have decided\b/i,
  /\bmy findings\b/i,
  /\bmy decision\b/i,
  /\breasons for decision\b/i,
  /\bwhat i think\b/i,
];

const FINAL_DECISION_MARKERS = [/\bmy final decision\b/i, /\bfinal decision\b/i];

const PRECEDENT_RULES: TagRule[] = [
  { label: 'DISP', pattern: /\bDISP\b/i },
  { label: 'PRIN', pattern: /\bPRIN\b/i },
  { label: 'ICOBS', pattern: /\bICOBS\b/i },
  { label: 'COBS', pattern: /\bCOBS\b/i },
  { label: 'MCOB', pattern: /\bMCOB\b/i },
  { label: 'CONC', pattern: /\bCONC\b/i },
  { label: 'SYSC', pattern: /\bSYSC\b/i },
  { label: 'FCA Principles', pattern: /\bFCA principles?\b/i },
  { label: 'FSMA', pattern: /\bFSMA\b|\bFinancial Services and Markets Act\b/i },
  { label: 'Consumer Credit Act 1974', pattern: /\bConsumer Credit Act\b|\bCCA\b/i },
  { label: 'Section 75 CCA', pattern: /\bsection\s*75\b/i },
  { label: 'Section 140A CCA', pattern: /\bsection\s*140a\b/i },
  { label: 'Insurance Act 2015', pattern: /\bInsurance Act 2015\b/i },
];

const ROOT_CAUSE_RULES: TagRule[] = [
  {
    label: 'Communication failure',
    pattern: /\b(poor|unclear|misleading)\s+communication\b|\bfailed to explain\b|\bnot (told|informed)\b/i,
  },
  {
    label: 'Delay in claim handling',
    pattern: /\b(delay|delayed|late|timescale|waiting time|took too long)\b/i,
  },
  {
    label: 'Policy wording ambiguity',
    pattern: /\b(policy wording|ambiguous|unclear term|small print|exclusion clause)\b/i,
  },
  {
    label: 'Affordability assessment failure',
    pattern: /\b(affordability|unaffordable|creditworthiness|irresponsible lending)\b/i,
  },
  {
    label: 'Administrative error',
    pattern: /\b(administrative|clerical|processing|data entry|system)\s+error\b/i,
  },
  {
    label: 'Fraud or scam concern',
    pattern: /\b(fraud|scam|authorised push payment|app fraud)\b/i,
  },
  {
    label: 'Non-disclosure or misrepresentation',
    pattern: /\b(non[- ]?disclosure|misrepresentation|failed to disclose)\b/i,
  },
];

const VULNERABILITY_RULES: TagRule[] = [
  { label: 'Bereavement', pattern: /\b(bereave|bereavement|late husband|late wife|widow|widower)\b/i },
  { label: 'Mental health', pattern: /\b(mental health|depression|anxiety|stress)\b/i },
  { label: 'Physical health', pattern: /\b(illness|disability|long[- ]term condition|hospital)\b/i },
  { label: 'Financial hardship', pattern: /\b(financial hardship|hardship|arrears|debt|struggling financially)\b/i },
  { label: 'Domestic abuse', pattern: /\b(domestic abuse|coercive control|financial abuse)\b/i },
  { label: 'Unemployment', pattern: /\b(unemploy|redundan)\b/i },
  { label: 'Language barrier', pattern: /\b(language barrier|english is not (my|their) first language|interpreter)\b/i },
];

function extractSection(
  fullText: string | null,
  startMarkers: RegExp[],
  endMarkerGroups: RegExp[][]
): string | null {
  if (!fullText) return null;
  const startIndex = findMarkerIndex(fullText, startMarkers);
  if (startIndex < 0) return null;

  let endIndex = fullText.length;
  for (const markers of endMarkerGroups) {
    const markerIndex = findMarkerIndex(fullText, markers, startIndex + 1);
    if (markerIndex >= 0 && markerIndex < endIndex) {
      endIndex = markerIndex;
    }
  }

  return trimText(fullText.slice(startIndex, endIndex), 7000);
}

function findMarkerIndex(text: string, markers: RegExp[], from = 0): number {
  let best = -1;
  const slice = text.slice(from);
  for (const marker of markers) {
    const match = slice.match(marker);
    if (!match || match.index == null) continue;
    const index = from + match.index;
    if (best < 0 || index < best) best = index;
  }
  return best;
}

function extractFinalDecisionSentence(fullText: string | null): string | null {
  if (!fullText) return null;
  const match = fullText.match(/\b(i (do not|don't|partly|partially|fully)?\s*uphold[^.?!]{0,220}[.?!])/i);
  if (!match) return null;
  return trimText(match[0], 500);
}

function synthesizeDecisionLogic(...parts: Array<string | null | undefined>): string | null {
  const source = parts.find((value) => Boolean(value && value.trim()));
  if (!source) return null;
  const clean = source.replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  const sentences = clean.match(/[^.?!]+[.?!]?/g) || [clean];
  const summary = sentences.slice(0, 2).join(' ').trim();
  return trimText(summary, 420);
}

function detectTags(text: string, rules: TagRule[]): string[] {
  if (!text.trim()) return [];
  const matches: string[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(text)) matches.push(rule.label);
  }
  return matches;
}

function cleanDecisionText(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return normalized || null;
}

function trimText(value: string, maxLength: number): string | null {
  const normalized = value.replace(/\u0000/g, '').trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function parseIntegerList(searchParams: URLSearchParams, key: string): number[] {
  const values = parseStringList(searchParams, key);
  const numbers = values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= 1900 && value <= 2100);
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

function parseStringList(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.getAll(key);
  const split = raw
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(split));
}

function parseStringArray(input: unknown): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) return normalizeStringList(input);

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? normalizeStringList(parsed) : [trimmed];
    } catch {
      return normalizeStringList(trimmed.split(','));
    }
  }

  if (typeof input === 'object') {
    return normalizeStringList(Object.values(input as Record<string, unknown>));
  }

  return [];
}

function normalizeStringList(values: unknown[]): string[] {
  const normalized = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function normalizeOutcome(value: string): FOSOutcome {
  const normalized = value.toLowerCase().replace(/\s+/g, '_');
  if (normalized.includes('not_upheld') || normalized.includes('did_not_uphold')) return 'not_upheld';
  if (normalized.includes('partially_upheld') || normalized.includes('partly_upheld')) return 'partially_upheld';
  if (normalized.includes('not_settled')) return 'not_settled';
  if (normalized.includes('settled')) return 'settled';
  if (normalized.includes('upheld')) return 'upheld';
  return 'unknown';
}

function normalizeRunStatus(status: string | null): FOSIngestionStatus['status'] {
  if (!status) return 'idle';
  const normalized = status.toLowerCase();
  if (normalized.includes('fail') || normalized.includes('error')) return 'error';
  if (normalized.includes('run') || normalized.includes('progress') || normalized.includes('active')) return 'running';
  if (normalized.includes('warn')) return 'warning';
  return 'idle';
}

function normalizeTagLabel(label: string): string {
  const compact = label.trim().replace(/\s+/g, ' ');
  if (!compact) return '';
  if (/[a-z]{2,}\d|\d[a-z]{2,}/i.test(compact) || compact.includes('.')) {
    return compact.toUpperCase();
  }
  return compact
    .split(' ')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function normalizeLabel(value: unknown, fallback: string): string {
  const asString = nullableString(value);
  return asString || fallback;
}

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const output = String(value).trim();
  return output ? output : null;
}

function toInt(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toIsoTimestamp(value: unknown): string | null {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function percentage(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
