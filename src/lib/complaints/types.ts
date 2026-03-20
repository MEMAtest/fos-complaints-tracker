export type ComplaintStatus = 'open' | 'investigating' | 'resolved' | 'closed' | 'escalated' | 'referred_to_fos';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ComplaintEvidenceCategory = 'email' | 'statement' | 'screenshot' | 'call_recording' | 'policy_document' | 'letter' | 'other';
export type ComplaintLetterTemplateKey = 'acknowledgement' | 'holding_response' | 'final_response' | 'fos_referral' | 'custom';
export type ComplaintLetterStatus = 'draft' | 'generated' | 'under_review' | 'approved' | 'rejected_for_rework' | 'sent' | 'superseded';
export type ComplaintLateReferralPosition = 'review_required' | 'consent' | 'do_not_consent' | 'custom';
export type ComplaintLetterIntelligenceSourceScope = 'product_root_cause' | 'product_only' | 'none';
export type ComplaintWorkspaceActorRole = 'operator' | 'reviewer' | 'manager' | 'admin';
export type ComplaintLetterReviewDecisionCode =
  | 'ready_to_issue'
  | 'reasoning_strengthened'
  | 'evidence_gap'
  | 'template_non_compliant'
  | 'redress_unclear'
  | 'fos_rights_missing'
  | 'other';
export type ComplaintActivityType =
  | 'complaint_created'
  | 'status_change'
  | 'evidence_added'
  | 'evidence_updated'
  | 'evidence_archived'
  | 'evidence_deleted'
  | 'letter_generated'
  | 'letter_submitted_for_review'
  | 'letter_approved'
  | 'letter_rejected'
  | 'letter_sent'
  | 'letter_superseded'
  | 'note_added'
  | 'assigned'
  | 'priority_change'
  | 'fos_referred'
  | 'resolved'
  | 'closed';

