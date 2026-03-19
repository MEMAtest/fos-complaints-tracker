export type ComplaintStatus = 'open' | 'investigating' | 'resolved' | 'closed' | 'escalated' | 'referred_to_fos';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ComplaintEvidenceCategory = 'email' | 'statement' | 'screenshot' | 'call_recording' | 'policy_document' | 'letter' | 'other';
export type ComplaintLetterTemplateKey = 'acknowledgement' | 'holding_response' | 'final_response' | 'fos_referral' | 'custom';
export type ComplaintLetterStatus = 'draft' | 'generated' | 'sent';
export type ComplaintActivityType =
  | 'complaint_created'
  | 'status_change'
  | 'letter_generated'
  | 'letter_sent'
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
  category: ComplaintEvidenceCategory;
  summary: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface ComplaintLetter {
  id: string;
  complaintId: string;
  templateKey: ComplaintLetterTemplateKey;
  status: ComplaintLetterStatus;
  subject: string;
  recipientName: string | null;
  recipientEmail: string | null;
  bodyText: string;
  generatedBy: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export const COMPLAINT_LETTER_TEMPLATES: Array<{ key: ComplaintLetterTemplateKey; label: string; description: string }> = [
  { key: 'acknowledgement', label: 'Acknowledgement', description: 'Confirms receipt, scope, investigation steps, and expected timelines.' },
  { key: 'holding_response', label: 'Delay Response', description: 'Eight-week delay response with Ombudsman signposting and next steps.' },
  { key: 'final_response', label: 'Final Response', description: 'Structured final response covering findings, redress, and Ombudsman rights.' },
  { key: 'fos_referral', label: 'FOS Referral', description: 'Explains when and how the complaint can be referred to FOS.' },
  { key: 'custom', label: 'Custom Draft', description: 'Creates a manually-authored letter or response note.' },
];
