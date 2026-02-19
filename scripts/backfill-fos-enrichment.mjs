#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BATCH_SIZE = 250;
const DEFAULT_STATE_FILE = path.join(SCRIPT_DIR, '..', 'tmp', 'fos-backfill-state.json');

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

const PRECEDENT_RULES = [
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

const ROOT_CAUSE_RULES = [
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

const VULNERABILITY_RULES = [
  { label: 'Bereavement', pattern: /\b(bereave|bereavement|late husband|late wife|widow|widower)\b/i },
  { label: 'Mental health', pattern: /\b(mental health|depression|anxiety|stress)\b/i },
  { label: 'Physical health', pattern: /\b(illness|disability|long[- ]term condition|hospital)\b/i },
  { label: 'Financial hardship', pattern: /\b(financial hardship|hardship|arrears|debt|struggling financially)\b/i },
  { label: 'Domestic abuse', pattern: /\b(domestic abuse|coercive control|financial abuse)\b/i },
  { label: 'Unemployment', pattern: /\b(unemploy|redundan)\b/i },
  { label: 'Language barrier', pattern: /\b(language barrier|english is not (my|their) first language|interpreter)\b/i },
];

const CANDIDATE_WHERE_SQL = `
  (
    NULLIF(BTRIM(COALESCE(complaint_text, '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(firm_response_text, '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(ombudsman_reasoning_text, '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(final_decision_text, '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(decision_logic, '')), '') IS NULL
    OR jsonb_array_length(COALESCE(precedents, '[]'::jsonb)) = 0
    OR jsonb_array_length(COALESCE(root_cause_tags, '[]'::jsonb)) = 0
    OR jsonb_array_length(COALESCE(vulnerability_flags, '[]'::jsonb)) = 0
  )
`;

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
    // Ignore if no env file is present.
  }
}

