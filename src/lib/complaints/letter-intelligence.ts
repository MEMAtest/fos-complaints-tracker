import { DatabaseClient } from '@/lib/database';
import {
  caseIdExpression,
  ensureDatabaseConfigured,
  normalizeTagLabel,
  outcomeExpression,
  toInt,
  toIsoDate,
  toNumber,
} from '@/lib/fos/repo-helpers';
import type {
  ComplaintLetterIntelligence,
  ComplaintLetterIntelligenceAction,
  ComplaintLetterIntelligenceSourceScope,
  ComplaintRecord,
} from './types';

type AdvisorThemeLike = {
  theme: string;
  frequency: number;
};

type AdvisorPrecedentLike = {
  label: string;
  count: number;
  percentOfCases: number;
};

type AdvisorRootCausePatternLike = {
  label: string;
  count: number;
  upheldRate: number;
};

type AdvisorSampleCaseLike = {
  caseId: string;
  decisionReference: string;
  decisionDate: string | null;
  firmName: string | null;
  outcome: string;
  decisionSummary: string | null;
};

type AdvisorRiskAssessmentLike = {
  totalCases: number;
  upheldRate: number;
  notUpheldRate: number;
  overallUpheldRate: number;
  riskLevel: ComplaintLetterIntelligence['riskSnapshot']['riskLevel'];
  trendDirection: ComplaintLetterIntelligence['riskSnapshot']['trendDirection'];
};

type AdvisorBriefLike = {
  query: {
    product: string;
    rootCause: string | null;
  };
  generatedAt: string;
  riskAssessment: AdvisorRiskAssessmentLike;
  keyPrecedents: AdvisorPrecedentLike[];
  rootCausePatterns: AdvisorRootCausePatternLike[];
  whatWins: AdvisorThemeLike[];
  whatLoses: AdvisorThemeLike[];
  sampleCases: AdvisorSampleCaseLike[];
  recommendedActions: ComplaintLetterIntelligenceAction[];
  aiGuidance: string | null;
};

type QueryScope = {
  product: string;
  rootCause: string | null;
  sourceScope: Exclude<ComplaintLetterIntelligenceSourceScope, 'none'>;
};

