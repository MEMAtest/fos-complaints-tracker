#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const COLUMN_NAMES = [
  'decision_reference',
  'decision_date',
  'business_name',
  'product_sector',
  'outcome',
  'ombudsman_name',
  'source_url',
  'pdf_url',
  'pdf_sha256',
  'full_text',
  'complaint_text',
  'firm_response_text',
  'ombudsman_reasoning_text',
  'final_decision_text',
  'decision_summary',
  'precedents',
  'root_cause_tags',
  'vulnerability_flags',
  'decision_logic',
  'embedding',
  'embedding_model',
  'embedding_dim',
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE_DIR = path.join(
  SCRIPT_DIR,
  '..',
  '..',
  'nasara-connect-grc',
  'nasara-connect',
  'data',
  'fos',
  'parsed'
);
const DEFAULT_STATE_FILE = path.join(SCRIPT_DIR, '..', 'tmp', 'fos-import-state.json');
const BATCH_SIZE_DEFAULT = 200;

async function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(SCRIPT_DIR, '..', '.env.local');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // No local env file; keep process env as-is.
  }
}

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

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).replace(/\u0000/g, '').trim();
  return text.length ? text : null;
}

function normalizeOutcome(value) {
  if (!value) return 'unknown';
  const lowered = String(value).toLowerCase();
  if (lowered.includes('not upheld') || lowered.includes('not_upheld') || lowered.includes('did not uphold')) return 'not_upheld';
  if (lowered.includes('partially upheld') || lowered.includes('partly upheld') || lowered.includes('partially_upheld')) {
    return 'partially_upheld';
  }
  if (lowered.includes('not settled') || lowered.includes('not_settled')) return 'not_settled';
  if (lowered.includes('settled')) return 'settled';
  if (lowered.includes('upheld')) return 'upheld';
  return 'unknown';
}

function rowFromRecord(record, fileName, includeFullText) {
  const baseReference = cleanText(record.decision_reference) || cleanText(path.basename(fileName, '.json'));
  const sections = record.sections || {};
  const summary = cleanText(record.decision_logic) || cleanText(record.snippet);
  return {
    decision_reference: baseReference,
    decision_date: safeDate(record.decision_date || record.decisionDate || record.decision_date_raw),
    business_name: cleanText(record.business_name),
    product_sector: cleanText(record.product_sector),
    outcome: normalizeOutcome(record.outcome || record.outcome_raw),
    ombudsman_name: cleanText(record.ombudsman_name),
    source_url: cleanText(record.source_url),
    pdf_url: cleanText(record.pdf_url),
    pdf_sha256: cleanText(record.pdf_sha256),
    full_text: includeFullText ? cleanText(record.full_text) : null,
    complaint_text: cleanText(sections.complaint),
    firm_response_text: cleanText(sections.firm_response),
    ombudsman_reasoning_text: cleanText(sections.ombudsman_reasoning),
    final_decision_text: cleanText(sections.final_decision),
    decision_summary: summary,
    precedents: Array.isArray(record.precedents) ? record.precedents : [],
    root_cause_tags: Array.isArray(record.root_cause_tags) ? record.root_cause_tags : [],
    vulnerability_flags: Array.isArray(record.vulnerability_flags) ? record.vulnerability_flags : [],
    decision_logic: summary,
    embedding: null,
    embedding_model: null,
    embedding_dim: null,
  };
}

function createBatchInsertSql(rowCount) {
  const width = COLUMN_NAMES.length;
  const placeholders = [];
  for (let row = 0; row < rowCount; row += 1) {
    const tuple = [];
    for (let col = 0; col < width; col += 1) {
      tuple.push(`$${row * width + col + 1}`);
    }
    placeholders.push(`(${tuple.join(',')})`);
  }

  return `
    INSERT INTO fos_decisions (
      ${COLUMN_NAMES.join(',')}
    ) VALUES
      ${placeholders.join(',\n')}
    ON CONFLICT (decision_reference) DO UPDATE SET
      decision_date = EXCLUDED.decision_date,
      business_name = EXCLUDED.business_name,
      product_sector = EXCLUDED.product_sector,
      outcome = EXCLUDED.outcome,
      ombudsman_name = EXCLUDED.ombudsman_name,
      source_url = EXCLUDED.source_url,
      pdf_url = EXCLUDED.pdf_url,
      pdf_sha256 = EXCLUDED.pdf_sha256,
      full_text = EXCLUDED.full_text,
      complaint_text = EXCLUDED.complaint_text,
      firm_response_text = EXCLUDED.firm_response_text,
      ombudsman_reasoning_text = EXCLUDED.ombudsman_reasoning_text,
      final_decision_text = EXCLUDED.final_decision_text,
      decision_summary = EXCLUDED.decision_summary,
      precedents = EXCLUDED.precedents,
      root_cause_tags = EXCLUDED.root_cause_tags,
      vulnerability_flags = EXCLUDED.vulnerability_flags,
      decision_logic = EXCLUDED.decision_logic,
      embedding = EXCLUDED.embedding,
      embedding_model = EXCLUDED.embedding_model,
      embedding_dim = EXCLUDED.embedding_dim,
      updated_at = NOW()
  `;
}

