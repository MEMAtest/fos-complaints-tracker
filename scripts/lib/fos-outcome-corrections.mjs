// Source-reviewed corrections for structured outcomes that disagree with the
// Ombudsman's final determination. Keep the original outcome_raw on import.
const reviewedDecisions = new Map([
  // https://www.financial-ombudsman.org.uk/decision/DRN-5750765.pdf
  ['DRN-5750765', 'not_upheld'],
]);

export function applyReviewedOutcome(reference, outcome) {
  return reviewedDecisions.get(String(reference ?? '').trim().toUpperCase()) ?? outcome;
}
