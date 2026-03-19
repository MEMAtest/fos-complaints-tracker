import * as XLSX from 'xlsx';
import type { ComplaintImportPreviewRow, ComplaintMutationInput } from './types';

const HEADER_ALIASES: Record<string, keyof ComplaintMutationInput> = {
  ref: 'complaintReference',
  complaintreference: 'complaintReference',
  complaintref: 'complaintReference',
  complaint_ref: 'complaintReference',
  complaint_reference: 'complaintReference',
  reference: 'complaintReference',
  complainantname: 'complainantName',
  complainant_name: 'complainantName',
  complainant: 'complainantName',
  customer_name: 'complainantName',
  customername: 'complainantName',
  date_received: 'receivedDate',
  receiveddate: 'receivedDate',
  received_date: 'receivedDate',
  datereceived: 'receivedDate',
  received: 'receivedDate',
  firmname: 'firmName',
  firm: 'firmName',
  business_name: 'firmName',
  product: 'product',
  producttype: 'product',
  product_type: 'product',
  complainttype: 'complaintType',
  complaint_type: 'complaintType',
  complaintcategory: 'complaintCategory',
  complaint_category: 'complaintCategory',
  description: 'description',
  notes: 'notes',
  rootcause: 'rootCause',
  root_cause: 'rootCause',
  remedialaction: 'remedialAction',
  remedial_action: 'remedialAction',
  resolution: 'resolution',
  compensationamount: 'compensationAmount',
  compensation_amount: 'compensationAmount',
  fosreferred: 'fosReferred',
  fos_referred: 'fosReferred',
  fosoutcome: 'fosOutcome',
  fos_outcome: 'fosOutcome',
  status: 'status',
  priority: 'priority',
  assignedto: 'assignedTo',
  assigned_to: 'assignedTo',
  linkedfoscaseid: 'linkedFosCaseId',
  linked_fos_case_id: 'linkedFosCaseId',
  complainantemail: 'complainantEmail',
  complainant_email: 'complainantEmail',
  complainantphone: 'complainantPhone',
  complainant_phone: 'complainantPhone',
  complainantaddress: 'complainantAddress',
  complainant_address: 'complainantAddress',
};

