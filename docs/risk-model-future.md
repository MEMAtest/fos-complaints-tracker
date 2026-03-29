# Risk Model — Future Development (Phases 2–4)

This document captures planned but not-yet-implemented risk model phases. These are parked until the product needs them — they should not be built speculatively.

---

## Phase 2: Configurable Uphold Risk Policy Model

### Purpose

Allow authorised users to adjust Uphold Risk thresholds without code changes, with version history and audit trail.

### Scope

- Admin UI for editing upheld-rate thresholds (currently hard-coded at 60/45/30%)
- Draft/publish workflow — changes are staged, reviewed, then activated
- Policy version history with effective dates
- Simulator: preview how threshold changes would reclassify existing briefs before publishing
- Audit log of who changed what and when

### Prerequisites before building

- Multiple firms or tenants using the product with different risk appetites
- Evidence that current thresholds are wrong or need frequent tuning
- Compliance requirement for threshold change audit trails

### Current state

Thresholds are hard-coded in `src/lib/fos/advisor-repository.ts` (line 233) and `scripts/generate-advisor-briefs.ts` (line 240). This works fine for a single-tenant product.

---

## Phase 3: Operational Risk Signal

### Definition

An internal signal showing how much delivery/process risk exists in how a complaint is being handled.

### What it answers

"How likely is this complaint to become problematic because of weak handling, delay, missing evidence, or poor control?"

### Canonical field name

`operationalRiskLevel`

### Output levels

`low` | `medium` | `high` | `critical`

### Required input signals (not yet available)

- SLA state and time-to-resolution tracking
- Missed milestone detection
- Evidence gap analysis (expected vs present documentation)
- Investigation step completeness
- Chronology quality assessment
- Review workflow state (pending, overdue, blocked)
- Letter/response quality signals

### Intended uses

- Complaint ops prioritisation
- Manager queue review and intervention
- Overdue handling alerts
- Work allocation
- Reviewer urgency signals

### Prohibited uses

- Proxy for uphold likelihood (that is Uphold Risk)
- Proxy for systemic misconduct (that is Systemic Risk)

### Prerequisites before building

- Complaint tracking workspace must have mature SLA tracking
- Evidence and milestone state must be reliably populated
- Enough complaint volume to validate the signal

### Current state

Some underlying components exist (SLA automation, actions, evidence state, review workflow) but they are not wired into a scoring model.

---

## Phase 4: Systemic Risk Signal

### Definition

An internal signal showing whether a complaint points to a broader recurring business problem that may need remediation beyond the individual case.

### What it answers

"Does this complaint suggest a repeatable control, process, training, or conduct issue?"

### Canonical field name

`systemicRiskLevel`

### Output levels

`low` | `medium` | `high` | `critical`

### Required input signals (not yet available)

- Recurring root causes across complaints for same firm/product
- Repeat themes in ombudsman reasoning
- Remediation action pattern analysis
- Repeated evidence of the same process failure
- Repeated upheld pattern by context (firm + product + root cause)
- Cross-complaint clustering

### Intended uses

- Management reporting and board pack narrative
- Remediation action planning
- Systemic issue escalation
- Root cause governance
- Complaints MI and trend analysis

### Prohibited uses

- Automatic conduct judgment
- Substitute for broader control or compliance review

### Prerequisites before building

- Cross-complaint pattern detection must be implemented
- Board pack and analytics stack must support systemic grouping
- Enough longitudinal data to detect genuine patterns vs noise

### Current state

Parts of the board-pack and analytics stack already support the underlying evidence base, but no scoring model or signal exists.

---

## Type Definitions (reserved, not yet implemented)

```typescript
type OperationalRiskLevel = 'low' | 'medium' | 'high' | 'critical';
type SystemicRiskLevel = 'low' | 'medium' | 'high' | 'critical';

type RiskSignals = {
  upholdRiskLevel?: UpholdRiskLevel | null;       // Phase 1 — LIVE
  operationalRiskLevel?: OperationalRiskLevel | null; // Phase 3
  systemicRiskLevel?: SystemicRiskLevel | null;       // Phase 4
};
```

---

## Decision Log

| Date | Decision |
|------|----------|
| 2026-03-21 | Three-signal taxonomy defined (Uphold, Operational, Systemic) |
| 2026-03-21 | Phase 1 (Uphold Risk rename + docs) delivered |
| 2026-03-21 | Phases 2–4 parked — build only when prerequisites are met |
| 2026-03-21 | Governance level: lightweight guidance (no heavy committee process) |