async function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function writeState(stateFile, state) {
  await ensureDirectoryExists(stateFile);
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function readState(stateFile) {
  try {
    const raw = await fs.readFile(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function createRun(client, totalWindows, recordsIngested, activeYear) {
  const result = await client.query(
    `
      INSERT INTO fos_ingestion_runs (
        status,
        active_year,
        windows_done,
        windows_total,
        failed_windows,
        records_ingested,
        started_at,
        updated_at
      ) VALUES ('running', $1, $2, $3, 0, $4, NOW(), NOW())
      RETURNING id
    `,
    [activeYear, 0, totalWindows, recordsIngested]
  );
  return result.rows[0]?.id;
}

async function updateRun(client, runId, payload) {
  await client.query(
    `
      UPDATE fos_ingestion_runs
      SET
        status = $2::VARCHAR,
        active_year = $3,
        windows_done = $4,
        windows_total = $5,
        failed_windows = $6,
        records_ingested = $7,
        updated_at = NOW(),
        finished_at = CASE WHEN $2::TEXT IN ('idle', 'error') THEN NOW() ELSE finished_at END,
        last_success_at = CASE WHEN $2::TEXT = 'idle' THEN NOW() ELSE last_success_at END
      WHERE id = $1
    `,
    [
      runId,
      payload.status,
      payload.activeYear ?? null,
      payload.windowsDone ?? null,
      payload.windowsTotal ?? null,
      payload.failedWindows ?? 0,
      payload.recordsIngested ?? 0,
    ]
  );
}

async function main() {
  await loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args['source-dir'] ? path.resolve(args['source-dir']) : DEFAULT_SOURCE_DIR;
  const stateFile = args['state-file'] ? path.resolve(args['state-file']) : DEFAULT_STATE_FILE;
  const batchSize = Number.parseInt(String(args['batch-size'] || BATCH_SIZE_DEFAULT), 10);
  const limit = args.limit ? Number.parseInt(String(args.limit), 10) : null;
  const includeFullText = Boolean(args['include-full-text']);
  const resume = !args['no-resume'];

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('--batch-size must be a positive integer.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');

  const fileNames = (await fs.readdir(sourceDir))
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const totalFiles = fileNames.length;
  if (!totalFiles) {
    throw new Error(`No parsed JSON files found in ${sourceDir}`);
  }

  const previousState = resume ? await readState(stateFile) : null;
  const startIndex = previousState?.nextIndex && Number.isInteger(previousState.nextIndex) ? previousState.nextIndex : 0;
  const endExclusive = limit ? Math.min(startIndex + limit, totalFiles) : totalFiles;

  if (startIndex >= endExclusive) {
    console.log(`Nothing to ingest. startIndex=${startIndex} endExclusive=${endExclusive}`);
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  let runId = null;
  let inserted = 0;
  let failed = 0;
  let activeYear = null;
  const windowsTotal = endExclusive - startIndex;

  try {
    runId = await createRun(client, windowsTotal, inserted, activeYear);

    const buffer = [];
    let processed = startIndex;
    for (let index = startIndex; index < endExclusive; index += 1) {
      const fileName = fileNames[index];
      const filePath = path.join(sourceDir, fileName);

      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const row = rowFromRecord(parsed, fileName, includeFullText);
        if (row.decision_date) {
          activeYear = Number.parseInt(String(row.decision_date).slice(0, 4), 10);
        }
        buffer.push(row);
      } catch (error) {
        failed += 1;
        if (failed <= 25) {
          console.error(`Skipping ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const flush = buffer.length >= batchSize || index === endExclusive - 1;
      if (flush && buffer.length > 0) {
        const sql = createBatchInsertSql(buffer.length);
        const values = [];
        for (const row of buffer) {
          values.push(
            row.decision_reference,
            row.decision_date,
            row.business_name,
            row.product_sector,
            row.outcome,
            row.ombudsman_name,
            row.source_url,
            row.pdf_url,
            row.pdf_sha256,
            row.full_text,
            row.complaint_text,
            row.firm_response_text,
            row.ombudsman_reasoning_text,
            row.final_decision_text,
            row.decision_summary,
            JSON.stringify(row.precedents || []),
            JSON.stringify(row.root_cause_tags || []),
            JSON.stringify(row.vulnerability_flags || []),
            row.decision_logic,
            row.embedding ? JSON.stringify(row.embedding) : null,
            row.embedding_model,
            row.embedding_dim
          );
        }

        await client.query(sql, values);
        inserted += buffer.length;
        buffer.length = 0;
      }

      processed = index + 1;
      if ((processed - startIndex) % 500 === 0 || processed === endExclusive) {
        const windowsDone = processed - startIndex;
        await updateRun(client, runId, {
          status: 'running',
          activeYear,
          windowsDone,
          windowsTotal,
          failedWindows: failed,
          recordsIngested: inserted,
        });
        await writeState(stateFile, {
          sourceDir,
          totalFiles,
          nextIndex: processed,
          lastFile: fileName,
          inserted,
          failed,
          updatedAt: new Date().toISOString(),
        });
        const pct = ((windowsDone / windowsTotal) * 100).toFixed(2);
        console.log(
          `Progress ${windowsDone}/${windowsTotal} (${pct}%) | inserted=${inserted.toLocaleString()} | failed=${failed.toLocaleString()}`
        );
      }
    }

    await updateRun(client, runId, {
      status: 'idle',
      activeYear,
      windowsDone: windowsTotal,
      windowsTotal,
      failedWindows: failed,
      recordsIngested: inserted,
    });

    await writeState(stateFile, {
      sourceDir,
      totalFiles,
      nextIndex: endExclusive,
      inserted,
      failed,
      completed: endExclusive >= totalFiles,
      updatedAt: new Date().toISOString(),
    });

    console.log(`Import finished. inserted=${inserted.toLocaleString()}, failed=${failed.toLocaleString()}`);
  } catch (error) {
    if (runId) {
      await updateRun(client, runId, {
        status: 'error',
        activeYear,
        windowsDone: null,
        windowsTotal,
        failedWindows: failed,
        recordsIngested: inserted,
      });
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