async function ensureDirectoryExists(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readState(stateFile) {
  try {
    const raw = await fs.readFile(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeState(stateFile, state) {
  await ensureDirectoryExists(stateFile);
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).replace(/\u0000/g, '').trim();
  return text || null;
}

function cleanDecisionText(value) {
  if (!value) return null;
  const normalized = String(value).replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return normalized || null;
}

function trimText(value, maxLength) {
  const normalized = cleanText(value);
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function findMarkerIndex(text, markers, from = 0) {
  const slice = text.slice(from);
  let best = -1;
  for (const marker of markers) {
    const match = slice.match(marker);
    if (!match || match.index == null) continue;
    const idx = from + match.index;
    if (best < 0 || idx < best) best = idx;
  }
  return best;
}

function extractSection(fullText, startMarkers, endMarkerGroups) {
  if (!fullText) return null;
  const start = findMarkerIndex(fullText, startMarkers);
  if (start < 0) return null;

  let end = fullText.length;
  for (const markers of endMarkerGroups) {
    const markerIndex = findMarkerIndex(fullText, markers, start + 1);
    if (markerIndex >= 0 && markerIndex < end) end = markerIndex;
  }
  return trimText(fullText.slice(start, end), 7000);
}

function extractFinalDecisionSentence(fullText) {
  if (!fullText) return null;
  const match = fullText.match(/\b(i (do not|don't|partly|partially|fully)?\s*uphold[^.?!]{0,220}[.?!])/i);
  if (!match) return null;
  return trimText(match[0], 500);
}

function synthesizeDecisionLogic(...parts) {
  const source = parts.find((value) => Boolean(cleanText(value)));
  if (!source) return null;
  const normalized = String(source).replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const sentences = normalized.match(/[^.?!]+[.?!]?/g) || [normalized];
  return trimText(sentences.slice(0, 2).join(' '), 420);
}

function normalizeStringList(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const normalized = cleanText(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function parseStringArray(input) {
  if (input == null) return [];
  if (Array.isArray(input)) return normalizeStringList(input);
  if (typeof input === 'object') return normalizeStringList(Object.values(input));
  if (typeof input !== 'string') return [];

  const trimmed = input.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return normalizeStringList(parsed);
  } catch {
    // fall through
  }
  return normalizeStringList(trimmed.split(','));
}

function detectTags(text, rules) {
  if (!text || !text.trim()) return [];
  const matches = [];
  for (const rule of rules) {
    if (rule.pattern.test(text)) matches.push(rule.label);
  }
  return normalizeStringList(matches);
}

function listEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function enrichRow(row) {
  const fullText = cleanDecisionText(row.full_text);
  const complaint = cleanText(row.complaint_text) ||
    extractSection(fullText, COMPLAINT_MARKERS, [FIRM_RESPONSE_MARKERS, OMBUDSMAN_REASONING_MARKERS, FINAL_DECISION_MARKERS]);
  const firmResponse = cleanText(row.firm_response_text) ||
    extractSection(fullText, FIRM_RESPONSE_MARKERS, [OMBUDSMAN_REASONING_MARKERS, FINAL_DECISION_MARKERS]);
  const reasoning = cleanText(row.ombudsman_reasoning_text) ||
    extractSection(fullText, OMBUDSMAN_REASONING_MARKERS, [FINAL_DECISION_MARKERS]);
  const finalDecision =
    cleanText(row.final_decision_text) || extractSection(fullText, FINAL_DECISION_MARKERS, []) || extractFinalDecisionSentence(fullText);

  const decisionLogic =
    cleanText(row.decision_logic) || synthesizeDecisionLogic(row.decision_summary, reasoning, finalDecision, complaint);

  const existingPrecedents = parseStringArray(row.precedents);
  const existingRootCauses = parseStringArray(row.root_cause_tags);
  const existingVulnerabilityFlags = parseStringArray(row.vulnerability_flags);

  const tagSource = [decisionLogic, row.decision_summary, complaint, firmResponse, reasoning, finalDecision, fullText?.slice(0, 12000)]
    .filter(Boolean)
    .join('\n');

  const precedents = existingPrecedents.length > 0 ? existingPrecedents : detectTags(tagSource, PRECEDENT_RULES);
  const rootCauseTags = existingRootCauses.length > 0 ? existingRootCauses : detectTags(tagSource, ROOT_CAUSE_RULES);
  const vulnerabilityFlags =
    existingVulnerabilityFlags.length > 0 ? existingVulnerabilityFlags : detectTags(tagSource, VULNERABILITY_RULES);

  const changed =
    cleanText(row.complaint_text) !== complaint ||
    cleanText(row.firm_response_text) !== firmResponse ||
    cleanText(row.ombudsman_reasoning_text) !== reasoning ||
    cleanText(row.final_decision_text) !== finalDecision ||
    cleanText(row.decision_logic) !== decisionLogic ||
    !listEqual(existingPrecedents, precedents) ||
    !listEqual(existingRootCauses, rootCauseTags) ||
    !listEqual(existingVulnerabilityFlags, vulnerabilityFlags);

  if (!changed) return null;

  return {
    id: row.id,
    complaint_text: complaint,
    firm_response_text: firmResponse,
    ombudsman_reasoning_text: reasoning,
    final_decision_text: finalDecision,
    decision_logic: decisionLogic,
    precedents,
    root_cause_tags: rootCauseTags,
    vulnerability_flags: vulnerabilityFlags,
  };
}

function createUpdateSql(rowCount) {
  const columnsPerRow = 9;
  const tuples = [];
  for (let i = 0; i < rowCount; i += 1) {
    const values = [];
    for (let c = 0; c < columnsPerRow; c += 1) {
      values.push(`$${i * columnsPerRow + c + 1}`);
    }
    tuples.push(`(${values.join(', ')})`);
  }

  return `
    UPDATE fos_decisions AS d
    SET
      complaint_text = v.complaint_text,
      firm_response_text = v.firm_response_text,
      ombudsman_reasoning_text = v.ombudsman_reasoning_text,
      final_decision_text = v.final_decision_text,
      decision_logic = v.decision_logic,
      precedents = v.precedents::jsonb,
      root_cause_tags = v.root_cause_tags::jsonb,
      vulnerability_flags = v.vulnerability_flags::jsonb,
      updated_at = NOW()
    FROM (
      VALUES
        ${tuples.join(',\n        ')}
    ) AS v(
      id,
      complaint_text,
      firm_response_text,
      ombudsman_reasoning_text,
      final_decision_text,
      decision_logic,
      precedents,
      root_cause_tags,
      vulnerability_flags
    )
    WHERE d.id = v.id::uuid
  `;
}

async function countCandidates(client) {
  const result = await client.query(`SELECT COUNT(*)::INT AS count FROM fos_decisions WHERE ${CANDIDATE_WHERE_SQL}`);
  return Number(result.rows[0]?.count || 0);
}

async function fetchBatch(client, cursorId, batchSize) {
  if (cursorId) {
    const result = await client.query(
      `
        SELECT
          id::TEXT AS id,
          full_text,
          decision_summary,
          decision_logic,
          complaint_text,
          firm_response_text,
          ombudsman_reasoning_text,
          final_decision_text,
          precedents,
          root_cause_tags,
          vulnerability_flags
        FROM fos_decisions
        WHERE ${CANDIDATE_WHERE_SQL}
          AND id > $1::uuid
        ORDER BY id ASC
        LIMIT $2
      `,
      [cursorId, batchSize]
    );
    return result.rows;
  }

  const result = await client.query(
    `
      SELECT
        id::TEXT AS id,
        full_text,
        decision_summary,
        decision_logic,
        complaint_text,
        firm_response_text,
        ombudsman_reasoning_text,
        final_decision_text,
        precedents,
        root_cause_tags,
        vulnerability_flags
      FROM fos_decisions
      WHERE ${CANDIDATE_WHERE_SQL}
      ORDER BY id ASC
      LIMIT $1
    `,
    [batchSize]
  );
  return result.rows;
}

async function applyUpdates(client, updates) {
  if (!updates.length) return;
  const sql = createUpdateSql(updates.length);
  const params = [];
  for (const update of updates) {
    params.push(
      update.id,
      update.complaint_text,
      update.firm_response_text,
      update.ombudsman_reasoning_text,
      update.final_decision_text,
      update.decision_logic,
      JSON.stringify(update.precedents),
      JSON.stringify(update.root_cause_tags),
      JSON.stringify(update.vulnerability_flags)
    );
  }
  await client.query(sql, params);
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const args = parseArgs(process.argv.slice(2));
  const batchSize = Math.max(1, toInt(args['batch-size'], DEFAULT_BATCH_SIZE));
  const stateFile = args['state-file'] ? path.resolve(args['state-file']) : DEFAULT_STATE_FILE;
  const resume = !args['no-resume'];
  const limit = args.limit ? Math.max(1, toInt(args.limit, 0)) : null;

  const state = (resume ? await readState(stateFile) : null) || {
    startedAt: new Date().toISOString(),
    completed: false,
    candidateTotal: null,
    scanned: 0,
    updated: 0,
    batches: 0,
    lastId: null,
    updatedAt: null,
  };

  state.completed = false;
  delete state.finishedAt;
  if (!state.startedAt) state.startedAt = new Date().toISOString();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  try {
    if (state.candidateTotal == null || !resume) {
      state.candidateTotal = await countCandidates(client);
      await writeState(stateFile, state);
    }

    console.log(
      `Starting enrichment backfill | candidate rows: ${state.candidateTotal.toLocaleString()} | batch size: ${batchSize.toLocaleString()}`
    );

    let exhausted = false;
    while (true) {
      if (limit && state.scanned >= limit) break;
      const remaining = limit ? limit - state.scanned : batchSize;
      const effectiveBatchSize = Math.max(1, Math.min(batchSize, remaining));
      const rows = await fetchBatch(client, state.lastId, effectiveBatchSize);
      if (!rows.length) {
        exhausted = true;
        break;
      }

      const updates = [];
      for (const row of rows) {
        const enriched = enrichRow(row);
        if (enriched) updates.push(enriched);
      }

      if (updates.length > 0) {
        await applyUpdates(client, updates);
      }

      state.lastId = rows[rows.length - 1].id;
      state.scanned += rows.length;
      state.updated += updates.length;
      state.batches += 1;
      state.updatedAt = new Date().toISOString();

      if (state.batches % 10 === 0) {
        const pct = state.candidateTotal > 0 ? ((state.scanned / state.candidateTotal) * 100).toFixed(2) : '0.00';
        console.log(
          `batch=${state.batches} scanned=${state.scanned.toLocaleString()} updated=${state.updated.toLocaleString()} progress=${pct}%`
        );
      }
      await writeState(stateFile, state);
    }

    state.completed = exhausted;
    state.finishedAt = exhausted ? new Date().toISOString() : null;
    state.updatedAt = new Date().toISOString();
    await writeState(stateFile, state);
    console.log(
      `${exhausted ? 'Backfill complete' : 'Backfill paused'} | scanned=${state.scanned.toLocaleString()} updated=${state.updated.toLocaleString()} state=${stateFile}`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
