import { readSheet, type CellValue } from 'read-excel-file/node';
import { parse as parseCsv } from 'csv-parse/sync';
import type { ComplaintImportPreviewRow, ComplaintMutationInput } from './types';

const MAX_IMPORT_ROWS = 5_000;
const MAX_IMPORT_COLUMNS = 100;
const MAX_CELL_LENGTH = 5_000;
const MAX_XLSX_ARCHIVE_ENTRIES = 2_000;
const MAX_XLSX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

export class ComplaintImportValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ComplaintImportValidationError';
  }
}

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
  firm_name: 'firmName',
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

export async function parseComplaintImportFile(fileName: string, buffer: Buffer): Promise<{
  fileName: string;
  rows: Array<{ rowNumber: number; normalizedFields: ComplaintMutationInput; issues: string[] }>;
  warnings: string[];
}> {
  const lowerName = fileName.trim().toLowerCase();
  const warnings: string[] = [];
  let sheetRows: Array<Array<CellValue | null>>;

  if (lowerName.endsWith('.csv')) {
    try {
      sheetRows = parseCsv(buffer, {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: true,
      }) as string[][];
    } catch {
      throw new ComplaintImportValidationError('Unable to read the uploaded CSV file.');
    }
  } else if (lowerName.endsWith('.xlsx')) {
    validateXlsxArchive(buffer);
    try {
      sheetRows = await readSheet(buffer, 1, { dateFormat: 'yyyy-mm-dd' });
    } catch {
      throw new ComplaintImportValidationError('Unable to read the uploaded XLSX file.');
    }
    if (sheetRows.length === 0) {
      throw new ComplaintImportValidationError('No worksheet found in uploaded file.');
    }
  } else {
    throw new ComplaintImportValidationError('Unsupported file type. Use CSV or .xlsx Excel files.');
  }

  const rawRows = buildRecordRows(sheetRows);
  const rows = rawRows.map((row, index) => normalizeComplaintImportRow(index + 2, row));
  return { fileName, rows, warnings };
}

function validateXlsxArchive(buffer: Buffer): void {
  // XLSX is a ZIP container. Inspect its central directory before decompression
  // so a small compressed upload cannot expand without a bounded ceiling.
  const minimumEocdSize = 22;
  const maximumCommentSize = 65_535;
  const searchStart = Math.max(0, buffer.length - minimumEocdSize - maximumCommentSize);
  let eocdOffset = -1;

  for (let offset = buffer.length - minimumEocdSize; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new ComplaintImportValidationError('Unable to read the uploaded XLSX file.');
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    entryCount > MAX_XLSX_ARCHIVE_ENTRIES ||
    centralDirectoryOffset + centralDirectorySize > buffer.length
  ) {
    throw new ComplaintImportValidationError('The uploaded XLSX archive is too large or unsupported.');
  }

  let offset = centralDirectoryOffset;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new ComplaintImportValidationError('Unable to read the uploaded XLSX file.');
    }

    totalUncompressedBytes += buffer.readUInt32LE(offset + 24);
    if (totalUncompressedBytes > MAX_XLSX_UNCOMPRESSED_BYTES) {
      throw new ComplaintImportValidationError('The uploaded XLSX archive expands beyond the 50 MB safety limit.');
    }

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
}

function buildRecordRows(sheetRows: Array<Array<CellValue | null>>): Record<string, unknown>[] {
  if (sheetRows.length === 0) {
    throw new ComplaintImportValidationError('No worksheet rows found in uploaded file.');
  }
  if (sheetRows.length - 1 > MAX_IMPORT_ROWS) {
    throw new ComplaintImportValidationError(`Import files are limited to ${MAX_IMPORT_ROWS.toLocaleString()} data rows.`);
  }

  const headerRow = sheetRows[0] || [];
  if (headerRow.length === 0) {
    throw new ComplaintImportValidationError('No header row found in uploaded file.');
  }
  if (headerRow.length > MAX_IMPORT_COLUMNS) {
    throw new ComplaintImportValidationError(`Import files are limited to ${MAX_IMPORT_COLUMNS} columns.`);
  }

  const headers = headerRow.map((value) => sanitizeCellValue(value));
  return sheetRows.slice(1).map((row) => {
    if (row.length > MAX_IMPORT_COLUMNS) {
      throw new ComplaintImportValidationError(`Import files are limited to ${MAX_IMPORT_COLUMNS} columns.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, sanitizeCellValue(row[index])])) as Record<string, unknown>;
  });
}

function sanitizeCellValue(value: CellValue | null | undefined): string | number | boolean | Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value ?? '').trim().slice(0, MAX_CELL_LENGTH);
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
