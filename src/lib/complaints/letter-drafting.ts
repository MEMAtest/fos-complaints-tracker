import type { ComplaintLetterIntelligence } from './types';

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

function buildDraftAssistBlock(title: string, lines: string[]): string {
  const content = lines.filter((line) => line.trim().length > 0);
  if (content.length === 0) return `Drafting support - ${title}`;
  return [`Drafting support - ${title}`, ...content.map((line) => `- ${line}`)].join('\n');
}
