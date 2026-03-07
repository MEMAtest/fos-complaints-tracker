#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectWithRetry, createPoolConfig, loadLocalEnv } from './lib/db-runtime.mjs';

const { Pool } = pg;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BATCH_SIZE = 250;
const DEFAULT_STATE_FILE = path.join(SCRIPT_DIR, '..', 'tmp', 'fos-backfill-state.json');

const SECTION_CONFIDENCE = {
  stored: 0.98,
  marker: 0.86,
  heading: 0.79,
  window: 0.66,
  sentence: 0.61,
  missing: 0,
};

const HEADING_LINE_HINT = /^\s*([A-Z][\w '\-/()]{2,95}|what\s.+|my\s.+|the\s.+|final\s.+)\s*:?\s*$/i;

const COMPLAINT_MARKERS = [
  /\bthe complaint\b/i,
  /\bbackground to the complaint\b/i,
  /\bwhat happened\b/i,
  /\bevents leading up to (the )?complaint\b/i,
  /\bcomplainant(?:'s)? case\b/i,
  /\bmr\.?\s+\w+ says\b/i,
  /\bms\.?\s+\w+ says\b/i,
];

const FIRM_RESPONSE_MARKERS = [
  /\bwhat (the )?(business|firm) says\b/i,
  /\bthe (business|firm) says\b/i,
  /\bthe insurer says\b/i,
  /\bthe lender says\b/i,
  /\bthe bank says\b/i,
  /\bbusiness response\b/i,
  /\brespondent(?:'s)? case\b/i,
  /\bour investigator thought\b/i,
  /\bour investigator said\b/i,
];

const OMBUDSMAN_REASONING_MARKERS = [
  /\bwhat i[' ]?ve decided\b/i,
  /\bwhat i have decided\b/i,
  /\bwhat i[' ]?ve decided and why\b/i,
  /\bmy findings\b/i,
  /\bmy decision\b/i,
  /\breasons for decision\b/i,
  /\bwhat i think\b/i,
  /\bi[' ]?ve considered\b/i,
  /\bi have considered\b/i,
  /\bmy assessment\b/i,
];

const FINAL_DECISION_MARKERS = [
  /\bmy final decision\b/i,
  /\bfinal decision\b/i,
  /\bfor the reasons i[' ]?ve explained\b/i,
  /\bfor these reasons\b/i,
];

const COMPLAINT_HEADINGS = [
  /^the complaint\s*:?$/i,
  /^background(?: to the complaint)?\s*:?$/i,
  /^what happened\s*:?$/i,
  /^complainant(?:'s)? case\s*:?$/i,
];

const FIRM_RESPONSE_HEADINGS = [
  /^what (the )?(business|firm) says\s*:?$/i,
  /^(business|firm|insurer|lender|bank) response\s*:?$/i,
  /^respondent(?:'s)? case\s*:?$/i,
  /^our investigator(?:'s)? view\s*:?$/i,
  /^what our investigator thought\s*:?$/i,
];

const OMBUDSMAN_REASONING_HEADINGS = [
  /^what i[' ]?ve decided(?: and why)?\s*:?$/i,
  /^what i have decided(?: and why)?\s*:?$/i,
  /^my findings\s*:?$/i,
  /^my assessment\s*:?$/i,
  /^reasons? for decision\s*:?$/i,
  /^what i think\s*:?$/i,
];

const FINAL_DECISION_HEADINGS = [
  /^my final decision\s*:?$/i,
  /^final decision\s*:?$/i,
  /^decision\s*:?$/i,
];

const PRECEDENT_RULES = [
  {
    label: 'DISP',
    aliases: ['disp rules', 'fca disp'],
    minScore: 2,
    patterns: [
      { regex: /\bdisp\s*\d/i, weight: 2 },
      { regex: /\bdisp\b/i, weight: 1 },
    ],
  },
  {
    label: 'PRIN',
    aliases: ['fca principles', 'fca principle'],
    minScore: 2,
    patterns: [
      { regex: /\bprin\s*\d/i, weight: 2 },
      { regex: /\bprin\b/i, weight: 1 },
      { regex: /\bfca principles?\b/i, weight: 2 },
    ],
  },
  {
    label: 'ICOBS',
    aliases: ['insurance conduct of business sourcebook'],
    minScore: 1,
    patterns: [{ regex: /\bicobs\b/i, weight: 2 }],
  },
  {
    label: 'COBS',
    aliases: ['conduct of business sourcebook'],
    minScore: 1,
    patterns: [{ regex: /\bcobs\b/i, weight: 2 }],
  },
  {
    label: 'MCOB',
    aliases: ['mortgage conduct of business sourcebook'],
    minScore: 1,
    patterns: [{ regex: /\bmcob\b/i, weight: 2 }],
  },
  {
    label: 'CONC',
    aliases: ['consumer credit sourcebook'],
    minScore: 1,
    patterns: [{ regex: /\bconc\b/i, weight: 2 }],
  },
  {
    label: 'SYSC',
    aliases: ['systems and controls'],
    minScore: 1,
    patterns: [{ regex: /\bsysc\b/i, weight: 2 }],
  },
  {
    label: 'FSMA',
    aliases: ['financial services and markets act'],
    minScore: 1,
    patterns: [
      { regex: /\bfsma\b/i, weight: 2 },
      { regex: /\bfinancial services and markets act\b/i, weight: 2 },
    ],
  },
  {
    label: 'Consumer Credit Act 1974',
    aliases: ['cca', 'consumer credit act'],
    minScore: 2,
    patterns: [
      { regex: /\bconsumer credit act\b/i, weight: 2 },
      { regex: /\bcca\b/i, weight: 1 },
    ],
  },
  {
    label: 'Section 75 CCA',
    aliases: ['s75 cca', 'section 75'],
    minScore: 1,
    patterns: [{ regex: /\bsection\s*75\b/i, weight: 2 }],
  },
  {
    label: 'Section 140A CCA',
    aliases: ['s140a', 'section 140a'],
    minScore: 1,
    patterns: [{ regex: /\bsection\s*140a\b/i, weight: 2 }],
  },
  {
    label: 'Insurance Act 2015',
    aliases: ['insurance act'],
    minScore: 1,
    patterns: [{ regex: /\binsurance act(?:\s*2015)?\b/i, weight: 2 }],
  },
  {
    label: 'Distance Marketing Regulations',
    aliases: ['distance marketing'],
    minScore: 1,
    patterns: [{ regex: /\bdistance marketing regulations?\b/i, weight: 2 }],
  },
  {
    label: 'Payment Services Regulations',
    aliases: ['psr'],
    minScore: 1,
    patterns: [
      { regex: /\bpayment services regulations?\b/i, weight: 2 },
      { regex: /\bpsr\b/i, weight: 1 },
    ],
  },
];

const ROOT_CAUSE_RULES = [
  {
    label: 'Communication failure',
    aliases: ['poor communication', 'miscommunication'],
    minScore: 2,
    patterns: [
      { regex: /\b(poor|unclear|misleading)\s+communication\b/i, weight: 2 },
      { regex: /\bfailed to explain\b/i, weight: 2 },
      { regex: /\bnot (told|informed|made aware)\b/i, weight: 1 },
      { regex: /\bunclear (letter|email|advice)\b/i, weight: 1 },
    ],
  },
  {
    label: 'Delay in claim handling',
    aliases: ['claims delay', 'service delay'],
    minScore: 2,
    patterns: [
      { regex: /\b(delay|delayed|late|timescale|waiting time|took too long)\b/i, weight: 1 },
      { regex: /\bclaim (was )?(delayed|handled late)\b/i, weight: 2 },
      { regex: /\bunreasonable delay\b/i, weight: 2 },
    ],
  },
  {
    label: 'Policy wording ambiguity',
    aliases: ['unclear policy terms', 'policy ambiguity'],
    minScore: 2,
    patterns: [
      { regex: /\b(policy wording|ambiguous|unclear term|small print|exclusion clause)\b/i, weight: 2 },
      { regex: /\bterm(s)? (were|was) unclear\b/i, weight: 2 },
      { regex: /\bpolicy (didn['’]t|did not) make clear\b/i, weight: 2 },
    ],
  },
  {
    label: 'Affordability assessment failure',
    aliases: ['irresponsible lending', 'creditworthiness failure'],
    minScore: 2,
    patterns: [
      { regex: /\b(affordability|unaffordable|creditworthiness|irresponsible lending)\b/i, weight: 2 },
      { regex: /\b(insufficient|inadequate) (checks|assessment)\b/i, weight: 1 },
      { regex: /\bfailed to carry out affordability checks\b/i, weight: 2 },
    ],
  },
  {
    label: 'Administrative error',
    aliases: ['clerical error', 'processing error'],
    minScore: 2,
    patterns: [
      { regex: /\b(administrative|clerical|processing|data entry|system)\s+error\b/i, weight: 2 },
      { regex: /\bincorrectly (recorded|processed|applied)\b/i, weight: 1 },
      { regex: /\bmistake in records\b/i, weight: 1 },
    ],
  },
  {
    label: 'Fraud or scam concern',
    aliases: ['scam', 'app fraud', 'authorised push payment'],
    minScore: 2,
    patterns: [
      { regex: /\b(fraud|scam|authorised push payment|app fraud)\b/i, weight: 2 },
      { regex: /\bimpersonation\b/i, weight: 1 },
      { regex: /\bcriminal(?:s)?\b/i, weight: 1 },
    ],
  },
  {
    label: 'Non-disclosure or misrepresentation',
    aliases: ['misrepresentation', 'non disclosure'],
    minScore: 2,
    patterns: [
      { regex: /\b(non[- ]?disclosure|misrepresentation|failed to disclose)\b/i, weight: 2 },
      { regex: /\bmaterial information\b/i, weight: 1 },
      { regex: /\binaccurate information provided\b/i, weight: 1 },
    ],
  },
];

const VULNERABILITY_RULES = [
  {
    label: 'Bereavement',
    aliases: ['bereaved', 'widow', 'widower'],
    minScore: 1,
    patterns: [
      { regex: /\b(bereave|bereavement|late husband|late wife|widow|widower)\b/i, weight: 2 },
      { regex: /\bdeath of (a|their|his|her) (partner|spouse|family member)\b/i, weight: 1 },
    ],
  },
  {
    label: 'Mental health',
    aliases: ['depression', 'anxiety'],
    minScore: 1,
    patterns: [
      { regex: /\b(mental health|depression|anxiety|stress)\b/i, weight: 2 },
      { regex: /\bpanic attacks?\b/i, weight: 1 },
      { regex: /\bpost[- ]?traumatic stress\b/i, weight: 1 },
    ],
  },
  {
    label: 'Physical health',
    aliases: ['disability', 'illness'],
    minScore: 1,
    patterns: [
      { regex: /\b(illness|disability|long[- ]term condition|hospital)\b/i, weight: 2 },
      { regex: /\bserious (injury|condition)\b/i, weight: 1 },
      { regex: /\bmedical condition\b/i, weight: 1 },
    ],
  },
  {
    label: 'Financial hardship',
    aliases: ['hardship', 'arrears'],
    minScore: 1,
    patterns: [
      { regex: /\b(financial hardship|hardship|arrears|debt|struggling financially)\b/i, weight: 2 },
      { regex: /\bunable to (pay|afford)\b/i, weight: 1 },
      { regex: /\bpayment difficulties\b/i, weight: 1 },
    ],
  },
  {
    label: 'Domestic abuse',
    aliases: ['financial abuse', 'coercive control'],
    minScore: 1,
    patterns: [
      { regex: /\b(domestic abuse|coercive control|financial abuse)\b/i, weight: 2 },
      { regex: /\babusive relationship\b/i, weight: 1 },
    ],
  },
  {
    label: 'Unemployment',
    aliases: ['redundancy', 'job loss'],
    minScore: 1,
    patterns: [
      { regex: /\b(unemploy(?:ed|ment)?|redundan(?:t|cy))\b/i, weight: 2 },
      { regex: /\blost (his|her|their) job\b/i, weight: 1 },
    ],
  },
  {
    label: 'Language barrier',
    aliases: ['interpreter required', 'english not first language'],
    minScore: 1,
    patterns: [
      { regex: /\b(language barrier|english is not (my|their) first language|interpreter)\b/i, weight: 2 },
      { regex: /\brequired translation\b/i, weight: 1 },
    ],
  },
];

const PRECEDENT_ALIAS_MAP = buildAliasMap(PRECEDENT_RULES);
const ROOT_CAUSE_ALIAS_MAP = buildAliasMap(ROOT_CAUSE_RULES);
const VULNERABILITY_ALIAS_MAP = buildAliasMap(VULNERABILITY_RULES);

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
  const normalized = String(value)
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return normalized || null;
}

function trimText(value, maxLength) {
  const normalized = cleanText(value);
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function splitParagraphs(fullText) {
  if (!fullText) return [];
  return fullText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function headingKey(paragraph) {
  const line = String(paragraph || '').split('\n')[0]?.trim() || '';
  return line;
}

function looksLikeHeading(paragraph, headingPatterns) {
  const key = headingKey(paragraph);
  if (!key) return false;
  if (!HEADING_LINE_HINT.test(key)) return false;
  return headingPatterns.some((pattern) => pattern.test(key));
}

function looksLikeStopHeading(paragraph, stopHeadingPatterns) {
  const key = headingKey(paragraph);
  if (!key) return false;
  if (!HEADING_LINE_HINT.test(key)) return false;
  return stopHeadingPatterns.some((pattern) => pattern.test(key));
}

function findMarkerMatch(text, markers, from = 0) {
  if (!text) return null;
  const slice = text.slice(from);
  let best = null;
  for (const marker of markers) {
    const match = slice.match(marker);
    if (!match || match.index == null) continue;
    const index = from + match.index;
    if (!best || index < best.index) {
      best = {
        index,
        length: String(match[0] || '').length,
      };
    }
  }
  return best;
}

function findMarkerIndex(text, markers, from = 0) {
  const match = findMarkerMatch(text, markers, from);
  return match ? match.index : -1;
}

function extractSectionByMarkers(fullText, startMarkers, endMarkerGroups, options = {}) {
  if (!fullText) return null;
  const startMatch = findMarkerMatch(fullText, startMarkers);
  if (!startMatch) return null;

  const startIndex = startMatch.index;
  let endIndex = fullText.length;
  for (const markers of endMarkerGroups) {
    const markerIndex = findMarkerIndex(fullText, markers, startIndex + Math.max(1, startMatch.length));
    if (markerIndex >= 0 && markerIndex < endIndex) {
      endIndex = markerIndex;
    }
  }

  const minLength = options.minLength ?? 120;
  const candidate = trimText(fullText.slice(startIndex, endIndex), options.maxLength ?? 7000);
  if (candidate && candidate.length >= minLength) {
    return { value: candidate, source: 'marker' };
  }
  return null;
}

function extractSectionByHeadings(fullText, headingPatterns, stopHeadingPatterns, options = {}) {
  const paragraphs = splitParagraphs(fullText);
  if (!paragraphs.length) return null;

  const startIndex = paragraphs.findIndex((paragraph) => looksLikeHeading(paragraph, headingPatterns));
  if (startIndex < 0) return null;

  const maxParagraphs = options.maxParagraphs ?? 10;
  const collected = [paragraphs[startIndex]];

  for (let i = startIndex + 1; i < paragraphs.length && collected.length < maxParagraphs; i += 1) {
    const paragraph = paragraphs[i];
    if (looksLikeStopHeading(paragraph, stopHeadingPatterns)) break;
    collected.push(paragraph);
  }

  if (!collected.length) return null;
  const value = trimText(collected.join('\n\n'), options.maxLength ?? 7000);
  if (!value) return null;
  return { value, source: 'heading' };
}

function trimToBoundary(fullText, start, end) {
  const length = fullText.length;
  let s = Math.max(0, start);
  let e = Math.min(length, end);

  let rewind = 0;
  while (s > 0 && rewind < 240) {
    const prev = fullText[s - 1];
    if (prev === '\n' || prev === '.' || prev === '?' || prev === '!') break;
    s -= 1;
    rewind += 1;
  }

  let forward = 0;
  while (e < length && forward < 360) {
    const char = fullText[e];
    if (char === '\n' || char === '.' || char === '?' || char === '!') {
      e += 1;
      break;
    }
    e += 1;
    forward += 1;
  }

  return fullText.slice(s, e);
}

function extractSectionWindow(fullText, markers, options = {}) {
  if (!fullText) return null;
  const match = findMarkerMatch(fullText, markers);
  if (!match) return null;

  const before = options.windowBefore ?? 180;
  const after = options.windowAfter ?? 2600;
  const raw = trimToBoundary(fullText, match.index - before, match.index + after);
  const value = trimText(raw, options.maxLength ?? 7000);
  if (!value) return null;
  return { value, source: 'window' };
}

function extractFinalDecisionSentence(fullText) {
  if (!fullText) return null;
  const match = fullText.match(/\b(i (do not|don't|partly|partially|fully)?\s*uphold[^.?!]{0,260}[.?!])/i);
  if (!match) return null;
  const value = trimText(match[0], 520);
  return value ? { value, source: 'sentence' } : null;
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

function buildAliasMap(rules) {
  const map = new Map();
  for (const rule of rules) {
    map.set(rule.label.toLowerCase(), rule.label);
    for (const alias of rule.aliases || []) {
      map.set(String(alias).toLowerCase(), rule.label);
    }
  }
  return map;
}

function normalizeTagList(values, aliasMap) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const canonical = aliasMap.get(cleaned.toLowerCase()) || cleaned;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out;
}

function detectTagsWithConfidence(text, rules, aliasMap, options = {}) {
  if (!text || !text.trim()) {
    return { labels: [], confidence: 0, detail: [] };
  }

  const detected = [];
  for (const rule of rules) {
    let score = 0;
    let matched = 0;
    for (const pattern of rule.patterns || []) {
      if (pattern.regex.test(text)) {
        score += pattern.weight || 1;
        matched += 1;
      }
    }

    if (matched === 0) continue;
    const minScore = Math.max(1, rule.minScore || 1);
    if (score < minScore) continue;

    detected.push({
      label: rule.label,
      score,
      confidence: clamp(0.42 + score * 0.09, 0, 0.96),
    });
  }

  detected.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  const labels = normalizeTagList(
    detected.slice(0, options.maxTags || 12).map((item) => item.label),
    aliasMap
  );

  const detail = detected.slice(0, options.maxTags || 12).map((item) => ({
    label: item.label,
    score: item.score,
    confidence: item.confidence,
  }));

  const confidence = detail.length
    ? detail.reduce((sum, item) => sum + item.confidence, 0) / detail.length
    : 0;

  return { labels, confidence, detail };
}

function listEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function resolveSectionValue({
  storedValue,
  fullText,
  markers,
  endMarkerGroups,
  headingMarkers,
  stopHeadingMarkers,
  maxLength,
  minLength,
  windowBefore,
  windowAfter,
}) {
  const stored = cleanText(storedValue);
  if (stored) {
    return { value: stored, source: 'stored' };
  }
  if (!fullText) {
    return { value: null, source: 'missing' };
  }

  const markerResult = extractSectionByMarkers(fullText, markers, endMarkerGroups, {
    maxLength,
    minLength,
  });
  if (markerResult?.value) return markerResult;

  const headingResult = extractSectionByHeadings(fullText, headingMarkers, stopHeadingMarkers, {
    maxLength,
  });
  if (headingResult?.value) return headingResult;

  const windowResult = extractSectionWindow(fullText, markers, {
    maxLength,
    windowBefore,
    windowAfter,
  });
  if (windowResult?.value) return windowResult;

  return { value: null, source: 'missing' };
}

function sectionConfidence(source, value) {
  if (!value) return 0;
  return SECTION_CONFIDENCE[source] || 0;
}

function classifyConfidence(confidence) {
  if (confidence >= 0.82) return 'high';
  if (confidence >= 0.64) return 'medium';
  return 'low';
}

function createRunStats() {
  const newSectionCounter = () => ({
    stored: 0,
    marker: 0,
    heading: 0,
    window: 0,
    sentence: 0,
    missing: 0,
  });

  const newTagCounter = () => ({
    stored: 0,
    detected: 0,
    missing: 0,
  });

  return {
    changedRows: 0,
    confidence: { high: 0, medium: 0, low: 0 },
    sections: {
      complaint: newSectionCounter(),
      firmResponse: newSectionCounter(),
      ombudsmanReasoning: newSectionCounter(),
      finalDecision: newSectionCounter(),
    },
    tags: {
      precedents: newTagCounter(),
      rootCauseTags: newTagCounter(),
      vulnerabilityFlags: newTagCounter(),
    },
  };
}

function accumulateRunStats(stats, meta) {
  stats.changedRows += 1;
  const band = classifyConfidence(meta.overallConfidence || 0);
  stats.confidence[band] += 1;

  for (const [name, details] of Object.entries(meta.sections || {})) {
    if (!stats.sections[name]) continue;
    const source = details.source || 'missing';
    if (!Object.hasOwn(stats.sections[name], source)) {
      stats.sections[name][source] = 0;
    }
    stats.sections[name][source] += 1;
  }

  for (const [name, details] of Object.entries(meta.tags || {})) {
    if (!stats.tags[name]) continue;
    const source = details.source || 'missing';
    if (!Object.hasOwn(stats.tags[name], source)) {
      stats.tags[name][source] = 0;
    }
    stats.tags[name][source] += 1;
  }
}

async function writeRunReport(reportFile, payload) {
  if (!reportFile) return;
  await ensureDirectoryExists(reportFile);
  await fs.writeFile(reportFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function enrichRow(row) {
  const fullText = cleanDecisionText(row.full_text);

  const complaintResult = resolveSectionValue({
    storedValue: row.complaint_text,
    fullText,
    markers: COMPLAINT_MARKERS,
    endMarkerGroups: [FIRM_RESPONSE_MARKERS, OMBUDSMAN_REASONING_MARKERS, FINAL_DECISION_MARKERS],
    headingMarkers: COMPLAINT_HEADINGS,
    stopHeadingMarkers: [...FIRM_RESPONSE_HEADINGS, ...OMBUDSMAN_REASONING_HEADINGS, ...FINAL_DECISION_HEADINGS],
    maxLength: 7000,
    minLength: 90,
    windowBefore: 160,
    windowAfter: 2200,
  });

  const firmResponseResult = resolveSectionValue({
    storedValue: row.firm_response_text,
    fullText,
    markers: FIRM_RESPONSE_MARKERS,
    endMarkerGroups: [OMBUDSMAN_REASONING_MARKERS, FINAL_DECISION_MARKERS],
    headingMarkers: FIRM_RESPONSE_HEADINGS,
    stopHeadingMarkers: [...OMBUDSMAN_REASONING_HEADINGS, ...FINAL_DECISION_HEADINGS],
    maxLength: 7000,
    minLength: 90,
    windowBefore: 180,
    windowAfter: 2400,
  });

  const reasoningResult = resolveSectionValue({
    storedValue: row.ombudsman_reasoning_text,
    fullText,
    markers: OMBUDSMAN_REASONING_MARKERS,
    endMarkerGroups: [FINAL_DECISION_MARKERS],
    headingMarkers: OMBUDSMAN_REASONING_HEADINGS,
    stopHeadingMarkers: FINAL_DECISION_HEADINGS,
    maxLength: 7000,
    minLength: 120,
    windowBefore: 200,
    windowAfter: 2800,
  });

  let finalDecisionResult = resolveSectionValue({
    storedValue: row.final_decision_text,
    fullText,
    markers: FINAL_DECISION_MARKERS,
    endMarkerGroups: [],
    headingMarkers: FINAL_DECISION_HEADINGS,
    stopHeadingMarkers: [],
    maxLength: 1600,
    minLength: 50,
    windowBefore: 140,
    windowAfter: 980,
  });

  if (!finalDecisionResult.value) {
    const sentenceResult = extractFinalDecisionSentence(fullText);
    if (sentenceResult?.value) {
      finalDecisionResult = sentenceResult;
    }
  }

  const complaint = complaintResult.value;
  const firmResponse = firmResponseResult.value;
  const reasoning = reasoningResult.value;
  const finalDecision = finalDecisionResult.value;

  const decisionLogic =
    cleanText(row.decision_logic) ||
    synthesizeDecisionLogic(row.decision_summary, reasoning, finalDecision, complaint, firmResponse);

  const existingPrecedents = normalizeTagList(parseStringArray(row.precedents), PRECEDENT_ALIAS_MAP);
  const existingRootCauses = normalizeTagList(parseStringArray(row.root_cause_tags), ROOT_CAUSE_ALIAS_MAP);
  const existingVulnerabilityFlags = normalizeTagList(parseStringArray(row.vulnerability_flags), VULNERABILITY_ALIAS_MAP);

  const tagSource = [
    decisionLogic,
    row.decision_summary,
    complaint,
    firmResponse,
    reasoning,
    finalDecision,
    fullText?.slice(0, 18000),
  ]
    .filter(Boolean)
    .join('\n');

  const detectedPrecedents = detectTagsWithConfidence(tagSource, PRECEDENT_RULES, PRECEDENT_ALIAS_MAP);
  const detectedRootCauses = detectTagsWithConfidence(tagSource, ROOT_CAUSE_RULES, ROOT_CAUSE_ALIAS_MAP);
  const detectedVulnerabilityFlags = detectTagsWithConfidence(tagSource, VULNERABILITY_RULES, VULNERABILITY_ALIAS_MAP);

  const precedents = existingPrecedents.length > 0 ? existingPrecedents : detectedPrecedents.labels;
  const rootCauseTags = existingRootCauses.length > 0 ? existingRootCauses : detectedRootCauses.labels;
  const vulnerabilityFlags =
    existingVulnerabilityFlags.length > 0 ? existingVulnerabilityFlags : detectedVulnerabilityFlags.labels;

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

  const sectionMeta = {
    complaint: {
      source: complaintResult.source,
      confidence: sectionConfidence(complaintResult.source, complaint),
    },
    firmResponse: {
      source: firmResponseResult.source,
      confidence: sectionConfidence(firmResponseResult.source, firmResponse),
    },
    ombudsmanReasoning: {
      source: reasoningResult.source,
      confidence: sectionConfidence(reasoningResult.source, reasoning),
    },
    finalDecision: {
      source: finalDecisionResult.source,
      confidence: sectionConfidence(finalDecisionResult.source, finalDecision),
    },
  };

  const tagMeta = {
    precedents: {
      source: existingPrecedents.length > 0 ? 'stored' : precedents.length > 0 ? 'detected' : 'missing',
      confidence: existingPrecedents.length > 0 ? 0.98 : detectedPrecedents.confidence,
    },
    rootCauseTags: {
      source: existingRootCauses.length > 0 ? 'stored' : rootCauseTags.length > 0 ? 'detected' : 'missing',
      confidence: existingRootCauses.length > 0 ? 0.98 : detectedRootCauses.confidence,
    },
    vulnerabilityFlags: {
      source: existingVulnerabilityFlags.length > 0 ? 'stored' : vulnerabilityFlags.length > 0 ? 'detected' : 'missing',
      confidence: existingVulnerabilityFlags.length > 0 ? 0.98 : detectedVulnerabilityFlags.confidence,
    },
  };

  const confidenceSignals = [
    sectionMeta.complaint.confidence,
    sectionMeta.firmResponse.confidence,
    sectionMeta.ombudsmanReasoning.confidence,
    sectionMeta.finalDecision.confidence,
    tagMeta.precedents.confidence,
    tagMeta.rootCauseTags.confidence,
    tagMeta.vulnerabilityFlags.confidence,
  ].filter((value) => Number.isFinite(value));

  const overallConfidence = confidenceSignals.length
    ? confidenceSignals.reduce((sum, value) => sum + value, 0) / confidenceSignals.length
    : 0;

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
    _meta: {
      sections: sectionMeta,
      tags: tagMeta,
      overallConfidence,
    },
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function main() {
  await loadLocalEnv(SCRIPT_DIR);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const args = parseArgs(process.argv.slice(2));
  const batchSize = Math.max(1, toInt(args['batch-size'], DEFAULT_BATCH_SIZE));
  const stateFile = args['state-file'] ? path.resolve(args['state-file']) : DEFAULT_STATE_FILE;
  const reportFile = args['report-file'] ? path.resolve(args['report-file']) : null;
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

  const runStats = createRunStats();

  const pool = new Pool(
    createPoolConfig({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 8_000,
    })
  );
  const client = await connectWithRetry(pool, { label: 'db:backfill-fos-enrichment connect' });

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
        if (enriched) {
          accumulateRunStats(runStats, enriched._meta || {});
          updates.push(enriched);
        }
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

    const summary = `${exhausted ? 'Backfill complete' : 'Backfill paused'} | scanned=${state.scanned.toLocaleString()} updated=${state.updated.toLocaleString()} state=${stateFile}`;
    console.log(summary);

    if (reportFile) {
      const reportPayload = {
        generatedAt: new Date().toISOString(),
        state: {
          scanned: state.scanned,
          updated: state.updated,
          completed: state.completed,
          candidateTotal: state.candidateTotal,
          batches: state.batches,
          startedAt: state.startedAt,
          finishedAt: state.finishedAt,
          stateFile,
        },
        stats: runStats,
      };
      await writeRunReport(reportFile, reportPayload);
      console.log(`Backfill report written to ${reportFile}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
