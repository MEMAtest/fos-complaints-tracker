import { DatabaseClient } from '@/lib/database';
import {
  FOSCaseDetail,
  FOSCaseListItem,
  FOSDashboardFilters,
  FOSSectionSource,
} from './types';
import {
  buildFilteredCte,
  caseIdExpression,
  cleanDecisionText,
  clamp,
  ensureDatabaseConfigured,
  ensureFosDecisionsTableExists,
  hasActiveScopeFilters,
  normalizeLabel,
  normalizeOutcome,
  nullableString,
  outcomeExpression,
  parseStringArray,
  toInt,
  toIsoDate,
  trimText,
} from './repo-helpers';

// ─── Section marker constants ────────────────────────────────────────────────

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

// ─── Tag rule constants ──────────────────────────────────────────────────────

type TagRule = { label: string; pattern: RegExp };

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

// ─── Exported functions ──────────────────────────────────────────────────────

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
    sectionSources: {
      complaint: 'missing',
      firmResponse: 'missing',
      ombudsmanReasoning: 'missing',
      finalDecision: 'missing',
    },
    sectionConfidence: {
      complaint: 0,
      firmResponse: 0,
      ombudsmanReasoning: 0,
      finalDecision: 0,
    },
  });
}

export async function getCaseList(filters: FOSDashboardFilters): Promise<{
  items: FOSCaseListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();
  return queryCases(filters);
}

export async function queryCases(filters: FOSDashboardFilters, totalOverride?: number): Promise<{
  items: FOSCaseListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const hasFilters = hasActiveScopeFilters(filters);

  const total = totalOverride != null ? Math.max(0, totalOverride) : null;
  if (total === 0) {
    return {
      items: [],
      pagination: {
        page: 1,
        pageSize: filters.pageSize,
        total: 0,
        totalPages: 1,
      },
    };
  }

  if (!hasFilters) {
    const safeTotal = total ?? toInt((await DatabaseClient.queryOne<{ total_rows: number }>(`SELECT COUNT(*)::INT AS total_rows FROM fos_decisions`))?.total_rows);
    if (safeTotal === 0) {
      return {
        items: [],
        pagination: {
          page: 1,
          pageSize: filters.pageSize,
          total: 0,
          totalPages: 1,
        },
      };
    }

    const totalPages = Math.max(1, Math.ceil(safeTotal / filters.pageSize));
    const safePage = clamp(Math.max(1, filters.page), 1, totalPages);
    const offset = (safePage - 1) * filters.pageSize;

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
          d.source_url
        FROM fos_decisions d
        ORDER BY d.decision_date DESC NULLS LAST, d.decision_reference ASC NULLS LAST
        LIMIT $1
        OFFSET $2
      `,
      [filters.pageSize, offset]
    );

    return {
      items: rows.map((row) => mapCaseListItem(row)),
      pagination: {
        page: safePage,
        pageSize: filters.pageSize,
        total: safeTotal,
        totalPages,
      },
    };
  }

  const filtered = buildFilteredCte(filters);
  const runPageQuery = async (page: number) => {
    const offset = (page - 1) * filters.pageSize;
    const limitIndex = filtered.nextIndex;
    const offsetIndex = filtered.nextIndex + 1;

    return DatabaseClient.query<Record<string, unknown>>(
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
  };

  const fetchTotal = async () => {
    const rows = await DatabaseClient.query<Record<string, unknown>>(
      `
        ${filtered.cteSql}
        SELECT COUNT(*)::INT AS total_rows
        FROM filtered
      `,
      filtered.params
    );
    return toInt(rows[0]?.total_rows);
  };

  const filteredTotal = totalOverride != null ? Math.max(0, totalOverride) : await fetchTotal();
  if (filteredTotal === 0) {
    return {
      items: [],
      pagination: {
        page: 1,
        pageSize: filters.pageSize,
        total: 0,
        totalPages: 1,
      },
    };
  }

  const totalPages = Math.max(1, Math.ceil(filteredTotal / filters.pageSize));
  const safePage = clamp(Math.max(1, filters.page), 1, totalPages);
  const rows = await runPageQuery(safePage);

  return {
    items: rows.map((row) => mapCaseListItem(row)),
    pagination: {
      page: safePage,
      pageSize: filters.pageSize,
      total: filteredTotal,
      totalPages,
    },
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

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
  const inferredComplaint = extractSection(fullText, COMPLAINT_MARKERS, [
    FIRM_RESPONSE_MARKERS,
    OMBUDSMAN_REASONING_MARKERS,
    FINAL_DECISION_MARKERS,
  ]);
  const inferredFirmResponse = extractSection(fullText, FIRM_RESPONSE_MARKERS, [OMBUDSMAN_REASONING_MARKERS, FINAL_DECISION_MARKERS]);
  const inferredReasoning = extractSection(fullText, OMBUDSMAN_REASONING_MARKERS, [FINAL_DECISION_MARKERS]);
  const inferredFinalDecision = extractSection(fullText, FINAL_DECISION_MARKERS, []);
  const fallbackFinalDecisionSentence = extractFinalDecisionSentence(fullText);

  const complaintText = detail.complaintText || inferredComplaint;
  const firmResponseText = detail.firmResponseText || inferredFirmResponse;
  const ombudsmanReasoningText = detail.ombudsmanReasoningText || inferredReasoning;
  const fallbackFinalDecision = detail.finalDecisionText || inferredFinalDecision || fallbackFinalDecisionSentence;

  const complaintSource = resolveSectionSource(detail.complaintText, inferredComplaint, complaintText);
  const firmResponseSource = resolveSectionSource(detail.firmResponseText, inferredFirmResponse, firmResponseText);
  const ombudsmanReasoningSource = resolveSectionSource(
    detail.ombudsmanReasoningText,
    inferredReasoning,
    ombudsmanReasoningText
  );
  const finalDecisionSource = resolveSectionSource(detail.finalDecisionText, inferredFinalDecision, fallbackFinalDecision);
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
    sectionSources: {
      complaint: complaintSource,
      firmResponse: firmResponseSource,
      ombudsmanReasoning: ombudsmanReasoningSource,
      finalDecision: finalDecisionSource,
    },
    sectionConfidence: {
      complaint: sectionConfidence(complaintSource, complaintText),
      firmResponse: sectionConfidence(firmResponseSource, firmResponseText),
      ombudsmanReasoning: sectionConfidence(ombudsmanReasoningSource, ombudsmanReasoningText),
      finalDecision: sectionConfidence(
        finalDecisionSource,
        fallbackFinalDecision,
        fallbackFinalDecisionSentence != null && !detail.finalDecisionText && !inferredFinalDecision
      ),
    },
  };
}

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

function resolveSectionSource(
  storedValue: string | null | undefined,
  inferredValue: string | null | undefined,
  resolvedValue: string | null | undefined
): FOSSectionSource {
  if (storedValue && storedValue.trim()) return 'stored';
  if (inferredValue && inferredValue.trim()) return 'inferred';
  if (resolvedValue && resolvedValue.trim()) return 'inferred';
  return 'missing';
}

function sectionConfidence(
  source: FOSSectionSource,
  text: string | null | undefined,
  weakInference = false
): number {
  if (!text || !text.trim()) return 0;
  if (source === 'stored') return 0.98;
  if (source === 'inferred') return weakInference ? 0.62 : 0.78;
  return 0;
}