export interface ComplaintRecord {
  id: string;
  complaintReference: string;
  linkedFosCaseId: string | null;
  complainantName: string;
  complainantEmail: string | null;
  complainantPhone: string | null;
  complainantAddress: string | null;
  firmName: string;
  product: string | null;
  complaintType: string;
  complaintCategory: string;
  description: string | null;
  receivedDate: string;
  acknowledgedDate: string | null;
  fourWeekDueDate: string | null;
  eightWeekDueDate: string | null;
  finalResponseDate: string | null;
  resolvedDate: string | null;
  rootCause: string | null;
  remedialAction: string | null;
  resolution: string | null;
  compensationAmount: number | null;
  fosReferred: boolean;
  fosOutcome: string | null;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  assignedTo: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintActivity {
  id: string;
  complaintId: string;
  activityType: ComplaintActivityType;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown> | null;
  performedBy: string | null;
  createdAt: string;
}

export interface ComplaintEvidence {
  id: string;
  complaintId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  category: ComplaintEvidenceCategory;
  summary: string | null;
  previewText: string | null;
  uploadedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
}

export interface ComplaintEvidencePreview {
  evidence: ComplaintEvidence;
  previewKind: 'image' | 'pdf' | 'text' | 'download';
  inlineUrl: string;
  downloadUrl: string;
  textPreview: string | null;
}

export interface ComplaintLetter {
  id: string;
  complaintId: string;
  templateKey: ComplaintLetterTemplateKey;
  status: ComplaintLetterStatus;
  versionNumber: number;
  subject: string;
  recipientName: string | null;
  recipientEmail: string | null;
  bodyText: string;
  generatedBy: string | null;
  generatedByRole: ComplaintWorkspaceActorRole;
  updatedBy: string | null;
  updatedByRole: ComplaintWorkspaceActorRole;
  reviewerNotes: string | null;
  approvalRoleRequired: ComplaintWorkspaceActorRole;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedRole: ComplaintWorkspaceActorRole | null;
  reviewDecisionCode: ComplaintLetterReviewDecisionCode | null;
  reviewDecisionNote: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvedRole: ComplaintWorkspaceActorRole | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintLetterVersion {
  id: string;
  letterId: string;
  complaintId: string;
  versionNumber: number;
  status: ComplaintLetterStatus;
  subject: string;
  recipientName: string | null;
  recipientEmail: string | null;
  bodyText: string;
  reviewerNotes: string | null;
  approvalRoleRequired: ComplaintWorkspaceActorRole;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedRole: ComplaintWorkspaceActorRole | null;
  reviewDecisionCode: ComplaintLetterReviewDecisionCode | null;
  reviewDecisionNote: string | null;
  approvedRole: ComplaintWorkspaceActorRole | null;
  snapshotReason: string | null;
  snapshotBy: string | null;
  snapshotByRole: ComplaintWorkspaceActorRole | null;
  createdAt: string;
}

export interface ComplaintWorkspaceSettings {
  organizationName: string;
  complaintsTeamName: string;
  complaintsEmail: string | null;
  complaintsPhone: string | null;
  complaintsAddress: string | null;
  boardPackSubtitle: string | null;
  lateReferralPosition: ComplaintLateReferralPosition;
  lateReferralCustomText: string | null;
  currentActorName: string;
  currentActorRole: ComplaintWorkspaceActorRole;
  letterApprovalRole: ComplaintWorkspaceActorRole;
  requireIndependentReviewer: boolean;
  updatedAt: string;
}

export interface ComplaintLetterIntelligenceTheme {
  theme: string;
  frequency: number;
}

export interface ComplaintLetterIntelligencePrecedent {
  label: string;
  count: number;
  percentOfCases: number;
}

export interface ComplaintLetterIntelligenceSampleCase {
  caseId: string;
  decisionReference: string;
  decisionDate: string | null;
  firmName: string | null;
  outcome: string;
  summary: string | null;
}

export interface ComplaintLetterComparableCaseReview {
  caseId: string;
  decisionReference: string;
  internalReviewNote: string[];
  challengeSummary: string[];
}

export interface ComplaintLetterIntelligenceAction {
  item: string;
  source: 'precedent' | 'root_cause' | 'theme' | 'vulnerability';
  priority: 'critical' | 'important' | 'recommended';
}

export interface ComplaintLetterIntelligence {
  complaintId: string;
  sourceScope: ComplaintLetterIntelligenceSourceScope;
  product: string;
  rootCause: string | null;
  generatedAt: string;
  riskSnapshot: {
    totalCases: number;
    upheldRate: number;
    notUpheldRate: number;
    overallUpheldRate: number;
    riskLevel: 'low' | 'medium' | 'high' | 'very_high';
    trendDirection: 'improving' | 'stable' | 'worsening';
  };
  draftingGuidance: {
    reviewPoints: string[];
    challengeAreas: string[];
    responseStrengths: string[];
    remediationPrompts: string[];
    referralChecklist: string[];
    letterScaffolds: {
      acknowledgement: string[];
      holdingResponse: string[];
      finalResponseReview: string[];
      finalResponseReasoning: string[];
      finalResponseRedress: string[];
      referralResponse: string[];
    };
    comparableCaseSummary: string[];
    comparableCaseReviews: ComplaintLetterComparableCaseReview[];
  };
  keyPrecedents: ComplaintLetterIntelligencePrecedent[];
  sampleCases: ComplaintLetterIntelligenceSampleCase[];
  whatWins: ComplaintLetterIntelligenceTheme[];
  whatLoses: ComplaintLetterIntelligenceTheme[];
  rootCausePatterns: Array<{ label: string; count: number; upheldRate: number }>;
  recommendedActions: ComplaintLetterIntelligenceAction[];
  aiGuidance: string | null;
}

export interface ComplaintLetterIntelligenceResponse {
  success: boolean;
  data?: ComplaintLetterIntelligence | null;
  meta?: {
    complaintId: string;
    sourceScope: ComplaintLetterIntelligenceSourceScope;
    generatedAt: string;
  };
  reason?: string;
  error?: string;
}

export interface ComplaintFilters {
  query: string;
  status: ComplaintStatus | 'all';
  priority: ComplaintPriority | 'all';
  firm: string;
  product: string;
  fosReferred: 'all' | 'yes' | 'no';
  page: number;
  pageSize: number;
}

export interface ComplaintStats {
  totalComplaints: number;
  openComplaints: number;
  referredToFos: number;
  overdueComplaints: number;
  urgentComplaints: number;
}

export interface ComplaintListResult {
  records: ComplaintRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: ComplaintStats;
}

export interface ComplaintImportPreviewRow {
  rowNumber: number;
  complaintReference: string | null;
  action: 'new' | 'overwrite' | 'duplicate_in_file' | 'invalid';
  normalizedFields: Record<string, unknown>;
  issues: string[];
}

export interface ComplaintImportPreviewResponse {
  success: boolean;
  preview: true;
  fileName: string;
  summary: {
    totalRows: number;
    validRows: number;
    newCount: number;
    overwriteCount: number;
    duplicateCount: number;
    invalidCount: number;
  };
  rows: ComplaintImportPreviewRow[];
  warnings: string[];
}

export interface ComplaintImportCommitResponse {
  success: boolean;
  preview: false;
  importedCount: number;
  overwrittenCount: number;
  skippedCount: number;
  importRunId: string;
  warnings: string[];
}

export interface ComplaintImportRun {
  id: string;
  fileName: string;
  status: 'success' | 'partial' | 'failed';
  totalRows: number;
  importedCount: number;
  overwrittenCount: number;
  skippedCount: number;
  createdBy: string | null;
  createdAt: string;
  warnings: string[];
}

export type ComplaintWorkspaceSettingsInput = Partial<Omit<ComplaintWorkspaceSettings, 'updatedAt'>>;

export type ComplaintMutationInput = Partial<Omit<ComplaintRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>> & {
  complaintReference?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export const COMPLAINT_EVIDENCE_CATEGORIES: ComplaintEvidenceCategory[] = [
  'email',
  'statement',
  'screenshot',
  'call_recording',
  'policy_document',
  'letter',
  'other',
];

export const COMPLAINT_WORKSPACE_ACTOR_ROLES: ComplaintWorkspaceActorRole[] = [
  'operator',
  'reviewer',
  'manager',
  'admin',
];

export const COMPLAINT_LETTER_REVIEW_DECISION_CODES: ComplaintLetterReviewDecisionCode[] = [
  'ready_to_issue',
  'reasoning_strengthened',
  'evidence_gap',
  'template_non_compliant',
  'redress_unclear',
  'fos_rights_missing',
  'other',
];

export const COMPLAINT_LETTER_TEMPLATES: Array<{ key: ComplaintLetterTemplateKey; label: string; description: string }> = [
  { key: 'acknowledgement', label: 'Acknowledgement', description: 'Confirms receipt, scope, investigation steps, and expected timelines.' },
  { key: 'holding_response', label: 'Delay Response', description: 'Eight-week delay response with Ombudsman signposting, time-limit note, and next steps.' },
  { key: 'final_response', label: 'Final Response', description: 'Structured final response covering findings, redress, Ombudsman rights, and the late-referral review note.' },
  { key: 'fos_referral', label: 'FOS Referral', description: 'Explains when and how the complaint can be referred to FOS, including the late-referral review note.' },
  { key: 'custom', label: 'Custom Draft', description: 'Creates a manually-authored letter or response note.' },
];