export function buildComplaintLetterIntelligence(
  complaint: ComplaintRecord,
  brief: AdvisorBriefLike,
  sourceScope: Exclude<ComplaintLetterIntelligenceSourceScope, 'none'>
): ComplaintLetterIntelligence {
  const complaintDescription = describeComplaint(complaint);
  const challengeAreas = dedupeLines([
    `Address the complaint chronology clearly against the recorded issue: ${complaintDescription}.`,
    ...brief.whatLoses.slice(0, 4).map((item) => `Cover likely challenge area: ${formatTheme(item.theme)}.`),
    ...brief.rootCausePatterns
      .filter((item) => item.upheldRate >= 50)
      .slice(0, 2)
      .map((item) => `Explain how the file deals with root-cause risk around ${item.label} (${formatPercent(item.upheldRate)} upheld rate in similar cases).`),
  ]);

  const responseStrengths = dedupeLines([
    ...brief.whatWins.slice(0, 4).map((item) => `Use any evidence that supports ${formatTheme(item.theme)}.`),
    ...(complaint.remedialAction ? [`Record the remedial action already taken: ${complaint.remedialAction}.`] : []),
  ]);

  const remediationPrompts = dedupeLines([
    ...brief.recommendedActions.slice(0, 5).map((item) => normalizeSentence(item.item)),
    ...(complaint.compensationAmount == null
      ? ['Confirm whether compensation, apology, or another form of redress should be offered and explain why.']
      : [`Confirm the basis for the recorded redress amount of GBP ${complaint.compensationAmount.toFixed(2)}.`]),
    ...(complaint.remedialAction
      ? ['State how the recorded remedial action addresses the root cause and prevents repeat harm.']
      : ['Confirm whether any remedial action, service fix, or process change should be committed in the final response.']),
  ]);

  const reviewPoints = dedupeLines([
    `Confirm the product and issue framing before issue: ${brief.query.product}${brief.query.rootCause ? ` / ${brief.query.rootCause}` : ''}.`,
    `Benchmark for similar cases: ${brief.riskAssessment.totalCases} cases reviewed, ${formatPercent(brief.riskAssessment.upheldRate)} upheld, ${formatPercent(brief.riskAssessment.notUpheldRate)} not upheld.`,
    `Explain the reasoning so it addresses the main complaint summary: ${complaintDescription}.`,
    ...brief.keyPrecedents.slice(0, 3).map((item) => `Review the internal precedent theme ${item.label} before finalising the reasoning.`),
    ...brief.recommendedActions.slice(0, 3).map((item) => normalizeSentence(item.item)),
  ]);

  const referralChecklist = dedupeLines([
    'Check the final response or delay letter signposts the Financial Ombudsman Service correctly and includes the relevant time limit wording.',
    'Confirm the complaint chronology, evidence bundle, and key correspondence are complete before referral or escalation.',
    'Ensure the complaint reference, dates received, and any final-response date are consistent across the file and letter.',
    'Confirm the standard Ombudsman leaflet or equivalent signposting is referenced in the outgoing correspondence.',
    'Review the late-referral wording against the current complaints policy setting before issue.',
  ]);

  const acknowledgementScaffold = dedupeLines([
    `State the complaint reference, date received, and concise complaint summary: ${complaintDescription}.`,
    'Confirm the investigation scope, what information has already been received, and what further information is being requested.',
    `Set the next expected progress point and confirm the target final-response deadline from the complaint file.`,
    'Keep the tone procedural and avoid premature conclusions about outcome or redress.',
  ]);

  const holdingResponseScaffold = dedupeLines([
    `Explain why the review is not yet complete and tie that explanation back to the live issues on the file: ${complaintDescription}.`,
    ...challengeAreas.slice(0, 3).map((item) => `Outstanding review point: ${stripTrailingPunctuation(item)}.`),
    'State what evidence, chronology checks, or remediation assessment is still outstanding before a fair final response can be issued.',
    'Reconfirm Ombudsman rights and the expected next response date without sounding formulaic.',
  ]);

  const finalResponseReviewScaffold = dedupeLines([
    `Set out the chronology you reviewed, the complaint summary, and the evidence considered for ${complaintDescription}.`,
    'Separate the complaint allegations, the firm actions, and the file evidence so the review section reads as an ordered assessment.',
    ...brief.keyPrecedents.slice(0, 2).map((item) => `Test the review section internally against the precedent theme ${item.label}.`),
    ...responseStrengths.slice(0, 2).map((item) => `Review support point: ${stripTrailingPunctuation(item)}.`),
  ]);

  const finalResponseReasoningScaffold = dedupeLines([
    'Make the decision section explicit: what conclusion was reached, why that conclusion follows from the evidence, and which complaint points were upheld or not upheld.',
    ...challengeAreas.slice(0, 3).map((item) => `Reasoning prompt: ${stripTrailingPunctuation(item)}.`),
    ...responseStrengths.slice(0, 3).map((item) => `Balance point: ${stripTrailingPunctuation(item)}.`),
    `If the complaint is rejected or only partly upheld, explain why the file position differs from the higher-risk patterns seen in similar ${brief.query.product} cases.`,
  ]);

  const finalResponseRedressScaffold = dedupeLines([
    ...(complaint.compensationAmount != null
      ? [`Explain how the recorded redress amount of GBP ${complaint.compensationAmount.toFixed(2)} was calculated and why it is fair.`]
      : ['If no monetary redress is offered, explain clearly why that is fair and whether any apology or service correction is still appropriate.']),
    ...(complaint.remedialAction
      ? [`State the remedial action already recorded on the file: ${stripTrailingPunctuation(normalizeSentence(complaint.remedialAction))}.`]
      : ['State whether any remedial action, process fix, or service correction will be completed after the response.']),
    ...remediationPrompts.slice(0, 3).map((item) => `Redress prompt: ${stripTrailingPunctuation(item)}.`),
    'Close the section by linking the redress or remediation back to the customer impact and root cause.',
  ]);

  const referralResponseScaffold = dedupeLines([
    'Keep the outward wording procedural: when the complaint may be referred, what documents should be included, and the relevant time limits.',
    ...referralChecklist.slice(0, 3).map((item) => `File-readiness prompt: ${stripTrailingPunctuation(item)}.`),
    'Check that the final response or delay letter being referenced matches the complaint chronology and any enclosed evidence bundle.',
  ]);

  const comparableCaseSummary = dedupeLines([
    ...brief.sampleCases.slice(0, 3).map((item) => {
      const summary = item.decisionSummary?.trim() ? stripTrailingPunctuation(item.decisionSummary) : 'No summary recorded';
      const dateText = item.decisionDate ? ` on ${formatDateLabel(item.decisionDate)}` : '';
      return `Comparable case ${item.decisionReference} (${formatOutcomeLabel(item.outcome)}${dateText}) focused on ${summary}.`;
    }),
    ...brief.whatLoses.slice(0, 2).map((item) => `Repeated challenge theme across comparable cases: ${formatTheme(item.theme)}.`),
  ]);

  const comparableCaseReviews = brief.sampleCases.slice(0, 5).map((item) => ({
    caseId: item.caseId,
    decisionReference: item.decisionReference,
    internalReviewNote: dedupeLines([
      `Compare the complaint chronology against ${item.decisionReference} before final approval.`,
      `Outcome to consider internally: ${formatOutcomeLabel(item.outcome)}${item.decisionDate ? ` on ${formatDateLabel(item.decisionDate)}` : ''}.`,
      ...(item.decisionSummary?.trim() ? [`Published summary: ${stripTrailingPunctuation(item.decisionSummary)}.`] : []),
      ...(brief.whatLoses[0] ? [`Test whether the same challenge theme appears here: ${formatTheme(brief.whatLoses[0].theme)}.`] : []),
      'If this file reaches a different conclusion, record why the evidence or chronology is materially different.',
    ]),
    challengeSummary: dedupeLines([
      ...(item.decisionSummary?.trim() ? [`Key comparable-case takeaway: ${stripTrailingPunctuation(item.decisionSummary)}.`] : []),
      ...(brief.whatLoses.slice(0, 2).map((theme) => `Challenge theme to test: ${formatTheme(theme.theme)}.`)),
      ...(brief.whatWins[0] ? [`Check whether any balancing strength is present here: ${formatTheme(brief.whatWins[0].theme)}.`] : []),
    ]),
  }));

  return {
    complaintId: complaint.id,
    sourceScope,
    product: brief.query.product,
    rootCause: brief.query.rootCause,
    generatedAt: brief.generatedAt,
    riskSnapshot: {
      totalCases: brief.riskAssessment.totalCases,
      upheldRate: brief.riskAssessment.upheldRate,
      notUpheldRate: brief.riskAssessment.notUpheldRate,
      overallUpheldRate: brief.riskAssessment.overallUpheldRate,
      riskLevel: brief.riskAssessment.riskLevel,
      trendDirection: brief.riskAssessment.trendDirection,
    },
    draftingGuidance: {
      reviewPoints,
      challengeAreas,
      responseStrengths,
      remediationPrompts,
      referralChecklist,
      letterScaffolds: {
        acknowledgement: acknowledgementScaffold,
        holdingResponse: holdingResponseScaffold,
        finalResponseReview: finalResponseReviewScaffold,
        finalResponseReasoning: finalResponseReasoningScaffold,
        finalResponseRedress: finalResponseRedressScaffold,
        referralResponse: referralResponseScaffold,
      },
      comparableCaseSummary,
      comparableCaseReviews,
    },
    keyPrecedents: brief.keyPrecedents.slice(0, 6).map((item) => ({
      label: normalizeSentence(item.label),
      count: item.count,
      percentOfCases: roundOneDecimal(item.percentOfCases),
    })),
    sampleCases: brief.sampleCases.slice(0, 5).map((item) => ({
      caseId: item.caseId,
      decisionReference: item.decisionReference,
      decisionDate: item.decisionDate,
      firmName: item.firmName,
      outcome: item.outcome,
      summary: item.decisionSummary,
    })),
    whatWins: brief.whatWins.slice(0, 5).map((item) => ({ theme: formatTheme(item.theme), frequency: item.frequency })),
    whatLoses: brief.whatLoses.slice(0, 5).map((item) => ({ theme: formatTheme(item.theme), frequency: item.frequency })),
    rootCausePatterns: brief.rootCausePatterns.slice(0, 5).map((item) => ({
      label: normalizeSentence(item.label),
      count: item.count,
      upheldRate: roundOneDecimal(item.upheldRate),
    })),
    recommendedActions: brief.recommendedActions.slice(0, 6),
    aiGuidance: brief.aiGuidance?.trim() || null,
  };
}

