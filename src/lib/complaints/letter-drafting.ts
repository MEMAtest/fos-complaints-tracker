import type {
  ComplaintLetterComparableCaseReview,
  ComplaintLetterIntelligence,
  ComplaintLetterIntelligenceSampleCase,
} from './types';

export function buildReviewPointsBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('review before issue', intelligence.draftingGuidance.reviewPoints);
}

export function buildChallengeAreasBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('likely challenge areas', intelligence.draftingGuidance.challengeAreas);
}

export function buildResponseStrengthsBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('possible response strengths', intelligence.draftingGuidance.responseStrengths);
}

export function buildRemediationPromptsBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('remediation prompts', intelligence.draftingGuidance.remediationPrompts);
}

export function buildReferralChecklistBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('file readiness checklist', intelligence.draftingGuidance.referralChecklist);
}

export function buildAcknowledgementScaffoldBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('acknowledgement scaffold', intelligence.draftingGuidance.letterScaffolds.acknowledgement);
}

export function buildHoldingResponseScaffoldBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('holding-response scaffold', intelligence.draftingGuidance.letterScaffolds.holdingResponse);
}

export function buildFinalResponseReviewBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('final-response review scaffold', intelligence.draftingGuidance.letterScaffolds.finalResponseReview);
}

export function buildFinalResponseReasoningBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('final-response reasoning scaffold', intelligence.draftingGuidance.letterScaffolds.finalResponseReasoning);
}

export function buildFinalResponseRedressBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('final-response redress scaffold', intelligence.draftingGuidance.letterScaffolds.finalResponseRedress);
}

export function buildReferralResponseScaffoldBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('referral-response scaffold', intelligence.draftingGuidance.letterScaffolds.referralResponse);
}

export function buildComparableCaseSummaryBlock(intelligence: ComplaintLetterIntelligence): string {
  return buildDraftAssistBlock('comparable-case summary', intelligence.draftingGuidance.comparableCaseSummary);
}

export function buildComparableCaseNoteBlock(sampleCase: ComplaintLetterIntelligenceSampleCase): string {
  const lines = [
    `Comparable case: ${sampleCase.decisionReference}`,
    `Outcome: ${sampleCase.outcome.replace(/_/g, ' ')}`,
    ...(sampleCase.decisionDate ? [`Decision date: ${sampleCase.decisionDate}`] : []),
    ...(sampleCase.firmName ? [`Firm: ${sampleCase.firmName}`] : []),
    ...(sampleCase.summary ? [`Summary: ${sampleCase.summary}`] : []),
  ];
  return buildDraftAssistBlock('comparable-case note', lines);
}

export function buildComparableCaseChallengeBlock(review: ComplaintLetterComparableCaseReview): string {
  return buildDraftAssistBlock(`comparable-case challenge summary (${review.decisionReference})`, review.challengeSummary);
}

export function buildComparableCaseReviewerNoteBlock(review: ComplaintLetterComparableCaseReview): string {
  return buildDraftAssistBlock(`reviewer note (${review.decisionReference})`, review.internalReviewNote);
}

export function buildRiskSnapshotBlock(intelligence: ComplaintLetterIntelligence): string {
  const lines = [
    `Scope used: ${intelligence.sourceScope === 'product_root_cause' ? 'product and root cause' : 'product only'}.`,
    `Similar cases reviewed: ${intelligence.riskSnapshot.totalCases}.`,
    `Upheld rate: ${intelligence.riskSnapshot.upheldRate.toFixed(1)}%.`,
    `Not upheld rate: ${intelligence.riskSnapshot.notUpheldRate.toFixed(1)}%.`,
    `Overall upheld benchmark: ${intelligence.riskSnapshot.overallUpheldRate.toFixed(1)}%.`,
    `Risk level: ${intelligence.riskSnapshot.riskLevel.replace(/_/g, ' ')}.`,
    `Trend direction: ${intelligence.riskSnapshot.trendDirection}.`,
  ];
  return buildDraftAssistBlock('risk snapshot', lines);
}

export function buildPrecedentReviewBlock(intelligence: ComplaintLetterIntelligence): string {
  const lines = intelligence.keyPrecedents.map((item) => (
    `Review ${item.label} internally (${item.count} cases, ${item.percentOfCases.toFixed(1)}% of the similar-case set).`
  ));
  return buildDraftAssistBlock('precedent review note', lines);
}

function buildDraftAssistBlock(title: string, lines: string[]): string {
  const content = lines.filter((line) => line.trim().length > 0);
  if (content.length === 0) return `Drafting support - ${title}`;
  return [`Drafting support - ${title}`, ...content.map((line) => `- ${line}`)].join('\n');
}
