#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectWithRetry, createPoolConfig, loadLocalEnv } from './lib/db-runtime.mjs';

const { Pool } = pg;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOP_LIMIT = 20;
const DEFAULT_PRODUCT_LIMIT = 15;
const DEFAULT_REPORT_DIR = path.join(SCRIPT_DIR, '..', 'tmp', 'reports');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function timestampSlug() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pct(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function buildScope(args) {
  const conditions = [];
  const params = [];

  const yearFrom = args['year-from'] ? toInt(args['year-from'], NaN) : null;
  const yearTo = args['year-to'] ? toInt(args['year-to'], NaN) : null;

  if (Number.isInteger(yearFrom)) {
    conditions.push(`EXTRACT(YEAR FROM decision_date)::INT >= $${params.length + 1}`);
    params.push(yearFrom);
  }
  if (Number.isInteger(yearTo)) {
    conditions.push(`EXTRACT(YEAR FROM decision_date)::INT <= $${params.length + 1}`);
    params.push(yearTo);
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    filters: {
      yearFrom: Number.isInteger(yearFrom) ? yearFrom : null,
      yearTo: Number.isInteger(yearTo) ? yearTo : null,
    },
  };
}

function withExtraCondition(whereSql, condition) {
  if (!condition) return whereSql;
  if (!whereSql) return `WHERE ${condition}`;
  return `${whereSql} AND ${condition}`;
}

async function queryTopTags(client, whereSql, params, column, limit) {
  const sql = `
    WITH scoped AS (
      SELECT ${column} AS values
      FROM fos_decisions
      ${whereSql}
    )
    SELECT
      tag_label,
      COUNT(*)::INT AS total
    FROM (
      SELECT LOWER(BTRIM(item.value)) AS tag_label
      FROM scoped
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(values, '[]'::jsonb)) AS item(value)
      WHERE NULLIF(BTRIM(item.value), '') IS NOT NULL
    ) tags
    GROUP BY tag_label
    ORDER BY COUNT(*) DESC, tag_label ASC
    LIMIT $${params.length + 1}
  `;

  const rows = await client.query(sql, [...params, limit]);
  return rows.rows.map((row) => ({
    label: String(row.tag_label || ''),
    total: toInt(row.total),
  }));
}

function buildCoverageSummary(aggregateRow) {
  const total = toInt(aggregateRow.total);
  const missingComplaint = toInt(aggregateRow.missing_complaint_text);
  const missingFirmResponse = toInt(aggregateRow.missing_firm_response_text);
  const missingReasoning = toInt(aggregateRow.missing_ombudsman_reasoning_text);
  const missingFinalDecision = toInt(aggregateRow.missing_final_decision_text);
  const missingDecisionLogic = toInt(aggregateRow.missing_decision_logic);
  const emptyPrecedents = toInt(aggregateRow.empty_precedents);
  const emptyRootCauseTags = toInt(aggregateRow.empty_root_cause_tags);
  const emptyVulnerabilityFlags = toInt(aggregateRow.empty_vulnerability_flags);

  const field = (missing) => {
    const filled = Math.max(0, total - missing);
    return {
      filled,
      missing,
      filledRatePct: pct(filled, total),
      missingRatePct: pct(missing, total),
    };
  };

  return {
    total,
    fields: {
      complaintText: field(missingComplaint),
      firmResponseText: field(missingFirmResponse),
      ombudsmanReasoningText: field(missingReasoning),
      finalDecisionText: field(missingFinalDecision),
      decisionLogic: field(missingDecisionLogic),
      precedents: field(emptyPrecedents),
      rootCauseTags: field(emptyRootCauseTags),
      vulnerabilityFlags: field(emptyVulnerabilityFlags),
    },
  };
}

async function ensureDirectoryExists(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  await loadLocalEnv(SCRIPT_DIR);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const args = parseArgs(process.argv.slice(2));
  const topLimit = clamp(toInt(args['sample-size'], DEFAULT_TOP_LIMIT), 5, 100);
  const productLimit = clamp(toInt(args['product-limit'], DEFAULT_PRODUCT_LIMIT), 5, 50);

  const scope = buildScope(args);
  const outFile = args.out
    ? path.resolve(String(args.out))
    : path.join(DEFAULT_REPORT_DIR, `fos-quality-${timestampSlug()}.json`);

  const pool = new Pool(
    createPoolConfig({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 8_000,
    })
  );
  const client = await connectWithRetry(pool, { label: 'db:report-fos-quality connect' });

  try {
    const aggregateSql = `
      SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(complaint_text, '')), '') IS NULL)::INT AS missing_complaint_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(firm_response_text, '')), '') IS NULL)::INT AS missing_firm_response_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(ombudsman_reasoning_text, '')), '') IS NULL)::INT AS missing_ombudsman_reasoning_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(final_decision_text, '')), '') IS NULL)::INT AS missing_final_decision_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(decision_logic, '')), '') IS NULL)::INT AS missing_decision_logic,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(precedents, '[]'::jsonb)) = 0)::INT AS empty_precedents,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(root_cause_tags, '[]'::jsonb)) = 0)::INT AS empty_root_cause_tags,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(vulnerability_flags, '[]'::jsonb)) = 0)::INT AS empty_vulnerability_flags
      FROM fos_decisions
      ${scope.whereSql}
    `;

    const byYearWhere = withExtraCondition(scope.whereSql, 'decision_date IS NOT NULL');
    const byYearSql = `
      SELECT
        EXTRACT(YEAR FROM decision_date)::INT AS year,
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(complaint_text, '')), '') IS NOT NULL)::INT AS with_complaint_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(firm_response_text, '')), '') IS NOT NULL)::INT AS with_firm_response_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(ombudsman_reasoning_text, '')), '') IS NOT NULL)::INT AS with_ombudsman_reasoning_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(final_decision_text, '')), '') IS NOT NULL)::INT AS with_final_decision_text,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(precedents, '[]'::jsonb)) > 0)::INT AS with_precedents,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(root_cause_tags, '[]'::jsonb)) > 0)::INT AS with_root_cause_tags,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(vulnerability_flags, '[]'::jsonb)) > 0)::INT AS with_vulnerability_flags
      FROM fos_decisions
      ${byYearWhere}
      GROUP BY EXTRACT(YEAR FROM decision_date)::INT
      ORDER BY year ASC
    `;

    const byProductSql = `
      SELECT
        COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(complaint_text, '')), '') IS NOT NULL)::INT AS with_complaint_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(firm_response_text, '')), '') IS NOT NULL)::INT AS with_firm_response_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(ombudsman_reasoning_text, '')), '') IS NOT NULL)::INT AS with_ombudsman_reasoning_text,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(final_decision_text, '')), '') IS NOT NULL)::INT AS with_final_decision_text,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(precedents, '[]'::jsonb)) > 0)::INT AS with_precedents,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(root_cause_tags, '[]'::jsonb)) > 0)::INT AS with_root_cause_tags,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(vulnerability_flags, '[]'::jsonb)) > 0)::INT AS with_vulnerability_flags
      FROM fos_decisions
      ${scope.whereSql}
      GROUP BY COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
      ORDER BY COUNT(*) DESC, product ASC
      LIMIT $${scope.params.length + 1}
    `;

    const [aggregateRows, byYearRows, byProductRows, topPrecedents, topRootCauses, topVulnerability] = await Promise.all([
      client.query(aggregateSql, scope.params),
      client.query(byYearSql, scope.params),
      client.query(byProductSql, [...scope.params, productLimit]),
      queryTopTags(client, scope.whereSql, scope.params, 'precedents', topLimit),
      queryTopTags(client, scope.whereSql, scope.params, 'root_cause_tags', topLimit),
      queryTopTags(client, scope.whereSql, scope.params, 'vulnerability_flags', topLimit),
    ]);

    const coverage = buildCoverageSummary(aggregateRows.rows[0] || {});

    const byYear = byYearRows.rows.map((row) => {
      const total = toInt(row.total);
      return {
        year: toInt(row.year),
        total,
        complaintTextCoveragePct: pct(toInt(row.with_complaint_text), total),
        firmResponseTextCoveragePct: pct(toInt(row.with_firm_response_text), total),
        ombudsmanReasoningTextCoveragePct: pct(toInt(row.with_ombudsman_reasoning_text), total),
        finalDecisionTextCoveragePct: pct(toInt(row.with_final_decision_text), total),
        precedentsCoveragePct: pct(toInt(row.with_precedents), total),
        rootCauseTagsCoveragePct: pct(toInt(row.with_root_cause_tags), total),
        vulnerabilityFlagsCoveragePct: pct(toInt(row.with_vulnerability_flags), total),
      };
    });

    const byProduct = byProductRows.rows.map((row) => {
      const total = toInt(row.total);
      return {
        product: String(row.product || 'Unspecified'),
        total,
        complaintTextCoveragePct: pct(toInt(row.with_complaint_text), total),
        firmResponseTextCoveragePct: pct(toInt(row.with_firm_response_text), total),
        ombudsmanReasoningTextCoveragePct: pct(toInt(row.with_ombudsman_reasoning_text), total),
        finalDecisionTextCoveragePct: pct(toInt(row.with_final_decision_text), total),
        precedentsCoveragePct: pct(toInt(row.with_precedents), total),
        rootCauseTagsCoveragePct: pct(toInt(row.with_root_cause_tags), total),
        vulnerabilityFlagsCoveragePct: pct(toInt(row.with_vulnerability_flags), total),
      };
    });

    const report = {
      generatedAt: new Date().toISOString(),
      filters: {
        ...scope.filters,
        topTagLimit: topLimit,
        productLimit,
      },
      coverage,
      topTags: {
        precedents: topPrecedents,
        rootCauseTags: topRootCauses,
        vulnerabilityFlags: topVulnerability,
      },
      segments: {
        byYear,
        byProduct,
      },
    };

    await ensureDirectoryExists(outFile);
    await fs.writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(`FOS quality report generated: ${outFile}`);
    console.log(`Rows in scope: ${coverage.total.toLocaleString()}`);
    console.log(`Coverage complaint_text: ${coverage.fields.complaintText.filledRatePct}%`);
    console.log(`Coverage firm_response_text: ${coverage.fields.firmResponseText.filledRatePct}%`);
    console.log(`Coverage ombudsman_reasoning_text: ${coverage.fields.ombudsmanReasoningText.filledRatePct}%`);
    console.log(`Coverage final_decision_text: ${coverage.fields.finalDecisionText.filledRatePct}%`);
    console.log(`Coverage precedents: ${coverage.fields.precedents.filledRatePct}%`);
    console.log(`Coverage root_cause_tags: ${coverage.fields.rootCauseTags.filledRatePct}%`);
    console.log(`Coverage vulnerability_flags: ${coverage.fields.vulnerabilityFlags.filledRatePct}%`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Quality report failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