export async function getComplaintLetterIntelligenceFromCorpus(
  complaint: ComplaintRecord
): Promise<ComplaintLetterIntelligence | null> {
  const product = complaint.product?.trim();
  if (!product) return null;

  ensureDatabaseConfigured();

  const initialScope: QueryScope = {
    product,
    rootCause: complaint.rootCause?.trim() || null,
    sourceScope: complaint.rootCause?.trim() ? 'product_root_cause' : 'product_only',
  };

  const scopedBrief = await queryCorpusBriefWithFallback(initialScope);
  if (scopedBrief) {
    return buildComplaintLetterIntelligence(complaint, scopedBrief, initialScope.sourceScope);
  }

  if (initialScope.rootCause) {
    const fallbackScope: QueryScope = { product, rootCause: null, sourceScope: 'product_only' };
    const fallbackBrief = await queryCorpusBriefWithFallback(fallbackScope);
    if (fallbackBrief) {
      return buildComplaintLetterIntelligence(complaint, fallbackBrief, fallbackScope.sourceScope);
    }
  }

  return null;
}

async function queryCorpusBriefWithFallback(scope: QueryScope): Promise<AdvisorBriefLike | null> {
  try {
    return await queryCorpusBrief(scope);
  } catch (error) {
    if (!isQueryTimeoutError(error)) {
      throw error;
    }
    return queryCorpusBriefLightweight(scope);
  }
}

