# Risk Model

## What is live now

Only **Uphold Risk** is live in the product today.

Uphold Risk is an internal signal based on comparable historical Financial Ombudsman Service outcomes. It is used to guide complaint handling caution, review effort, and drafting focus.

It is **not**:
- a regulatory category
- an automatic decision
- a customer-facing statement
- a substitute for case-specific reasoning

## Canonical naming

The canonical internal field name is `upholdRiskLevel`.

For one release, API responses also include a compatibility alias:
- `riskLevel`

That alias is transitional only and maps directly to `upholdRiskLevel`.

## What Uphold Risk means

Uphold Risk answers a narrow internal question:

> Based on similar historical FOS outcomes, how exposed does this complaint context look?

It is closest to a historical uphold-exposure signal. It does **not** represent operational handling quality or systemic remediation risk.

## Current thresholds

The current derivation logic is threshold-based and uses upheld-rate ranges:

- `very_high`: upheld rate `>= 60%`
- `high`: upheld rate `>= 45%` and `< 60%`
- `medium`: upheld rate `>= 30%` and `< 45%`
- `low`: upheld rate `< 30%`

These thresholds are currently hard-coded in the live advisor and complaint-intelligence paths.

## Current minimum-data behavior

There is currently **no separate minimum case-count threshold** for assigning Uphold Risk beyond requiring non-zero comparable case data.

Current live behavior:
- risk classification is assigned when comparable case data exists and `totalCases > 0`
- `sampleSize` is returned so consumers can judge how much data supports the level
- `sampleSize` is currently the same value as `totalCases`

Related thresholds elsewhere in the product:
- year-trend points are only emitted when a year has at least `3` cases
- AI augmentation in the advisor brief generation script only runs when a context has at least `10` cases

Those thresholds do **not** change the core Uphold Risk banding logic.

## Interpretation by level

- `low`: similar historical cases were less frequently upheld
- `medium`: similar historical outcomes are mixed or moderately adverse
- `high`: similar historical cases were often upheld
- `very_high`: similar historical cases were very often upheld

These are internal guidance bands, not outcome determinations.

## Where Uphold Risk is used

Uphold Risk is currently used in internal product surfaces such as:
- advisor intelligence
- complaint letter intelligence
- complaint drafting support and reviewer notes

It is accompanied by `sampleSize` so users can assess confidence in the historical base.

## Allowed uses

Uphold Risk may be used for:
- triage guidance
- investigation prioritisation
- reviewer attention
- drafting caution
- escalation awareness

## Not allowed

Uphold Risk must not be used as:
- automatic complaint outcome determination
- automatic redress or compensation determination
- customer-facing wording presented as fact
- a substitute for case-specific evidence and reasoning

## Future phases

### Operational Risk
Future phase. Not implemented yet.

### Systemic Risk
Future phase. Not implemented yet.

### Configurable policy model
Future phase. Not implemented yet.
