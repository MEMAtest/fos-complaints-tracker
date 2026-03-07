#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectWithRetry, createPoolConfig, loadLocalEnv } from './lib/db-runtime.mjs';

const { Pool } = pg;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.join(SCRIPT_DIR, '..', 'db', 'migrations', '20260307_fos_summary_snapshots.sql');
const SNAPSHOT_KEYS = {
  dashboard: 'dashboard_default',
  analysis: 'analysis_default',
  rootCauses: 'root_causes_default',
};

function parseArgs(argv) {
  const selected = new Set(['dashboard', 'analysis', 'root-causes']);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--keys') {
      const raw = argv[index + 1] || '';
      index += 1;
      const values = raw
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      selected.clear();
      for (const value of values) selected.add(value);
    }
  }

  return {
    includeDashboard: selected.has('dashboard'),
    includeAnalysis: selected.has('analysis'),
    includeRootCauses: selected.has('root-causes') || selected.has('root_causes') || selected.has('rootcauses'),
  };
}

function outcomeExpression(alias) {
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

function toInt(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toIsoDate(value) {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeOutcome(value) {
  const normalized = String(value || 'unknown').toLowerCase().replace(/\s+/g, '_');
  if (normalized.includes('not_upheld') || normalized.includes('did_not_uphold')) return 'not_upheld';
  if (normalized.includes('partially_upheld') || normalized.includes('partly_upheld')) return 'partially_upheld';
  if (normalized.includes('not_settled')) return 'not_settled';
  if (normalized.includes('settled')) return 'settled';
  if (normalized.includes('upheld')) return 'upheld';
  return 'unknown';
}

function normalizeLabel(value, fallback) {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeTagLabel(label) {
  const compact = String(label || '').trim().replace(/\s+/g, ' ');
  if (!compact) return '';
  if (/[a-z]{2,}\d|\d[a-z]{2,}/i.test(compact) || compact.includes('.')) {
    return compact.toUpperCase();
  }
  return compact
    .split(' ')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function percentage(numerator, denominator) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function buildYearInsights(trends) {
  if (!trends.length) return [];
  const sorted = [...trends].sort((a, b) => a.year - b.year);
  return sorted
    .map((item, index) => {
      const upheldRate = percentage(item.upheld, item.total);
      const previous = sorted[index - 1];
      const delta = previous ? item.total - previous.total : null;
      const deltaText =
        delta == null
          ? 'baseline year in the current filter window'
          : `${delta > 0 ? '+' : ''}${delta} vs prior year`;

      return {
        year: item.year,
        headline: `${item.year}: ${item.total.toLocaleString()} decisions, ${upheldRate.toFixed(1)}% upheld`,
        detail: `Upheld ${item.upheld.toLocaleString()} vs not upheld ${item.notUpheld.toLocaleString()}. Volume trend: ${deltaText}.`,
      };
    })
    .sort((a, b) => b.year - a.year);
}

function buildYearNarratives(yearProductOutcome, topFirmByYear) {
  if (!yearProductOutcome.length) return [];

  const byYear = new Map();
  for (const row of yearProductOutcome) {
    const list = byYear.get(row.year) || [];
    list.push(row);
    byYear.set(row.year, list);
  }

  const topFirmLookup = new Map();
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

function buildRootCauseHierarchy(rootCauses) {
  const categoryMap = new Map();
  for (const rootCause of rootCauses) {
    const parts = rootCause.label.split(/[\s\-:\/]+/);
    const category = parts[0] || 'Other';
    if (!categoryMap.has(category)) categoryMap.set(category, new Map());
    categoryMap.get(category).set(rootCause.label, rootCause.count);
  }

  return Array.from(categoryMap.entries())
    .map(([name, children]) => ({
      name,
      children: Array.from(children.entries())
        .map(([childName, value]) => ({ name: childName, value }))
        .sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => {
      const aTotal = a.children.reduce((sum, child) => sum + child.value, 0);
      const bTotal = b.children.reduce((sum, child) => sum + child.value, 0);
      return bTotal - aTotal;
    });
}

async function applySchema(client) {
  const migrationSql = await fs.readFile(MIGRATION_PATH, 'utf8');
  await client.query(migrationSql);
}

async function fetchSourceStats(client) {
  const rows = await client.query(`
    SELECT
      COUNT(*)::INT AS source_row_count,
      MAX(decision_date) AS source_max_decision_date
    FROM fos_decisions
  `);
  return {
    sourceRowCount: toInt(rows.rows[0]?.source_row_count),
    sourceMaxDecisionDate: toIsoDate(rows.rows[0]?.source_max_decision_date),
  };
}

async function queryFilterOptions(client) {
  const [yearRows, productRows, firmRows] = await Promise.all([
    client.query(`
      SELECT DISTINCT EXTRACT(YEAR FROM decision_date)::INT AS year
      FROM fos_decisions
      WHERE decision_date IS NOT NULL
      ORDER BY year DESC
    `),
    client.query(`
      SELECT COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product
      FROM fos_decisions
      GROUP BY COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
      ORDER BY COUNT(*) DESC, product ASC
      LIMIT 40
    `),
    client.query(`
      SELECT COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm') AS firm
      FROM fos_decisions
      GROUP BY COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')
      ORDER BY COUNT(*) DESC, firm ASC
      LIMIT 120
    `),
  ]);

  return {
    years: yearRows.rows.map((row) => toInt(row.year)).filter((year) => year > 0),
    outcomes: ['upheld', 'not_upheld', 'partially_upheld', 'settled', 'not_settled', 'unknown'],
    products: productRows.rows.map((row) => normalizeLabel(row.product, 'Unspecified')),
    firms: firmRows.rows.map((row) => normalizeLabel(row.firm, 'Unknown firm')),
    tags: [],
  };
}

async function buildDashboardSnapshot(client) {
  const aggregateRows = await client.query(`
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
          COALESCE(COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
          2
        )
        FROM base
      ) AS upheld_rate,
      (
        SELECT ROUND(
          COALESCE(COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
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
                COALESCE(COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
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
                COALESCE(COUNT(*) FILTER (WHERE outcome_bucket = 'upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
                2
              ) AS upheld_rate,
              ROUND(
                COALESCE(COUNT(*) FILTER (WHERE outcome_bucket = 'not_upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
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
  `);

  const row = aggregateRows.rows[0] || {};
  const trends = Array.isArray(row.trends) ? row.trends : [];
  const outcomes = Array.isArray(row.outcomes)
    ? row.outcomes.map((item) => ({ outcome: normalizeOutcome(item.outcome), count: toInt(item.count) }))
    : [];
  const products = Array.isArray(row.products)
    ? row.products.map((item) => ({
        product: normalizeLabel(item.product, 'Unspecified'),
        total: toInt(item.total),
        upheldRate: toNumber(item.upheld_rate),
      }))
    : [];
  const firms = Array.isArray(row.firms)
    ? row.firms.map((item) => ({
        firm: normalizeLabel(item.firm, 'Unknown firm'),
        total: toInt(item.total),
        upheldRate: toNumber(item.upheld_rate),
        notUpheldRate: toNumber(item.not_upheld_rate),
      }))
    : [];
  const filterOptions = await queryFilterOptions(client);

  return {
    overview: {
      totalCases: toInt(row.total_cases),
      upheldCases: toInt(row.upheld_cases),
      notUpheldCases: toInt(row.not_upheld_cases),
      partiallyUpheldCases: toInt(row.partially_upheld_cases),
      upheldRate: toNumber(row.upheld_rate),
      notUpheldRate: toNumber(row.not_upheld_rate),
      topRootCause: null,
      topPrecedent: null,
      earliestDecisionDate: toIsoDate(row.earliest_decision_date),
      latestDecisionDate: toIsoDate(row.latest_decision_date),
    },
    trends: trends.map((item) => ({
      year: toInt(item.year),
      total: toInt(item.total),
      upheld: toInt(item.upheld),
      notUpheld: toInt(item.not_upheld),
      partiallyUpheld: toInt(item.partially_upheld),
      unknown: toInt(item.unknown_count),
    })),
    outcomes,
    products,
    firms,
    precedents: [],
    rootCauses: [],
    insights: buildYearInsights(
      trends.map((item) => ({
        year: toInt(item.year),
        total: toInt(item.total),
        upheld: toInt(item.upheld),
        notUpheld: toInt(item.not_upheld),
      }))
    ),
    filters: filterOptions,
    dataQuality: {
      missingDecisionDate: toInt(row.missing_decision_date),
      missingOutcome: toInt(row.missing_outcome),
      withReasoningText: toInt(row.with_reasoning_text),
    },
  };
}

async function queryYearProductOutcome(client) {
  const rows = await client.query(`
    SELECT
      EXTRACT(YEAR FROM d.decision_date)::INT AS year,
      COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS product,
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::INT AS upheld,
      COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld')::INT AS not_upheld,
      COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'partially_upheld')::INT AS partially_upheld,
      ROUND(
        COALESCE(COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
        2
      ) AS upheld_rate,
      ROUND(
        COALESCE(COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
        2
      ) AS not_upheld_rate
    FROM fos_decisions d
    WHERE d.decision_date IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM d.decision_date)::INT, COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')
    ORDER BY year ASC, total DESC, product ASC
  `);

  return rows.rows.map((row) => ({
    year: toInt(row.year),
    product: normalizeLabel(row.product, 'Unspecified'),
    total: toInt(row.total),
    upheld: toInt(row.upheld),
    notUpheld: toInt(row.not_upheld),
    partiallyUpheld: toInt(row.partially_upheld),
    upheldRate: toNumber(row.upheld_rate),
    notUpheldRate: toNumber(row.not_upheld_rate),
  }));
}

async function queryFirmBenchmark(client) {
  const rows = await client.query(`
    SELECT
      COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm,
      COUNT(*)::INT AS total,
      ROUND(
        COALESCE(COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
        2
      ) AS upheld_rate,
      ROUND(
        COALESCE(COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
        2
      ) AS not_upheld_rate,
      ROUND(AVG(EXTRACT(YEAR FROM d.decision_date)))::INT AS avg_decision_year,
      MODE() WITHIN GROUP (ORDER BY COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')) AS predominant_product
    FROM fos_decisions d
    GROUP BY COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm')
    ORDER BY total DESC, firm ASC
    LIMIT 120
  `);

  return rows.rows.map((row) => ({
    firm: normalizeLabel(row.firm, 'Unknown firm'),
    total: toInt(row.total),
    upheldRate: toNumber(row.upheld_rate),
    notUpheldRate: toNumber(row.not_upheld_rate),
    avgDecisionYear: row.avg_decision_year == null ? null : toInt(row.avg_decision_year),
    predominantProduct: row.predominant_product == null ? null : normalizeLabel(row.predominant_product, 'Unspecified'),
  }));
}

async function queryPrecedentRootCauseMatrix(client) {
  const rows = await client.query(`
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
  `);

  return rows.rows.map((row) => ({
    precedent: normalizeTagLabel(row.precedent),
    rootCause: normalizeTagLabel(row.root_cause),
    count: toInt(row.count),
  }));
}

async function queryProductTree(client) {
  const rows = await client.query(`
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
          COALESCE(COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 0),
          2
        ) AS upheld_rate
      FROM fos_decisions d
      GROUP BY COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified'), COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm')
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
  `);

  const tree = new Map();
  for (const row of rows.rows) {
    const product = normalizeLabel(row.product, 'Unspecified');
    const node = tree.get(product) || { product, total: toInt(row.total), firms: [] };
    if (row.firm != null && String(row.firm).trim()) {
      node.firms.push({
        firm: normalizeLabel(row.firm, 'Unknown firm'),
        total: toInt(row.firm_total),
        upheldRate: toNumber(row.upheld_rate),
      });
    }
    tree.set(product, node);
  }

  return Array.from(tree.values());
}

async function queryTopFirmByYear(client) {
  const rows = await client.query(`
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
  `);

  return rows.rows.map((row) => ({ year: toInt(row.year), firm: normalizeLabel(row.firm, 'Unknown firm') }));
}

async function queryMonthlyProductBreakdown(client) {
  const rows = await client.query(`
    SELECT
      TO_CHAR(d.decision_date, 'YYYY-MM') AS month,
      COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS product,
      COUNT(*)::INT AS count
    FROM fos_decisions d
    WHERE d.decision_date IS NOT NULL
    GROUP BY TO_CHAR(d.decision_date, 'YYYY-MM'), COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')
    ORDER BY month ASC, count DESC
  `);

  return rows.rows.map((row) => ({
    month: String(row.month),
    product: normalizeLabel(row.product, 'Unspecified'),
    count: toInt(row.count),
  }));
}

async function queryDecisionDayMonthGrid(client) {
  const rows = await client.query(`
    SELECT
      EXTRACT(MONTH FROM d.decision_date)::INT AS month,
      EXTRACT(DOW FROM d.decision_date)::INT AS day_of_week,
      COUNT(*)::INT AS count
    FROM fos_decisions d
    WHERE d.decision_date IS NOT NULL
    GROUP BY EXTRACT(MONTH FROM d.decision_date)::INT, EXTRACT(DOW FROM d.decision_date)::INT
    ORDER BY month ASC, day_of_week ASC
  `);

  return rows.rows.map((row) => ({
    month: toInt(row.month),
    dayOfWeek: toInt(row.day_of_week),
    count: toInt(row.count),
  }));
}

async function buildAnalysisSnapshot(client) {
  const [yearProductOutcome, firmBenchmark, precedentRootCauseMatrix, productTree, topFirmByYear, monthlyProductBreakdown, decisionDayMonthGrid] = await Promise.all([
    queryYearProductOutcome(client),
    queryFirmBenchmark(client),
    queryPrecedentRootCauseMatrix(client),
    queryProductTree(client),
    queryTopFirmByYear(client),
    queryMonthlyProductBreakdown(client),
    queryDecisionDayMonthGrid(client),
  ]);

  return {
    yearProductOutcome,
    firmBenchmark,
    precedentRootCauseMatrix,
    productTree,
    yearNarratives: buildYearNarratives(yearProductOutcome, topFirmByYear),
    monthlyProductBreakdown,
    decisionDayMonthGrid,
  };
}

async function buildRootCauseSnapshot(client) {
  const rows = await client.query(`
    WITH tag_exploded AS (
      SELECT
        LOWER(BTRIM(tag.value)) AS tag_label,
        EXTRACT(YEAR FROM d.decision_date)::INT AS year
      FROM fos_decisions d
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS tag(value)
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
  `);

  const rootCauses = rows.rows.map((row) => ({
    label: normalizeTagLabel(row.tag_label),
    count: toInt(row.total),
    trend: Array.isArray(row.trend)
      ? row.trend.map((item) => ({ year: toInt(item.year), count: toInt(item.count) }))
      : [],
  }));

  return {
    rootCauses,
    hierarchy: buildRootCauseHierarchy(rootCauses),
    frequency: rootCauses.map((item) => ({ label: item.label, count: item.count })),
  };
}

async function upsertSnapshot(client, snapshotKey, payload, sourceStats) {
  await client.query(
    `
      INSERT INTO fos_summary_snapshots (
        snapshot_key,
        payload,
        source_row_count,
        source_max_decision_date,
        refreshed_at
      )
      VALUES ($1, $2::jsonb, $3, $4, NOW())
      ON CONFLICT (snapshot_key) DO UPDATE
      SET
        payload = EXCLUDED.payload,
        source_row_count = EXCLUDED.source_row_count,
        source_max_decision_date = EXCLUDED.source_max_decision_date,
        refreshed_at = NOW()
    `,
    [snapshotKey, JSON.stringify(payload), sourceStats.sourceRowCount, sourceStats.sourceMaxDecisionDate]
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadLocalEnv(SCRIPT_DIR);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool(
    createPoolConfig({
      connectionString: process.env.DATABASE_URL,
      max: 6,
      connectionTimeoutMillis: 8_000,
    })
  );
  const client = await connectWithRetry(pool, { label: 'db:refresh-fos-summaries connect' });

  let runId = null;
  const startedAt = Date.now();

  try {
    await applySchema(client);

    const enabledKeys = [];
    if (args.includeDashboard) enabledKeys.push(SNAPSHOT_KEYS.dashboard);
    if (args.includeAnalysis) enabledKeys.push(SNAPSHOT_KEYS.analysis);
    if (args.includeRootCauses) enabledKeys.push(SNAPSHOT_KEYS.rootCauses);
    if (enabledKeys.length === 0) {
      throw new Error('No summary keys selected.');
    }

    const runRows = await client.query(
      `
        INSERT INTO fos_summary_refresh_runs (status, snapshot_keys)
        VALUES ('running', $1::jsonb)
        RETURNING id
      `,
      [JSON.stringify(enabledKeys)]
    );
    runId = runRows.rows[0]?.id || null;

    const sourceStats = await fetchSourceStats(client);
    const payloads = [];
    const details = {};

    if (args.includeDashboard) {
      const dashboard = await buildDashboardSnapshot(client);
      payloads.push([SNAPSHOT_KEYS.dashboard, dashboard]);
      details.dashboard = {
        trendCount: dashboard.trends.length,
        productCount: dashboard.products.length,
        firmCount: dashboard.firms.length,
        filterFirmCount: dashboard.filters.firms.length,
      };
    }

    if (args.includeAnalysis) {
      const analysis = await buildAnalysisSnapshot(client);
      payloads.push([SNAPSHOT_KEYS.analysis, analysis]);
      details.analysis = {
        yearProductCells: analysis.yearProductOutcome.length,
        matrixCells: analysis.precedentRootCauseMatrix.length,
        productTreeNodes: analysis.productTree.length,
      };
    }

    if (args.includeRootCauses) {
      const rootCauses = await buildRootCauseSnapshot(client);
      payloads.push([SNAPSHOT_KEYS.rootCauses, rootCauses]);
      details.rootCauses = {
        rootCauseCount: rootCauses.rootCauses.length,
      };
    }

    await client.query('BEGIN');
    for (const [snapshotKey, payload] of payloads) {
      await upsertSnapshot(client, snapshotKey, payload, sourceStats);
    }
    await client.query(
      `
        UPDATE fos_summary_refresh_runs
        SET
          status = 'success',
          source_row_count = $2,
          source_max_decision_date = $3,
          finished_at = NOW(),
          duration_ms = $4,
          details = $5::jsonb
        WHERE id = $1
      `,
      [runId, sourceStats.sourceRowCount, sourceStats.sourceMaxDecisionDate, Date.now() - startedAt, JSON.stringify(details)]
    );
    await client.query('COMMIT');

    console.log('FOS summary refresh completed.');
    console.log(`- snapshots: ${payloads.map(([key]) => key).join(', ')}`);
    console.log(`- source rows: ${sourceStats.sourceRowCount.toLocaleString()}`);
    console.log(`- source max decision date: ${sourceStats.sourceMaxDecisionDate || 'n/a'}`);
    for (const [key, value] of Object.entries(details)) {
      console.log(`- ${key}: ${JSON.stringify(value)}`);
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures after statement errors.
    }

    if (runId) {
      await client.query(
        `
          UPDATE fos_summary_refresh_runs
          SET
            status = 'error',
            finished_at = NOW(),
            duration_ms = $2,
            error_message = $3
          WHERE id = $1
        `,
        [runId, Date.now() - startedAt, error instanceof Error ? error.message : String(error)]
      ).catch(() => {});
    }

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FOS summary refresh failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