function describeComplaint(complaint: ComplaintRecord): string {
  if (complaint.description?.trim()) return stripTrailingPunctuation(normalizeSentence(complaint.description));
  if (complaint.rootCause?.trim()) return stripTrailingPunctuation(`the ${complaint.rootCause.trim()} issue recorded on the complaint file`);
  if (complaint.product?.trim()) return stripTrailingPunctuation(`the ${complaint.product.trim()} complaint recorded on the file`);
  return 'the complaint recorded on the file';
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const normalized = normalizeSentence(line);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizeSentence(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.!?\s]+$/g, '').trim();
}

function formatTheme(value: string): string {
  const normalized = normalizeSentence(value);
  if (!normalized) return 'the recorded theme';
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function formatPercent(value: number): string {
  return `${roundOneDecimal(value)}%`;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatOutcomeLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function roundOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

async function queryCorpusBrief(scope: QueryScope): Promise<AdvisorBriefLike | null> {
  const scopeSql = buildScopeSql(scope);
  const [statsRow, yearlyRows, overallRow, precedentRows, rootCauseRows, losingThemeRows, winningThemeRows, sampleRows] =
    await Promise.all([
      DatabaseClient.queryOne<Record<string, unknown>>(
        `
          SELECT
            COUNT(*)::INT AS total_cases,
            ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
            ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld') / NULLIF(COUNT(*), 0), 2) AS not_upheld_rate
          FROM fos_decisions d
          ${scopeSql.whereSql}
        `,
        scopeSql.params
      ),
      DatabaseClient.query<Record<string, unknown>>(
        `
          SELECT
            EXTRACT(YEAR FROM d.decision_date)::INT AS year,
            ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
            COUNT(*)::INT AS total
          FROM fos_decisions d
          ${scopeSql.whereSql}
          AND d.decision_date IS NOT NULL
          GROUP BY EXTRACT(YEAR FROM d.decision_date)::INT
          HAVING COUNT(*) >= 3
          ORDER BY year ASC
        `,
        scopeSql.params
      ),
      DatabaseClient.queryOne<Record<string, unknown>>(
        `
          SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS rate
          FROM fos_decisions d
        `
      ),
      DatabaseClient.query<Record<string, unknown>>(
        `
          SELECT
            BTRIM(p.value) AS label,
            COUNT(*)::INT AS count
          FROM fos_decisions d
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.precedents, '[]'::jsonb)) AS p(value)
          ${scopeSql.whereSql}
          AND BTRIM(p.value) <> ''
          GROUP BY BTRIM(p.value)
          ORDER BY count DESC
          LIMIT 6
        `,
        scopeSql.params
      ),
      DatabaseClient.query<Record<string, unknown>>(
        `
          SELECT
            BTRIM(rc.value) AS label,
            COUNT(*)::INT AS count,
            ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate
          FROM fos_decisions d
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rc(value)
          ${scopeSql.whereSql}
          AND BTRIM(rc.value) <> ''
          GROUP BY BTRIM(rc.value)
          ORDER BY count DESC
          LIMIT 5
        `,
        scopeSql.params
      ),
      queryOutcomeThemeRows(scopeSql, 'upheld'),
      queryOutcomeThemeRows(scopeSql, 'not_upheld'),
      DatabaseClient.query<Record<string, unknown>>(
        `
          SELECT
            ${caseIdExpression('d')} AS case_id,
            d.decision_reference,
            d.decision_date,
            COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm_name,
            ${outcomeExpression('d')} AS outcome,
            d.decision_summary
          FROM fos_decisions d
          ${scopeSql.whereSql}
          ORDER BY d.decision_date DESC NULLS LAST
          LIMIT 5
        `,
        scopeSql.params
      ),
    ]);

  const totalCases = toInt(statsRow?.total_cases);
  if (totalCases === 0) return null;

  const upheldRate = toNumber(statsRow?.upheld_rate);
  const notUpheldRate = toNumber(statsRow?.not_upheld_rate);
  const overallUpheldRate = toNumber(overallRow?.rate);
  const yearTrend = yearlyRows.map((row) => ({
    year: toInt(row.year),
    upheldRate: toNumber(row.upheld_rate),
    total: toInt(row.total),
  }));
  let trendDirection: AdvisorRiskAssessmentLike['trendDirection'] = 'stable';
  if (yearTrend.length >= 2) {
    const recent = yearTrend[yearTrend.length - 1].upheldRate;
    const prior = yearTrend[yearTrend.length - 2].upheldRate;
    if (recent > prior + 5) trendDirection = 'worsening';
    if (recent < prior - 5) trendDirection = 'improving';
  }

  const mappedPrecedents = precedentRows.map((row) => ({
    label: normalizeTagLabel(String(row.label || '')),
    count: toInt(row.count),
    percentOfCases: roundOneDecimal((toInt(row.count) / totalCases) * 100),
  }));

  const mappedRootCausePatterns = rootCauseRows.map((row) => ({
    label: normalizeTagLabel(String(row.label || '')),
    count: toInt(row.count),
    upheldRate: toNumber(row.upheld_rate),
  }));

  return {
    query: {
      product: scope.product,
      rootCause: scope.rootCause,
    },
    generatedAt: new Date().toISOString(),
    riskAssessment: {
      totalCases,
      upheldRate,
      notUpheldRate,
      overallUpheldRate,
      riskLevel: deriveRiskLevel(upheldRate),
      trendDirection,
    },
    keyPrecedents: mappedPrecedents,
    rootCausePatterns: mappedRootCausePatterns,
    whatWins: winningThemeRows,
    whatLoses: losingThemeRows,
    sampleCases: sampleRows.map((row) => ({
      caseId: String(row.case_id || ''),
      decisionReference: String(row.decision_reference || ''),
      decisionDate: toIsoDate(row.decision_date),
      firmName: row.firm_name == null ? null : String(row.firm_name),
      outcome: String(row.outcome || 'unknown'),
      decisionSummary: row.decision_summary == null ? null : String(row.decision_summary),
    })),
    recommendedActions: deriveRecommendedActions(mappedPrecedents, mappedRootCausePatterns, losingThemeRows),
    aiGuidance: null,
  };
}

async function queryCorpusBriefLightweight(scope: QueryScope): Promise<AdvisorBriefLike | null> {
  const scopeSql = buildScopeSql(scope);
  const [statsRow, overallRow, sampleRows] = await Promise.all([
    DatabaseClient.queryOne<Record<string, unknown>>(
      `
        SELECT
          COUNT(*)::INT AS total_cases,
          ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
          ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'not_upheld') / NULLIF(COUNT(*), 0), 2) AS not_upheld_rate
        FROM fos_decisions d
        ${scopeSql.whereSql}
      `,
      scopeSql.params
    ),
    DatabaseClient.queryOne<Record<string, unknown>>(
      `
        SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS rate
        FROM fos_decisions d
      `
    ),
    DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT
          ${caseIdExpression('d')} AS case_id,
          d.decision_reference,
          d.decision_date,
          COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS firm_name,
          ${outcomeExpression('d')} AS outcome,
          d.decision_summary
        FROM fos_decisions d
        ${scopeSql.whereSql}
        ORDER BY d.decision_date DESC NULLS LAST
        LIMIT 5
      `,
      scopeSql.params
    ),
  ]);

  const totalCases = toInt(statsRow?.total_cases);
  if (totalCases === 0) return null;

  const upheldRate = toNumber(statsRow?.upheld_rate);
  const notUpheldRate = toNumber(statsRow?.not_upheld_rate);
  const overallUpheldRate = toNumber(overallRow?.rate);
  const riskLevel = deriveRiskLevel(upheldRate);
  const genericActions: ComplaintLetterIntelligenceAction[] = dedupeActions([
    {
      item: `Stress-test the draft against the ${scope.product} upheld rate before issue.`,
      source: 'theme',
      priority: upheldRate >= 45 ? 'critical' : 'important',
    },
    {
      item: 'Confirm the chronology, evidence pack, and explanation of outcome are internally consistent.',
      source: 'theme',
      priority: 'important',
    },
    ...(scope.rootCause
      ? [{
          item: `Address ${scope.rootCause} explicitly in the review, reasoning, and remediation sections.`,
          source: 'root_cause' as const,
          priority: 'important' as const,
        }]
      : []),
  ]);

  return {
    query: {
      product: scope.product,
      rootCause: scope.rootCause,
    },
    generatedAt: new Date().toISOString(),
    riskAssessment: {
      totalCases,
      upheldRate,
      notUpheldRate,
      overallUpheldRate,
      riskLevel,
      trendDirection: 'stable',
    },
    keyPrecedents: [],
    rootCausePatterns: scope.rootCause
      ? [{ label: normalizeTagLabel(scope.rootCause), count: totalCases, upheldRate }]
      : [],
    whatWins: [],
    whatLoses: [],
    sampleCases: sampleRows.map((row) => ({
      caseId: String(row.case_id || ''),
      decisionReference: String(row.decision_reference || ''),
      decisionDate: toIsoDate(row.decision_date),
      firmName: row.firm_name == null ? null : String(row.firm_name),
      outcome: String(row.outcome || 'unknown'),
      decisionSummary: row.decision_summary == null ? null : String(row.decision_summary),
    })),
    recommendedActions: genericActions,
    aiGuidance: null,
  };
}

async function queryOutcomeThemeRows(
  scopeSql: { whereSql: string; params: unknown[] },
  outcome: 'upheld' | 'not_upheld'
): Promise<AdvisorThemeLike[]> {
  const outcomeParamIndex = scopeSql.params.length + 1;
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT
        BTRIM(rc.value) AS theme,
        COUNT(*)::INT AS frequency
      FROM fos_decisions d
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rc(value)
      ${scopeSql.whereSql}
      AND ${outcomeExpression('d')} = $${outcomeParamIndex}
      AND BTRIM(rc.value) <> ''
      GROUP BY BTRIM(rc.value)
      ORDER BY frequency DESC
      LIMIT 5
    `,
    [...scopeSql.params, outcome]
  );

  return rows.map((row) => ({
    theme: normalizeTagLabel(String(row.theme || '')),
    frequency: toInt(row.frequency),
  }));
}

function deriveRecommendedActions(
  precedents: AdvisorPrecedentLike[],
  rootCausePatterns: AdvisorRootCausePatternLike[],
  losingThemeRows: AdvisorThemeLike[]
): ComplaintLetterIntelligenceAction[] {
  const actions: ComplaintLetterIntelligenceAction[] = [];

  for (const row of precedents.slice(0, 2)) {
    const percentOfCases = row.percentOfCases;
    actions.push({
      item: `Review ${row.label} internally before finalising the reasoning.`,
      source: 'precedent',
      priority: percentOfCases >= 20 ? 'critical' : 'important',
    });
  }

  for (const row of rootCausePatterns.filter((item) => item.upheldRate >= 50).slice(0, 2)) {
    const upheldRate = row.upheldRate;
    actions.push({
      item: `Address ${row.label} explicitly in the response and remediation plan.`,
      source: 'root_cause',
      priority: upheldRate >= 65 ? 'critical' : 'important',
    });
  }

  for (const item of losingThemeRows.slice(0, 2)) {
    actions.push({
      item: `Test the draft against the recurring upheld theme of ${item.theme}.`,
      source: 'theme',
      priority: item.frequency >= 5 ? 'important' : 'recommended',
    });
  }

  return dedupeActions(actions);
}

function dedupeActions(actions: ComplaintLetterIntelligenceAction[]): ComplaintLetterIntelligenceAction[] {
  const seen = new Set<string>();
  const result: ComplaintLetterIntelligenceAction[] = [];
  for (const action of actions) {
    const key = `${action.source}:${action.item.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}

function deriveRiskLevel(upheldRate: number): AdvisorRiskAssessmentLike['riskLevel'] {
  if (upheldRate >= 60) return 'very_high';
  if (upheldRate >= 45) return 'high';
  if (upheldRate >= 30) return 'medium';
  return 'low';
}

function buildScopeSql(scope: { product: string; rootCause: string | null }): { whereSql: string; params: unknown[] } {
  const params: unknown[] = [scope.product];
  const conditions = [`COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') = $1`];

  if (scope.rootCause) {
    params.push(scope.rootCause);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS rt(value)
        WHERE LOWER(BTRIM(rt.value)) = LOWER($2)
      )
    `);
  }

  return {
    whereSql: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
}

function isQueryTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return message.includes('query read timeout') || message.includes('statement timeout') || message.includes('timeout');
}
