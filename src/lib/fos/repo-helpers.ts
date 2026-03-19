import { DatabaseClient } from '@/lib/database';
import {
  FOSDashboardFilters,
  FOSDashboardSnapshot,
  FOSFilterOptions,
  FOSIngestionStatus,
  FOSOutcome,
  FOSTagCount,
} from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
const TABLE_CHECK_TTL_MS = 60_000;
const TAG_PRESENCE_CACHE_TTL_MS = 15 * 60_000;
const FILTER_OPTIONS_CACHE_TTL_MS = 15 * 60_000;

export const SUMMARY_SNAPSHOT_KEYS = {
  dashboard: 'dashboard_default',
  analysis: 'analysis_default',
  rootCauses: 'root_causes_default',
} as const;

export const SUPPORTED_OUTCOMES: FOSOutcome[] = [
  'upheld',
  'not_upheld',
  'partially_upheld',
  'settled',
  'not_settled',
  'unknown',
];

export const DEFAULT_INGESTION_STATUS: FOSIngestionStatus = {
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

// ─── Types ───────────────────────────────────────────────────────────────────

export type WhereBuildResult = {
  whereSql: string;
  params: unknown[];
  nextIndex: number;
};

export type CteBuildResult = {
  cteSql: string;
  params: unknown[];
  nextIndex: number;
};

export type DashboardSummaryPayload = Pick<
  FOSDashboardSnapshot,
  'overview' | 'trends' | 'outcomes' | 'products' | 'firms' | 'precedents' | 'rootCauses' | 'insights' | 'filters' | 'dataQuality'
>;

// ─── Caches ──────────────────────────────────────────────────────────────────

let tableCheckCache: { exists: boolean; checkedAt: number } | null = null;
let tagPresenceCache:
  | {
      checkedAt: number;
      precedents: boolean;
      rootCauseTags: boolean;
    }
  | null = null;
let filterOptionsCache: { checkedAt: number; value: FOSFilterOptions } | null = null;

// ─── Filter parsing ──────────────────────────────────────────────────────────

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

export function hasActiveScopeFilters(filters: FOSDashboardFilters): boolean {
  return (
    Boolean(filters.query) ||
    filters.years.length > 0 ||
    filters.outcomes.length > 0 ||
    filters.products.length > 0 ||
    filters.firms.length > 0 ||
    filters.tags.length > 0
  );
}

// ─── SQL expression builders ─────────────────────────────────────────────────

export function outcomeExpression(alias: string): string {
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

export function caseIdExpression(alias: string): string {
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

// ─── CTE builders ────────────────────────────────────────────────────────────

export function buildWhereClause(filters: FOSDashboardFilters, alias: string, startIndex: number): WhereBuildResult {
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
    const terms = filters.query
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean)
      .slice(0, 6);

    for (const term of terms) {
      const escaped = term.replace(/[%_\\]/g, '\\$&');
      const searchPattern = `%${escaped}%`;
      conditions.push(`
        (
          ${alias}.decision_reference ILIKE $${index}
          OR ${alias}.business_name ILIKE $${index}
          OR ${alias}.product_sector ILIKE $${index}
          OR ${alias}.decision_summary ILIKE $${index}
          OR ${alias}.decision_logic ILIKE $${index}
        )
      `);
      params.push(searchPattern);
      index += 1;
    }
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIndex: index,
  };
}

export function buildFilteredSelectCte(
  filters: FOSDashboardFilters,
  selectColumns: string[],
  options: { materialized?: boolean } = {}
): CteBuildResult {
  const where = buildWhereClause(filters, 'd', 1);
  const materializedClause = options.materialized ? ' MATERIALIZED' : '';

  return {
    cteSql: `
      WITH filtered AS${materializedClause} (
        SELECT
          ${selectColumns.join(',\n          ')}
        FROM fos_decisions d
        ${where.whereSql}
      )
    `,
    params: where.params,
    nextIndex: where.nextIndex,
  };
}

export function buildFilteredAggregateCte(filters: FOSDashboardFilters): CteBuildResult {
  return buildFilteredSelectCte(filters, [
    'd.decision_date',
    'd.business_name',
    'd.product_sector',
    'd.ombudsman_reasoning_text',
    `${outcomeExpression('d')} AS outcome_bucket`,
  ]);
}

export function buildFilteredTagCte(filters: FOSDashboardFilters): CteBuildResult {
  return buildFilteredSelectCte(filters, [
    'd.decision_date',
    'd.precedents',
    'd.root_cause_tags',
  ]);
}

export function buildFilteredCte(filters: FOSDashboardFilters): CteBuildResult {
  return buildFilteredSelectCte(
    filters,
    [
      'd.decision_reference',
      'd.pdf_sha256',
      'd.decision_date',
      'd.business_name',
      'd.product_sector',
      'd.outcome',
      'd.ombudsman_name',
      'd.decision_summary',
      'd.decision_logic',
      'd.precedents',
      'd.root_cause_tags',
      'd.vulnerability_flags',
      'd.pdf_url',
      'd.source_url',
      'd.ombudsman_reasoning_text',
      `${outcomeExpression('d')} AS outcome_bucket`,
    ],
    { materialized: true }
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────

export function ensureDatabaseConfigured(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }
}

export async function ensureFosDecisionsTableExists(): Promise<void> {
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

// ─── Cross-domain queries ────────────────────────────────────────────────────

export async function querySummarySnapshot<T>(snapshotKey: string): Promise<T | null> {
  try {
    const row = await DatabaseClient.queryOne<{ payload: unknown }>(
      `
        SELECT payload
        FROM fos_summary_snapshots
        WHERE snapshot_key = $1
      `,
      [snapshotKey]
    );

    return row ? parseJsonValue<T>(row.payload) : null;
  } catch (error) {
    if (isMissingRelationError(error, 'fos_summary_snapshots')) {
      return null;
    }
    throw error;
  }
}

export async function queryTagFrequency(
  filters: FOSDashboardFilters,
  column: 'precedents' | 'root_cause_tags',
  limit: number
): Promise<Record<string, unknown>[]> {
  const hasTags = await hasTagValues(column);
  if (!hasTags) return [];

  const filtered = buildFilteredTagCte(filters);
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

export async function hasTagValues(column: 'precedents' | 'root_cause_tags'): Promise<boolean> {
  const now = Date.now();
  if (tagPresenceCache && now - tagPresenceCache.checkedAt < TAG_PRESENCE_CACHE_TTL_MS) {
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

export async function queryFilterOptions(): Promise<FOSFilterOptions> {
  const now = Date.now();
  if (filterOptionsCache && now - filterOptionsCache.checkedAt < FILTER_OPTIONS_CACHE_TTL_MS) {
    return filterOptionsCache.value;
  }

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

  const value = {
    years: yearRows.map((row) => toInt(row.year)).filter((year) => year > 0),
    outcomes: SUPPORTED_OUTCOMES,
    products: productRows.map((row) => normalizeLabel(row.product, 'Unspecified')).filter(Boolean),
    firms: firmRows.map((row) => normalizeLabel(row.firm, 'Unknown firm')).filter(Boolean),
    tags: [],
  };

  filterOptionsCache = { checkedAt: now, value };
  return value;
}

export async function queryIngestionStatus(): Promise<FOSIngestionStatus> {
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

export async function deriveIngestionStatus(): Promise<FOSIngestionStatus> {
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

// ─── Type conversion ─────────────────────────────────────────────────────────

export function toInt(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function toNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function toIsoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function toIsoTimestamp(value: unknown): string | null {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const output = String(value).trim();
  return output ? output : null;
}

export function normalizeLabel(value: unknown, fallback: string): string {
  const asString = nullableString(value);
  return asString || fallback;
}

export function normalizeOutcome(value: string): FOSOutcome {
  const normalized = value.toLowerCase().replace(/\s+/g, '_');
  if (normalized.includes('not_upheld') || normalized.includes('did_not_uphold')) return 'not_upheld';
  if (normalized.includes('partially_upheld') || normalized.includes('partly_upheld')) return 'partially_upheld';
  if (normalized.includes('not_settled')) return 'not_settled';
  if (normalized.includes('settled')) return 'settled';
  if (normalized.includes('upheld')) return 'upheld';
  return 'unknown';
}

export function normalizeTagLabel(label: string): string {
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

export function normalizeRunStatus(status: string | null): FOSIngestionStatus['status'] {
  if (!status) return 'idle';
  const normalized = status.toLowerCase();
  if (normalized.includes('fail') || normalized.includes('error')) return 'error';
  if (normalized.includes('run') || normalized.includes('progress') || normalized.includes('active')) return 'running';
  if (normalized.includes('warn')) return 'warning';
  return 'idle';
}

export function percentage(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

export function parseIntegerList(searchParams: URLSearchParams, key: string): number[] {
  const values = parseStringList(searchParams, key);
  const numbers = values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= 1900 && value <= 2100);
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

export function parseStringList(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.getAll(key);
  const split = raw
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(split));
}

export function parseStringArray(input: unknown): string[] {
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

export function toObjectArray(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) {
    return input.filter((item): item is Record<string, unknown> => typeof item === 'object' && item != null);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is Record<string, unknown> => typeof item === 'object' && item != null);
      }
    } catch {
      return [];
    }
  }

  return [];
}

export function normalizeStringList(values: unknown[]): string[] {
  const normalized = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parseJsonValue<T>(input: unknown): T | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }
  return input as T;
}

// ─── Error ───────────────────────────────────────────────────────────────────

export function isMissingRelationError(error: unknown, relationName: string): boolean {
  const code = String((error as { code?: string })?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes(`relation "${relationName.toLowerCase()}" does not exist`);
}

// ─── Text ────────────────────────────────────────────────────────────────────

export function cleanDecisionText(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return normalized || null;
}

export function trimText(value: string, maxLength: number): string | null {
  const normalized = value.replace(/\u0000/g, '').trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}