const VALID_STATUSES = new Set(['open', 'investigating', 'resolved', 'closed', 'escalated', 'referred_to_fos']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

export function parseComplaintImportFile(fileName: string, buffer: Buffer): {
  fileName: string;
  rows: Array<{ rowNumber: number; normalizedFields: ComplaintMutationInput; issues: string[] }>;
  warnings: string[];
} {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    throw new Error('No worksheet found in uploaded file.');
  }

  const sheet = workbook.Sheets[firstSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  const warnings: string[] = [];
  if (workbook.SheetNames.length > 1) {
    warnings.push(`Only the first worksheet (${firstSheet}) was processed.`);
  }

  const rows = rawRows.map((row, index) => normalizeComplaintImportRow(index + 2, row));
  return { fileName, rows, warnings };
}

export function buildComplaintImportRows(params: {
  parsedRows: Array<{ rowNumber: number; normalizedFields: ComplaintMutationInput; issues: string[] }>;
  existingReferences: Set<string>;
}): ComplaintImportPreviewRow[] {
  const seen = new Set<string>();
  return params.parsedRows.map((row) => {
    const complaintReference = sanitizeText(row.normalizedFields.complaintReference);
    const issues = [...row.issues];
    let action: ComplaintImportPreviewRow['action'] = 'new';

    if (!complaintReference) {
      issues.push('Missing complaint reference.');
      action = 'invalid';
    } else if (seen.has(complaintReference.toLowerCase())) {
      issues.push('Duplicate complaint reference in uploaded file.');
      action = 'duplicate_in_file';
    } else if (params.existingReferences.has(complaintReference.toLowerCase())) {
      action = 'overwrite';
    }

    if (issues.length > 0 && action === 'new') {
      action = 'invalid';
    }

    if (complaintReference) {
      seen.add(complaintReference.toLowerCase());
    }

    return {
      rowNumber: row.rowNumber,
      complaintReference: complaintReference || null,
      action,
      normalizedFields: row.normalizedFields as Record<string, unknown>,
      issues,
    };
  });
}

function normalizeComplaintImportRow(rowNumber: number, raw: Record<string, unknown>) {
  const normalizedFields: ComplaintMutationInput = {};
  const issues: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    const canonical = HEADER_ALIASES[normalizeHeader(key)];
    if (!canonical) continue;
    assignField(normalizedFields, canonical, value);
  }

  normalizedFields.complaintReference = sanitizeText(normalizedFields.complaintReference);
  normalizedFields.complainantName = sanitizeText(normalizedFields.complainantName);
  normalizedFields.firmName = sanitizeText(normalizedFields.firmName) || 'Unknown firm';
  normalizedFields.receivedDate = normalizeDate(normalizedFields.receivedDate) || undefined;
  normalizedFields.status = normalizeStatus(normalizedFields.status);
  normalizedFields.priority = normalizePriority(normalizedFields.priority);
  normalizedFields.fosReferred = normalizeBoolean(normalizedFields.fosReferred);
  normalizedFields.compensationAmount = normalizeNumber(normalizedFields.compensationAmount);
  normalizedFields.product = sanitizeNullable(normalizedFields.product);
  normalizedFields.description = sanitizeNullable(normalizedFields.description);
  normalizedFields.notes = sanitizeNullable(normalizedFields.notes);
  normalizedFields.rootCause = sanitizeNullable(normalizedFields.rootCause);
  normalizedFields.remedialAction = sanitizeNullable(normalizedFields.remedialAction);
  normalizedFields.resolution = sanitizeNullable(normalizedFields.resolution);
  normalizedFields.fosOutcome = sanitizeNullable(normalizedFields.fosOutcome);
  normalizedFields.assignedTo = sanitizeNullable(normalizedFields.assignedTo);
  normalizedFields.linkedFosCaseId = sanitizeNullable(normalizedFields.linkedFosCaseId);
  normalizedFields.complainantEmail = sanitizeNullable(normalizedFields.complainantEmail);
  normalizedFields.complainantPhone = sanitizeNullable(normalizedFields.complainantPhone);
  normalizedFields.complainantAddress = sanitizeNullable(normalizedFields.complainantAddress);
  normalizedFields.complaintType = sanitizeText(normalizedFields.complaintType) || 'general';
  normalizedFields.complaintCategory = sanitizeText(normalizedFields.complaintCategory) || 'pending';

  if (!normalizedFields.complaintReference) issues.push('Complaint reference is required.');
  if (!normalizedFields.complainantName) issues.push('Complainant name is required.');
  if (!normalizedFields.receivedDate) issues.push('Received date is required or invalid.');

  return { rowNumber, normalizedFields, issues };
}

function assignField(target: ComplaintMutationInput, key: keyof ComplaintMutationInput, value: unknown) {
  if (key === 'fosReferred') {
    (target as Record<string, unknown>)[key] = normalizeBoolean(value);
    return;
  }
  if (key === 'compensationAmount') {
    (target as Record<string, unknown>)[key] = normalizeNumber(value);
    return;
  }
  (target as Record<string, unknown>)[key] = typeof value === 'string' ? value.trim() : value;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeStatus(value: unknown): ComplaintMutationInput['status'] {
  const text = sanitizeText(value).toLowerCase().replace(/\s+/g, '_');
  return VALID_STATUSES.has(text) ? (text as ComplaintMutationInput['status']) : 'open';
}

function normalizePriority(value: unknown): ComplaintMutationInput['priority'] {
  const text = sanitizeText(value).toLowerCase();
  return VALID_PRIORITIES.has(text) ? (text as ComplaintMutationInput['priority']) : 'medium';
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const text = sanitizeText(value).toLowerCase();
  return ['yes', 'true', '1', 'y'].includes(text);
}

function normalizeNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function sanitizeNullable(value: unknown): string | null {
  const text = sanitizeText(value);
  return text ? text : null;
}
