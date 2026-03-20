import { createHash } from 'crypto';
import { pool, DatabaseClient } from '@/lib/database';
import type { PoolClient } from 'pg';
import {
  ComplaintActivity,
  ComplaintActivityType,
  ComplaintEvidence,
  ComplaintEvidenceCategory,
  ComplaintFilters,
  ComplaintImportPreviewRow,
  ComplaintImportRun,
  ComplaintLateReferralPosition,
  ComplaintLetter,
  ComplaintLetterVersion,
  ComplaintLetterStatus,
  ComplaintLetterTemplateKey,
  ComplaintListResult,
  ComplaintMutationInput,
  ComplaintPriority,
  ComplaintRecord,
  ComplaintStatus,
  ComplaintStats,
  ComplaintWorkspaceSettings,
  ComplaintWorkspaceSettingsInput,
  COMPLAINT_EVIDENCE_CATEGORIES,
} from './types';
import { buildComplaintLetterDraft } from './letter-templates';
import { ensureComplaintsWorkspaceSchema } from './schema';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const VALID_STATUSES: ComplaintStatus[] = ['open', 'investigating', 'resolved', 'closed', 'escalated', 'referred_to_fos'];
const VALID_PRIORITIES: ComplaintPriority[] = ['low', 'medium', 'high', 'urgent'];
const VALID_EVIDENCE_CATEGORIES: ComplaintEvidenceCategory[] = [...COMPLAINT_EVIDENCE_CATEGORIES];
const VALID_LETTER_TEMPLATE_KEYS: ComplaintLetterTemplateKey[] = ['acknowledgement', 'holding_response', 'final_response', 'fos_referral', 'custom'];
const VALID_LETTER_STATUSES: ComplaintLetterStatus[] = ['draft', 'generated', 'approved', 'sent', 'superseded'];
const VALID_LATE_REFERRAL_POSITIONS: ComplaintLateReferralPosition[] = ['review_required', 'consent', 'do_not_consent', 'custom'];
const VALID_ACTIVITY_TYPES: ComplaintActivityType[] = [
  'complaint_created',
  'status_change',
  'letter_generated',
  'letter_approved',
  'letter_sent',
  'letter_superseded',
  'note_added',
  'assigned',
  'priority_change',
  'fos_referred',
  'resolved',
  'closed',
];

const DEFAULT_COMPLAINT_WORKSPACE_SETTINGS: ComplaintWorkspaceSettings = {
  organizationName: 'MEMA Consultants',
  complaintsTeamName: 'Complaints Team',
  complaintsEmail: null,
  complaintsPhone: null,
  complaintsAddress: null,
  boardPackSubtitle: 'Board-ready complaints and ombudsman intelligence pack',
  lateReferralPosition: 'review_required',
  lateReferralCustomText: null,
  updatedAt: new Date(0).toISOString(),
};

export function parseComplaintFilters(searchParams: URLSearchParams): ComplaintFilters {
  const statusRaw = (searchParams.get('status') || 'all').trim();
  const priorityRaw = (searchParams.get('priority') || 'all').trim();
  const fosReferredRaw = (searchParams.get('fosReferred') || 'all').trim();
  return {
    query: (searchParams.get('query') || '').trim(),
    status: statusRaw === 'all' || VALID_STATUSES.includes(statusRaw as ComplaintStatus) ? (statusRaw as ComplaintStatus | 'all') : 'all',
    priority: priorityRaw === 'all' || VALID_PRIORITIES.includes(priorityRaw as ComplaintPriority)
      ? (priorityRaw as ComplaintPriority | 'all')
      : 'all',
    firm: (searchParams.get('firm') || '').trim(),
    product: (searchParams.get('product') || '').trim(),
    fosReferred: ['yes', 'no', 'all'].includes(fosReferredRaw) ? (fosReferredRaw as 'all' | 'yes' | 'no') : 'all',
    page: clamp(parsePositiveInt(searchParams.get('page'), DEFAULT_PAGE), 1, 10_000),
    pageSize: clamp(parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE), 5, MAX_PAGE_SIZE),
  };
}

export async function getComplaintWorkspaceSettings(): Promise<ComplaintWorkspaceSettings> {
  await ensureComplaintsWorkspaceSchema();
  const row = await DatabaseClient.queryOne<Record<string, unknown>>(
    `SELECT * FROM complaints_workspace_settings WHERE singleton = TRUE`
  );

  return row ? mapComplaintWorkspaceSettings(row) : { ...DEFAULT_COMPLAINT_WORKSPACE_SETTINGS };
}

export async function updateComplaintWorkspaceSettings(input: ComplaintWorkspaceSettingsInput): Promise<ComplaintWorkspaceSettings> {
  await ensureComplaintsWorkspaceSchema();
  const current = await getComplaintWorkspaceSettings();
  const payload = normalizeComplaintWorkspaceSettingsInput(input, current);
  const row = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
      INSERT INTO complaints_workspace_settings (
        singleton,
        organization_name,
        complaints_team_name,
        complaints_email,
        complaints_phone,
        complaints_address,
        board_pack_subtitle,
        late_referral_position,
        late_referral_custom_text,
        updated_at
      ) VALUES (
        TRUE, $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
      ON CONFLICT (singleton)
      DO UPDATE SET
        organization_name = EXCLUDED.organization_name,
        complaints_team_name = EXCLUDED.complaints_team_name,
        complaints_email = EXCLUDED.complaints_email,
        complaints_phone = EXCLUDED.complaints_phone,
        complaints_address = EXCLUDED.complaints_address,
        board_pack_subtitle = EXCLUDED.board_pack_subtitle,
        late_referral_position = EXCLUDED.late_referral_position,
        late_referral_custom_text = EXCLUDED.late_referral_custom_text,
        updated_at = NOW()
      RETURNING *
    `,
    [
      payload.organizationName,
      payload.complaintsTeamName,
      payload.complaintsEmail,
      payload.complaintsPhone,
      payload.complaintsAddress,
      payload.boardPackSubtitle,
      payload.lateReferralPosition,
      payload.lateReferralCustomText,
    ]
  );

  return mapComplaintWorkspaceSettings(row || {});
}

export async function listComplaints(filters: ComplaintFilters): Promise<ComplaintListResult> {
  await ensureComplaintsWorkspaceSchema();
  const where = buildComplaintWhereClause(filters, 1);
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, totalRow, statsRow] = await Promise.all([
    DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT *
        FROM complaints_records
        ${where.whereSql}
        ORDER BY received_date DESC, created_at DESC
        LIMIT $${where.nextIndex}
        OFFSET $${where.nextIndex + 1}
      `,
      [...where.params, filters.pageSize, offset]
    ),
    DatabaseClient.queryOne<{ total_rows: number }>(
      `SELECT COUNT(*)::INT AS total_rows FROM complaints_records ${where.whereSql}`,
      where.params
    ),
    DatabaseClient.queryOne<Record<string, unknown>>(
      `
        SELECT
          COUNT(*)::INT AS total_complaints,
          COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed'))::INT AS open_complaints,
          COUNT(*) FILTER (WHERE fos_referred = TRUE)::INT AS referred_to_fos,
          COUNT(*) FILTER (
            WHERE status NOT IN ('resolved', 'closed')
              AND eight_week_due_date IS NOT NULL
              AND eight_week_due_date < CURRENT_DATE
          )::INT AS overdue_complaints,
          COUNT(*) FILTER (WHERE priority = 'urgent')::INT AS urgent_complaints
        FROM complaints_records
        ${where.whereSql}
      `,
      where.params
    ),
  ]);

  const total = toInt(totalRow?.total_rows);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return {
    records: rows.map(mapComplaintRecord),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages,
    stats: mapComplaintStats(statsRow),
  };
}

export async function getComplaintById(id: string): Promise<ComplaintRecord | null> {
  await ensureComplaintsWorkspaceSchema();
  const row = await DatabaseClient.queryOne<Record<string, unknown>>(
    `SELECT * FROM complaints_records WHERE id = $1`,
    [id]
  );
  return row ? mapComplaintRecord(row) : null;
}

export async function listComplaintActivities(complaintId: string): Promise<ComplaintActivity[]> {
  await ensureComplaintsWorkspaceSchema();
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT *
      FROM complaint_activities
      WHERE complaint_id = $1
      ORDER BY created_at DESC
    `,
    [complaintId]
  );
  return rows.map(mapComplaintActivity);
}

export async function listComplaintEvidence(complaintId: string): Promise<ComplaintEvidence[]> {
  await ensureComplaintsWorkspaceSchema();
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT id, complaint_id, file_name, content_type, file_size, category, summary, uploaded_by, created_at
      FROM complaint_evidence
      WHERE complaint_id = $1
      ORDER BY created_at DESC
    `,
    [complaintId]
  );

  return rows.map(mapComplaintEvidence);
}

export async function getComplaintEvidenceContent(evidenceId: string): Promise<{
  id: string;
  complaintId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  fileBytes: Buffer;
} | null> {
  await ensureComplaintsWorkspaceSchema();
  const row = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
      SELECT id, complaint_id, file_name, content_type, file_size, file_bytes
      FROM complaint_evidence
      WHERE id = $1
    `,
    [evidenceId]
  );

  if (!row) return null;
  const rawBytes = row.file_bytes;
  const fileBytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(String(rawBytes || ''), 'binary');

  return {
    id: String(row.id || ''),
    complaintId: String(row.complaint_id || ''),
    fileName: String(row.file_name || 'evidence.bin'),
    contentType: String(row.content_type || 'application/octet-stream'),
    fileSize: toInt(row.file_size),
    fileBytes,
  };
}

export async function createComplaintEvidence(input: {
  complaintId: string;
  fileName: string;
  contentType?: string | null;
  fileBytes: Buffer;
  category?: ComplaintEvidenceCategory | null;
  summary?: string | null;
  uploadedBy?: string | null;
}): Promise<ComplaintEvidence> {
  await ensureComplaintsWorkspaceSchema();
  const category = normalizeEvidenceCategory(input.category);
  const fileName = sanitizeText(input.fileName) || 'complaint-evidence.bin';
  const contentType = sanitizeText(input.contentType) || 'application/octet-stream';
  const summary = sanitizeNullable(input.summary);
  const sha256 = createHash('sha256').update(input.fileBytes).digest('hex');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const inserted = await client.query<Record<string, unknown>>(
      `
        INSERT INTO complaint_evidence (
          complaint_id,
          file_name,
          content_type,
          file_size,
          category,
          summary,
          file_bytes,
          sha256,
          uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, complaint_id, file_name, content_type, file_size, category, summary, uploaded_by, created_at
      `,
      [
        input.complaintId,
        fileName,
        contentType,
        input.fileBytes.length,
        category,
        summary,
        input.fileBytes,
        sha256,
        sanitizeNullable(input.uploadedBy),
      ]
    );

    const row = inserted.rows[0];
    await insertComplaintActivityTx(client, {
      complaintId: input.complaintId,
      activityType: 'note_added',
      description: `Evidence added: ${fileName}.`,
      performedBy: input.uploadedBy,
      metadata: {
        source: 'evidence',
        evidenceId: String(row.id),
        fileName,
        category,
      },
    });

    await client.query('COMMIT');
    return mapComplaintEvidence(row);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listComplaintLetters(complaintId: string): Promise<ComplaintLetter[]> {
  await ensureComplaintsWorkspaceSchema();
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT *
      FROM complaint_letters
      WHERE complaint_id = $1
      ORDER BY created_at DESC
    `,
    [complaintId]
  );

  return rows.map(mapComplaintLetter);
}

export async function listComplaintLetterVersions(letterId: string): Promise<ComplaintLetterVersion[]> {
  await ensureComplaintsWorkspaceSchema();
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT *
      FROM complaint_letter_versions
      WHERE letter_id = $1
      ORDER BY version_number DESC, created_at DESC
    `,
    [letterId]
  );

  return rows.map(mapComplaintLetterVersion);
}

export async function getComplaintLetterContext(letterId: string): Promise<{
  complaint: ComplaintRecord;
  letter: ComplaintLetter;
  settings: ComplaintWorkspaceSettings;
} | null> {
  await ensureComplaintsWorkspaceSchema();
  const [row, settings] = await Promise.all([
    DatabaseClient.queryOne<Record<string, unknown>>(
      `
        SELECT
          l.*,
          c.id AS complaint_id_value,
          c.complaint_reference,
          c.linked_fos_case_id,
          c.complainant_name,
          c.complainant_email,
          c.complainant_phone,
          c.complainant_address,
          c.firm_name,
          c.product,
          c.complaint_type,
          c.complaint_category,
          c.description,
          c.received_date,
          c.acknowledged_date,
          c.four_week_due_date,
          c.eight_week_due_date,
          c.final_response_date,
          c.resolved_date,
          c.root_cause,
          c.remedial_action,
          c.resolution,
          c.compensation_amount,
          c.fos_referred,
          c.fos_outcome,
          c.status AS complaint_status,
          c.priority AS complaint_priority,
          c.assigned_to,
          c.notes,
          c.created_by,
          c.updated_by,
          c.created_at AS complaint_created_at,
          c.updated_at AS complaint_updated_at
        FROM complaint_letters l
        INNER JOIN complaints_records c ON c.id = l.complaint_id
        WHERE l.id = $1
      `,
      [letterId]
    ),
    getComplaintWorkspaceSettings(),
  ]);

  if (!row) return null;

  const complaint = mapComplaintRecord({
    id: row.complaint_id_value,
    complaint_reference: row.complaint_reference,
    linked_fos_case_id: row.linked_fos_case_id,
    complainant_name: row.complainant_name,
    complainant_email: row.complainant_email,
    complainant_phone: row.complainant_phone,
    complainant_address: row.complainant_address,
    firm_name: row.firm_name,
    product: row.product,
    complaint_type: row.complaint_type,
    complaint_category: row.complaint_category,
    description: row.description,
    received_date: row.received_date,
    acknowledged_date: row.acknowledged_date,
    four_week_due_date: row.four_week_due_date,
    eight_week_due_date: row.eight_week_due_date,
    final_response_date: row.final_response_date,
    resolved_date: row.resolved_date,
    root_cause: row.root_cause,
    remedial_action: row.remedial_action,
    resolution: row.resolution,
    compensation_amount: row.compensation_amount,
    fos_referred: row.fos_referred,
    fos_outcome: row.fos_outcome,
    status: row.complaint_status,
    priority: row.complaint_priority,
    assigned_to: row.assigned_to,
    notes: row.notes,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.complaint_created_at,
    updated_at: row.complaint_updated_at,
  });

  return {
    complaint,
    letter: mapComplaintLetter(row),
    settings,
  };
}

export async function createComplaintLetter(input: {
  complaintId: string;
  templateKey: ComplaintLetterTemplateKey;
  subject?: string | null;
  bodyText?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  generatedBy?: string | null;
}): Promise<ComplaintLetter> {
  await ensureComplaintsWorkspaceSchema();
  const [complaint, settings] = await Promise.all([
    getComplaintById(input.complaintId),
    getComplaintWorkspaceSettings(),
  ]);
  if (!complaint) {
    throw new Error('Complaint not found.');
  }

  const templateKey = normalizeLetterTemplateKey(input.templateKey);
  const draft = buildComplaintLetterDraft(complaint, templateKey, settings, {
    subject: input.subject,
    bodyText: input.bodyText,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
  });
  const status: ComplaintLetterStatus = templateKey === 'custom' ? 'draft' : 'generated';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const inserted = await client.query<Record<string, unknown>>(
      `
        INSERT INTO complaint_letters (
          complaint_id,
          template_key,
          status,
          version_number,
          subject,
          recipient_name,
          recipient_email,
          body_text,
          generated_by,
          approved_at,
          approved_by,
          sent_at,
          updated_at
        ) VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, NULL, NULL, NULL, NOW())
        RETURNING *
      `,
      [
        input.complaintId,
        templateKey,
        status,
        draft.subject,
        draft.recipientName,
        draft.recipientEmail,
        draft.bodyText,
        sanitizeNullable(input.generatedBy),
      ]
    );

    const row = inserted.rows[0];
    await insertComplaintLetterVersionTx(client, {
      letter: row,
      complaintId: input.complaintId,
      snapshotReason: templateKey === 'custom' ? 'Initial custom draft created.' : `${labelForLetterTemplate(templateKey)} generated.`,
      snapshotBy: input.generatedBy,
    });
    await insertComplaintActivityTx(client, {
      complaintId: input.complaintId,
      activityType: 'letter_generated',
      description: `${labelForLetterTemplate(templateKey)} generated.`,
      performedBy: input.generatedBy,
      metadata: {
        letterId: String(row.id),
        templateKey,
        subject: draft.subject,
      },
    });

    await client.query('COMMIT');
    return mapComplaintLetter(row);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateComplaintLetter(input: {
  letterId: string;
  subject?: string | null;
  bodyText?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  status?: ComplaintLetterStatus | null;
  approvalNote?: string | null;
  performedBy?: string | null;
}): Promise<ComplaintLetter | null> {
  await ensureComplaintsWorkspaceSchema();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const existingResult = await client.query<Record<string, unknown>>(
      `SELECT * FROM complaint_letters WHERE id = $1`,
      [input.letterId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return null;
    }

    const nextSubject = sanitizeText(input.subject ?? existing.subject) || String(existing.subject || 'Complaint correspondence');
    const nextRecipientName = sanitizeNullable(input.recipientName ?? existing.recipient_name);
    const nextRecipientEmail = sanitizeNullable(input.recipientEmail ?? existing.recipient_email);
    const nextBody = sanitizeText(input.bodyText ?? existing.body_text);
    const contentChanged =
      nextSubject !== String(existing.subject || 'Complaint correspondence')
      || nextRecipientName !== sanitizeNullable(existing.recipient_name)
      || nextRecipientEmail !== sanitizeNullable(existing.recipient_email)
      || nextBody !== String(existing.body_text || '');

    const existingStatus = normalizeLetterStatus(existing.status);
    const requestedStatus = input.status == null ? null : normalizeLetterStatus(input.status);
    if (requestedStatus === 'sent' && !['approved', 'sent'].includes(existingStatus)) {
      throw new Error('Letter must be approved before it can be marked as sent.');
    }
    if (requestedStatus === 'sent' && contentChanged) {
      throw new Error('Edited letter content must be approved again before it can be marked as sent.');
    }

    let nextStatus = requestedStatus ?? existingStatus;
    if (contentChanged && ['approved', 'sent'].includes(existingStatus) && requestedStatus == null) {
      nextStatus = 'draft';
    }

    const nextVersionNumber = contentChanged || requestedStatus !== null
      ? Math.max(1, toInt(existing.version_number) + 1)
      : Math.max(1, toInt(existing.version_number) || 1);
    const approvedAt =
      nextStatus === 'approved'
        ? toIsoDateTime(existingStatus === 'approved' && existing.approved_at ? existing.approved_at : new Date().toISOString())
        : (nextStatus === 'sent' ? toIsoDateTime(existing.approved_at || new Date().toISOString()) : null);
    const approvedBy =
      nextStatus === 'approved' || nextStatus === 'sent'
        ? sanitizeNullable(input.performedBy) || sanitizeNullable(existing.approved_by)
        : null;
    const sentAt = nextStatus === 'sent'
      ? toIsoDateTime(existingStatus === 'sent' && existing.sent_at ? existing.sent_at : new Date().toISOString())
      : null;
    const updatedResult = await client.query<Record<string, unknown>>(
      `
        UPDATE complaint_letters
        SET
          subject = $2,
          recipient_name = $3,
          recipient_email = $4,
          body_text = $5,
          status = $6,
          version_number = $7,
          approved_at = $8,
          approved_by = $9,
          sent_at = $10,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        input.letterId,
        nextSubject,
        nextRecipientName,
        nextRecipientEmail,
        nextBody,
        nextStatus,
        nextVersionNumber,
        approvedAt,
        approvedBy,
        sentAt,
      ]
    );

    const updated = updatedResult.rows[0];
    if (contentChanged || requestedStatus !== null) {
      await insertComplaintLetterVersionTx(client, {
        letter: updated,
        complaintId: String(existing.complaint_id || ''),
        snapshotReason: deriveLetterSnapshotReason({
          previousStatus: existingStatus,
          nextStatus,
          contentChanged,
          approvalNote: input.approvalNote,
        }),
        snapshotBy: input.performedBy,
      });
    }

    if (contentChanged && ['approved', 'sent'].includes(existingStatus)) {
      await insertComplaintActivityTx(client, {
        complaintId: String(existing.complaint_id || ''),
        activityType: 'letter_superseded',
        description: `${labelForLetterTemplate(normalizeLetterTemplateKey(existing.template_key))} content changed and a new draft version was created.`,
        oldValue: existingStatus,
        newValue: nextStatus,
        performedBy: input.performedBy,
        metadata: {
          letterId: String(existing.id || ''),
          priorVersion: toInt(existing.version_number),
          nextVersion: nextVersionNumber,
        },
      });
    }

    if (existingStatus !== nextStatus && nextStatus === 'approved') {
      await insertComplaintActivityTx(client, {
        complaintId: String(existing.complaint_id || ''),
        activityType: 'letter_approved',
        description: `${labelForLetterTemplate(normalizeLetterTemplateKey(existing.template_key))} approved.`,
        oldValue: existingStatus,
        newValue: nextStatus,
        performedBy: input.performedBy,
        metadata: {
          letterId: String(existing.id || ''),
          versionNumber: nextVersionNumber,
          approvalNote: sanitizeNullable(input.approvalNote),
        },
      });
    }

    if (existingStatus !== nextStatus && nextStatus === 'sent') {
      await insertComplaintActivityTx(client, {
        complaintId: String(existing.complaint_id || ''),
        activityType: 'letter_sent',
        description: `${labelForLetterTemplate(normalizeLetterTemplateKey(existing.template_key))} marked as sent.`,
        oldValue: String(existing.status || 'draft'),
        newValue: nextStatus,
        performedBy: input.performedBy,
        metadata: {
          letterId: String(existing.id || ''),
          subject: String(updated.subject || ''),
        },
      });
    }

    await client.query('COMMIT');
    return mapComplaintLetter(updated);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createComplaint(input: ComplaintMutationInput, performedBy?: string | null): Promise<ComplaintRecord> {
  await ensureComplaintsWorkspaceSchema();
  const payload = normalizeComplaintMutationInput(input, true);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const inserted = await client.query<Record<string, unknown>>(
      `
        INSERT INTO complaints_records (
          complaint_reference,
          linked_fos_case_id,
          complainant_name,
          complainant_email,
          complainant_phone,
          complainant_address,
          firm_name,
          product,
          complaint_type,
          complaint_category,
          description,
          received_date,
          acknowledged_date,
          four_week_due_date,
          eight_week_due_date,
          final_response_date,
          resolved_date,
          root_cause,
          remedial_action,
          resolution,
          compensation_amount,
          fos_referred,
          fos_outcome,
          status,
          priority,
          assigned_to,
          notes,
          created_by,
          updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29
        )
        RETURNING *
      `,
      [
        payload.complaintReference,
        payload.linkedFosCaseId,
        payload.complainantName,
        payload.complainantEmail,
        payload.complainantPhone,
        payload.complainantAddress,
        payload.firmName,
        payload.product,
        payload.complaintType,
        payload.complaintCategory,
        payload.description,
        payload.receivedDate,
        payload.acknowledgedDate,
        payload.fourWeekDueDate,
        payload.eightWeekDueDate,
        payload.finalResponseDate,
        payload.resolvedDate,
        payload.rootCause,
        payload.remedialAction,
        payload.resolution,
        payload.compensationAmount,
        payload.fosReferred,
        payload.fosOutcome,
        payload.status,
        payload.priority,
        payload.assignedTo,
        payload.notes,
        performedBy || payload.createdBy,
        performedBy || payload.updatedBy,
      ]
    );

    const row = inserted.rows[0];
    await insertComplaintActivityTx(client, {
      complaintId: String(row.id),
      activityType: 'complaint_created',
      description: 'Complaint created.',
      performedBy: performedBy || payload.createdBy,
      metadata: {
        complaintReference: payload.complaintReference,
        firmName: payload.firmName,
      },
    });

    await client.query('COMMIT');
    return mapComplaintRecord(row);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateComplaint(id: string, input: ComplaintMutationInput, performedBy?: string | null): Promise<ComplaintRecord | null> {
  await ensureComplaintsWorkspaceSchema();
  const existing = await getComplaintById(id);
  if (!existing) return null;
  const payload = normalizeComplaintMutationInput({ ...existing, ...input }, false, existing);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const updated = await client.query<Record<string, unknown>>(
      `
        UPDATE complaints_records
        SET
          complaint_reference = $2,
          linked_fos_case_id = $3,
          complainant_name = $4,
          complainant_email = $5,
          complainant_phone = $6,
          complainant_address = $7,
          firm_name = $8,
          product = $9,
          complaint_type = $10,
          complaint_category = $11,
          description = $12,
          received_date = $13,
          acknowledged_date = $14,
          four_week_due_date = $15,
          eight_week_due_date = $16,
          final_response_date = $17,
          resolved_date = $18,
          root_cause = $19,
          remedial_action = $20,
          resolution = $21,
          compensation_amount = $22,
          fos_referred = $23,
          fos_outcome = $24,
          status = $25,
          priority = $26,
          assigned_to = $27,
          notes = $28,
          updated_by = $29
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.complaintReference,
        payload.linkedFosCaseId,
        payload.complainantName,
        payload.complainantEmail,
        payload.complainantPhone,
        payload.complainantAddress,
        payload.firmName,
        payload.product,
        payload.complaintType,
        payload.complaintCategory,
        payload.description,
        payload.receivedDate,
        payload.acknowledgedDate,
        payload.fourWeekDueDate,
        payload.eightWeekDueDate,
        payload.finalResponseDate,
        payload.resolvedDate,
        payload.rootCause,
        payload.remedialAction,
        payload.resolution,
        payload.compensationAmount,
        payload.fosReferred,
        payload.fosOutcome,
        payload.status,
        payload.priority,
        payload.assignedTo,
        payload.notes,
        performedBy || payload.updatedBy,
      ]
    );

    await insertChangeActivities(client, existing, payload, performedBy || payload.updatedBy);
    await client.query('COMMIT');
    return mapComplaintRecord(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteComplaint(id: string): Promise<boolean> {
  await ensureComplaintsWorkspaceSchema();
  const result = await DatabaseClient.query<{ id: string }>(
    `DELETE FROM complaints_records WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.length > 0;
}

export async function createComplaintActivity(input: {
  complaintId: string;
  activityType: ComplaintActivityType;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown> | null;
  performedBy?: string | null;
}): Promise<ComplaintActivity> {
  await ensureComplaintsWorkspaceSchema();
  if (!VALID_ACTIVITY_TYPES.includes(input.activityType)) {
    throw new Error(`Invalid complaint activity type: ${input.activityType}`);
  }

  const row = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
      INSERT INTO complaint_activities (
        complaint_id,
        activity_type,
        description,
        old_value,
        new_value,
        metadata,
        performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING *
    `,
    [
      input.complaintId,
      input.activityType,
      input.description.trim(),
      sanitizeNullable(input.oldValue),
      sanitizeNullable(input.newValue),
      JSON.stringify(input.metadata || {}),
      sanitizeNullable(input.performedBy),
    ]
  );

  if (!row) throw new Error('Failed to create complaint activity.');
  return mapComplaintActivity(row);
}

export async function listComplaintImportRuns(limit = 12): Promise<ComplaintImportRun[]> {
  await ensureComplaintsWorkspaceSchema();
  const safeLimit = clamp(limit, 1, 100);
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT *
      FROM complaint_import_runs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return rows.map(mapComplaintImportRun);
}

export async function commitComplaintImport(params: {
  fileName: string;
  rows: ComplaintImportPreviewRow[];
  warnings: string[];
  createdBy?: string | null;
}): Promise<{ importRunId: string; importedCount: number; overwrittenCount: number; skippedCount: number }> {
  await ensureComplaintsWorkspaceSchema();
  const client = await pool.connect();
  const validRows = params.rows.filter((row) => row.action === 'new' || row.action === 'overwrite');
  const skippedRows = params.rows.filter((row) => row.action === 'duplicate_in_file' || row.action === 'invalid');
  const importedCount = validRows.filter((row) => row.action === 'new').length;
  const overwrittenCount = validRows.filter((row) => row.action === 'overwrite').length;
  const skippedCount = skippedRows.length;

  try {
    await client.query('BEGIN');
    const runResult = await client.query<{ id: string }>(
      `
        INSERT INTO complaint_import_runs (
          file_name,
          status,
          total_rows,
          imported_count,
          overwritten_count,
          skipped_count,
          warnings,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING id
      `,
      [
        params.fileName,
        skippedCount > 0 ? 'partial' : 'success',
        params.rows.length,
        importedCount,
        overwrittenCount,
        skippedCount,
        JSON.stringify(params.warnings || []),
        sanitizeNullable(params.createdBy),
      ]
    );
    const importRunId = runResult.rows[0].id;

    for (const row of params.rows) {
      await client.query(
        `
          INSERT INTO complaint_import_run_rows (
            import_run_id,
            row_number,
            complaint_reference,
            action,
            issues,
            normalized_fields
          ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        `,
        [
          importRunId,
          row.rowNumber,
          sanitizeNullable(row.complaintReference),
          row.action === 'invalid' || row.action === 'duplicate_in_file' ? row.action : row.action,
          JSON.stringify(row.issues || []),
          JSON.stringify(row.normalizedFields || {}),
        ]
      );

      if (row.action !== 'new' && row.action !== 'overwrite') {
        continue;
      }

      const normalized = normalizeComplaintMutationInput(row.normalizedFields as ComplaintMutationInput, true);
      const result = await client.query<Record<string, unknown>>(
        `
          INSERT INTO complaints_records (
            complaint_reference,
            linked_fos_case_id,
            complainant_name,
            complainant_email,
            complainant_phone,
            complainant_address,
            firm_name,
            product,
            complaint_type,
            complaint_category,
            description,
            received_date,
            acknowledged_date,
            four_week_due_date,
            eight_week_due_date,
            final_response_date,
            resolved_date,
            root_cause,
            remedial_action,
            resolution,
            compensation_amount,
            fos_referred,
            fos_outcome,
            status,
            priority,
            assigned_to,
            notes,
            created_by,
            updated_by
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29
          )
          ON CONFLICT (complaint_reference)
          DO UPDATE SET
            linked_fos_case_id = EXCLUDED.linked_fos_case_id,
            complainant_name = EXCLUDED.complainant_name,
            complainant_email = EXCLUDED.complainant_email,
            complainant_phone = EXCLUDED.complainant_phone,
            complainant_address = EXCLUDED.complainant_address,
            firm_name = EXCLUDED.firm_name,
            product = EXCLUDED.product,
            complaint_type = EXCLUDED.complaint_type,
            complaint_category = EXCLUDED.complaint_category,
            description = EXCLUDED.description,
            received_date = EXCLUDED.received_date,
            acknowledged_date = EXCLUDED.acknowledged_date,
            four_week_due_date = EXCLUDED.four_week_due_date,
            eight_week_due_date = EXCLUDED.eight_week_due_date,
            final_response_date = EXCLUDED.final_response_date,
            resolved_date = EXCLUDED.resolved_date,
            root_cause = EXCLUDED.root_cause,
            remedial_action = EXCLUDED.remedial_action,
            resolution = EXCLUDED.resolution,
            compensation_amount = EXCLUDED.compensation_amount,
            fos_referred = EXCLUDED.fos_referred,
            fos_outcome = EXCLUDED.fos_outcome,
            status = EXCLUDED.status,
            priority = EXCLUDED.priority,
            assigned_to = EXCLUDED.assigned_to,
            notes = EXCLUDED.notes,
            updated_by = EXCLUDED.updated_by
          RETURNING *
        `,
        [
          normalized.complaintReference,
          normalized.linkedFosCaseId,
          normalized.complainantName,
          normalized.complainantEmail,
          normalized.complainantPhone,
          normalized.complainantAddress,
          normalized.firmName,
          normalized.product,
          normalized.complaintType,
          normalized.complaintCategory,
          normalized.description,
          normalized.receivedDate,
          normalized.acknowledgedDate,
          normalized.fourWeekDueDate,
          normalized.eightWeekDueDate,
          normalized.finalResponseDate,
          normalized.resolvedDate,
          normalized.rootCause,
          normalized.remedialAction,
          normalized.resolution,
          normalized.compensationAmount,
          normalized.fosReferred,
          normalized.fosOutcome,
          normalized.status,
          normalized.priority,
          normalized.assignedTo,
          normalized.notes,
          sanitizeNullable(params.createdBy),
          sanitizeNullable(params.createdBy),
        ]
      );

      const complaintId = String(result.rows[0].id);
      await insertComplaintActivityTx(client, {
        complaintId,
        activityType: row.action === 'overwrite' ? 'note_added' : 'complaint_created',
        description: row.action === 'overwrite' ? `Complaint updated via import run ${importRunId}.` : `Complaint created via import run ${importRunId}.`,
        performedBy: params.createdBy,
        metadata: { importRunId, source: 'bulk_upload', fileName: params.fileName },
      });
    }

    await client.query('COMMIT');
    return { importRunId, importedCount, overwrittenCount, skippedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listBoardPackRuns(limit = 10): Promise<Array<{
  id: string;
  format: 'pdf' | 'pptx';
  status: 'success' | 'failed';
  title: string;
  fileName: string | null;
  createdAt: string;
}>> {
  await ensureComplaintsWorkspaceSchema();
  const rows = await DatabaseClient.query<Record<string, unknown>>(
    `SELECT * FROM board_pack_runs ORDER BY created_at DESC LIMIT $1`,
    [clamp(limit, 1, 50)]
  );
  return rows.map((row) => ({
    id: String(row.id || ''),
    format: String(row.format || 'pdf') as 'pdf' | 'pptx',
    status: String(row.status || 'success') as 'success' | 'failed',
    title: String(row.title || 'Board pack'),
    fileName: sanitizeNullable(row.file_name),
    createdAt: toIsoDateTime(row.created_at),
  }));
}

export async function listComplaintAppendixArtifacts(dateFrom?: string | null, dateTo?: string | null): Promise<{
  recentLetters: Array<{
    id: string;
    complaintReference: string;
    subject: string;
    status: ComplaintLetterStatus;
    recipientName: string | null;
    createdAt: string;
  }>;
  recentEvidence: Array<{
    id: string;
    complaintReference: string;
    fileName: string;
    category: ComplaintEvidenceCategory;
    summary: string | null;
    createdAt: string;
  }>;
}> {
  await ensureComplaintsWorkspaceSchema();
  const { whereSql, params } = buildComplaintDateRangeClause(dateFrom, dateTo, 'c', 1);

  const letterRows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT
        l.id,
        c.complaint_reference,
        l.subject,
        l.status,
        l.recipient_name,
        l.created_at
      FROM complaint_letters l
      INNER JOIN complaints_records c ON c.id = l.complaint_id
      ${whereSql}
      ORDER BY l.created_at DESC
      LIMIT 6
    `,
    params
  );

  const evidenceRows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT
        e.id,
        c.complaint_reference,
        e.file_name,
        e.category,
        e.summary,
        e.created_at
      FROM complaint_evidence e
      INNER JOIN complaints_records c ON c.id = e.complaint_id
      ${whereSql}
      ORDER BY e.created_at DESC
      LIMIT 6
    `,
    params
  );

  return {
    recentLetters: letterRows.map((row) => ({
      id: String(row.id || ''),
      complaintReference: String(row.complaint_reference || ''),
      subject: String(row.subject || 'Complaint correspondence'),
      status: normalizeLetterStatus(row.status),
      recipientName: sanitizeNullable(row.recipient_name),
      createdAt: toIsoDateTime(row.created_at),
    })),
    recentEvidence: evidenceRows.map((row) => ({
      id: String(row.id || ''),
      complaintReference: String(row.complaint_reference || ''),
      fileName: String(row.file_name || 'evidence.bin'),
      category: normalizeEvidenceCategory(row.category),
      summary: sanitizeNullable(row.summary),
      createdAt: toIsoDateTime(row.created_at),
    })),
  };
}

export async function recordBoardPackRun(params: {
  format: 'pdf' | 'pptx';
  status: 'success' | 'failed';
  title: string;
  fileName?: string | null;
  generatedBy?: string | null;
  requestPayload?: unknown;
}): Promise<void> {
  await ensureComplaintsWorkspaceSchema();
  await DatabaseClient.query(
    `
      INSERT INTO board_pack_runs (format, status, title, request_payload, file_name, generated_by)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `,
    [
      params.format,
      params.status,
      params.title,
      JSON.stringify(params.requestPayload || {}),
      sanitizeNullable(params.fileName),
      sanitizeNullable(params.generatedBy),
    ]
  );
}

async function insertComplaintLetterVersionTx(
  client: PoolClient,
  input: {
    letter: Record<string, unknown>;
    complaintId: string;
    snapshotReason?: string | null;
    snapshotBy?: string | null;
  }
) {
  await client.query(
    `
      INSERT INTO complaint_letter_versions (
        letter_id,
        complaint_id,
        version_number,
        status,
        subject,
        recipient_name,
        recipient_email,
        body_text,
        snapshot_reason,
        snapshot_by,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (letter_id, version_number) DO NOTHING
    `,
    [
      String(input.letter.id || ''),
      input.complaintId,
      Math.max(1, toInt(input.letter.version_number) || 1),
      normalizeLetterStatus(input.letter.status),
      String(input.letter.subject || 'Complaint correspondence'),
      sanitizeNullable(input.letter.recipient_name),
      sanitizeNullable(input.letter.recipient_email),
      String(input.letter.body_text || ''),
      sanitizeNullable(input.snapshotReason),
      sanitizeNullable(input.snapshotBy),
    ]
  );
}

function deriveLetterSnapshotReason(input: {
  previousStatus: ComplaintLetterStatus;
  nextStatus: ComplaintLetterStatus;
  contentChanged: boolean;
  approvalNote?: string | null;
}): string {
  if (input.nextStatus === 'approved') {
    return sanitizeText(input.approvalNote) || 'Approved version saved.';
  }
  if (input.nextStatus === 'sent') {
    return 'Sent version recorded.';
  }
  if (input.contentChanged && ['approved', 'sent'].includes(input.previousStatus)) {
    return 'Content changed after approval/sending; new draft version created.';
  }
  if (input.contentChanged) {
    return 'Draft content updated.';
  }
  if (input.previousStatus !== input.nextStatus) {
    return `Status changed from ${input.previousStatus} to ${input.nextStatus}.`;
  }
  return 'Letter version saved.';
}

export async function getComplaintOperationsSummary(dateFrom?: string | null, dateTo?: string | null): Promise<{
  total: number;
  open: number;
  referredToFos: number;
  overdue: number;
  urgent: number;
  topRootCauses: Array<{ label: string; count: number }>;
}> {
  await ensureComplaintsWorkspaceSchema();
  const { whereSql, params } = buildComplaintDateRangeClause(dateFrom, dateTo, 'complaints_records', 1);

  const summaryRow = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
      SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed'))::INT AS open,
        COUNT(*) FILTER (WHERE fos_referred = TRUE)::INT AS referred_to_fos,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed') AND eight_week_due_date < CURRENT_DATE)::INT AS overdue,
        COUNT(*) FILTER (WHERE priority = 'urgent')::INT AS urgent
      FROM complaints_records
      ${whereSql}
    `,
    params
  );

  const rootCauseRows = await DatabaseClient.query<Record<string, unknown>>(
    `
      SELECT COALESCE(NULLIF(BTRIM(root_cause), ''), 'Unspecified') AS label, COUNT(*)::INT AS count
      FROM complaints_records
      ${whereSql}
      GROUP BY COALESCE(NULLIF(BTRIM(root_cause), ''), 'Unspecified')
      ORDER BY count DESC, label ASC
      LIMIT 6
    `,
    params
  );

  return {
    total: toInt(summaryRow?.total),
    open: toInt(summaryRow?.open),
    referredToFos: toInt(summaryRow?.referred_to_fos),
    overdue: toInt(summaryRow?.overdue),
    urgent: toInt(summaryRow?.urgent),
    topRootCauses: rootCauseRows.map((row) => ({ label: String(row.label || 'Unspecified'), count: toInt(row.count) })),
  };
}

function buildComplaintWhereClause(filters: ComplaintFilters, startIndex: number) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let nextIndex = startIndex;

  if (filters.status !== 'all') {
    conditions.push(`status = $${nextIndex}`);
    params.push(filters.status);
    nextIndex += 1;
  }
  if (filters.priority !== 'all') {
    conditions.push(`priority = $${nextIndex}`);
    params.push(filters.priority);
    nextIndex += 1;
  }
  if (filters.firm) {
    conditions.push(`firm_name = $${nextIndex}`);
    params.push(filters.firm);
    nextIndex += 1;
  }
  if (filters.product) {
    conditions.push(`COALESCE(product, '') = $${nextIndex}`);
    params.push(filters.product);
    nextIndex += 1;
  }
  if (filters.fosReferred === 'yes') {
    conditions.push(`fos_referred = TRUE`);
  } else if (filters.fosReferred === 'no') {
    conditions.push(`fos_referred = FALSE`);
  }
  if (filters.query) {
    const safeQuery = `%${filters.query.replace(/[%_\\]/g, '\\$&')}%`;
    conditions.push(`(
      complaint_reference ILIKE $${nextIndex}
      OR complainant_name ILIKE $${nextIndex}
      OR firm_name ILIKE $${nextIndex}
      OR COALESCE(product, '') ILIKE $${nextIndex}
      OR COALESCE(description, '') ILIKE $${nextIndex}
      OR COALESCE(root_cause, '') ILIKE $${nextIndex}
    )`);
    params.push(safeQuery);
    nextIndex += 1;
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIndex,
  };
}

function buildComplaintDateRangeClause(
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
  alias: string,
  startIndex: number
) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let nextIndex = startIndex;

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`${alias}.received_date >= $${nextIndex}::date`);
    nextIndex += 1;
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`${alias}.received_date <= $${nextIndex}::date`);
    nextIndex += 1;
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function insertChangeActivities(
  client: PoolClient,
  existing: ComplaintRecord,
  payload: ReturnType<typeof normalizeComplaintMutationInput>,
  performedBy?: string | null
) {
  if (existing.status !== payload.status) {
    await insertComplaintActivityTx(client, {
      complaintId: existing.id,
      activityType: payload.status === 'resolved' ? 'resolved' : payload.status === 'closed' ? 'closed' : payload.status === 'referred_to_fos' ? 'fos_referred' : 'status_change',
      description: `Status changed from ${existing.status} to ${payload.status}.`,
      oldValue: existing.status,
      newValue: payload.status,
      performedBy,
    });
  }

  if (existing.priority !== payload.priority) {
    await insertComplaintActivityTx(client, {
      complaintId: existing.id,
      activityType: 'priority_change',
      description: `Priority changed from ${existing.priority} to ${payload.priority}.`,
      oldValue: existing.priority,
      newValue: payload.priority,
      performedBy,
    });
  }

  if ((existing.assignedTo || null) !== payload.assignedTo) {
    await insertComplaintActivityTx(client, {
      complaintId: existing.id,
      activityType: 'assigned',
      description: payload.assignedTo ? `Assigned to ${payload.assignedTo}.` : 'Assignment cleared.',
      oldValue: existing.assignedTo,
      newValue: payload.assignedTo,
      performedBy,
    });
  }

  if (existing.fosReferred !== payload.fosReferred && payload.fosReferred) {
    await insertComplaintActivityTx(client, {
      complaintId: existing.id,
      activityType: 'fos_referred',
      description: 'Complaint marked as referred to FOS.',
      oldValue: String(existing.fosReferred),
      newValue: String(payload.fosReferred),
      performedBy,
    });
  }

  if ((existing.notes || '').trim() !== (payload.notes || '').trim() && payload.notes) {
    await insertComplaintActivityTx(client, {
      complaintId: existing.id,
      activityType: 'note_added',
      description: payload.notes,
      performedBy,
    });
  }
}

async function insertComplaintActivityTx(
  client: PoolClient,
  input: {
    complaintId: string;
    activityType: ComplaintActivityType;
    description: string;
    oldValue?: string | null;
    newValue?: string | null;
    metadata?: Record<string, unknown> | null;
    performedBy?: string | null;
  }
) {
  await client.query(
    `
      INSERT INTO complaint_activities (
        complaint_id,
        activity_type,
        description,
        old_value,
        new_value,
        metadata,
        performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `,
    [
      input.complaintId,
      input.activityType,
      input.description,
      sanitizeNullable(input.oldValue),
      sanitizeNullable(input.newValue),
      JSON.stringify(input.metadata || {}),
      sanitizeNullable(input.performedBy),
    ]
  );
}

function normalizeComplaintMutationInput(
  input: ComplaintMutationInput,
  requireReference = false,
  fallback?: ComplaintRecord
) {
  const complaintReference = sanitizeText(input.complaintReference ?? fallback?.complaintReference);
  const complainantName = sanitizeText(input.complainantName ?? fallback?.complainantName);
  const firmName = sanitizeText(input.firmName ?? fallback?.firmName) || 'Unknown firm';
  const receivedDate = toDateOnly(input.receivedDate ?? fallback?.receivedDate);

  if (requireReference && !complaintReference) throw new Error('Complaint reference is required.');
  if (!complainantName) throw new Error('Complainant name is required.');
  if (!receivedDate) throw new Error('Received date is required.');

  const fourWeekDueDate = toDateOnly(input.fourWeekDueDate) || addDays(receivedDate, 28);
  const eightWeekDueDate = toDateOnly(input.eightWeekDueDate) || addDays(receivedDate, 56);
  const rawStatus = sanitizeText(input.status ?? fallback?.status) as ComplaintStatus | null;
  const rawPriority = sanitizeText(input.priority ?? fallback?.priority) as ComplaintPriority | null;

  return {
    complaintReference: complaintReference || fallback?.complaintReference || '',
    linkedFosCaseId: sanitizeNullable(input.linkedFosCaseId ?? fallback?.linkedFosCaseId),
    complainantName,
    complainantEmail: sanitizeNullable(input.complainantEmail ?? fallback?.complainantEmail),
    complainantPhone: sanitizeNullable(input.complainantPhone ?? fallback?.complainantPhone),
    complainantAddress: sanitizeNullable(input.complainantAddress ?? fallback?.complainantAddress),
    firmName,
    product: sanitizeNullable(input.product ?? fallback?.product),
    complaintType: sanitizeText(input.complaintType ?? fallback?.complaintType) || 'general',
    complaintCategory: sanitizeText(input.complaintCategory ?? fallback?.complaintCategory) || 'pending',
    description: sanitizeNullable(input.description ?? fallback?.description),
    receivedDate,
    acknowledgedDate: toDateOnly(input.acknowledgedDate ?? fallback?.acknowledgedDate),
    fourWeekDueDate,
    eightWeekDueDate,
    finalResponseDate: toDateOnly(input.finalResponseDate ?? fallback?.finalResponseDate),
    resolvedDate: toDateOnly(input.resolvedDate ?? fallback?.resolvedDate),
    rootCause: sanitizeNullable(input.rootCause ?? fallback?.rootCause),
    remedialAction: sanitizeNullable(input.remedialAction ?? fallback?.remedialAction),
    resolution: sanitizeNullable(input.resolution ?? fallback?.resolution),
    compensationAmount: toNullableNumber(input.compensationAmount ?? fallback?.compensationAmount),
    fosReferred: Boolean(input.fosReferred ?? fallback?.fosReferred),
    fosOutcome: sanitizeNullable(input.fosOutcome ?? fallback?.fosOutcome),
    status: VALID_STATUSES.includes(rawStatus as ComplaintStatus) ? (rawStatus as ComplaintStatus) : 'open',
    priority: VALID_PRIORITIES.includes(rawPriority as ComplaintPriority) ? (rawPriority as ComplaintPriority) : 'medium',
    assignedTo: sanitizeNullable(input.assignedTo ?? fallback?.assignedTo),
    notes: sanitizeNullable(input.notes ?? fallback?.notes),
    createdBy: sanitizeNullable(input.createdBy ?? fallback?.createdBy),
    updatedBy: sanitizeNullable(input.updatedBy ?? fallback?.updatedBy),
  };
}

function mapComplaintRecord(row: Record<string, unknown>): ComplaintRecord {
  return {
    id: String(row.id || ''),
    complaintReference: String(row.complaint_reference || ''),
    linkedFosCaseId: sanitizeNullable(row.linked_fos_case_id),
    complainantName: String(row.complainant_name || ''),
    complainantEmail: sanitizeNullable(row.complainant_email),
    complainantPhone: sanitizeNullable(row.complainant_phone),
    complainantAddress: sanitizeNullable(row.complainant_address),
    firmName: String(row.firm_name || 'Unknown firm'),
    product: sanitizeNullable(row.product),
    complaintType: String(row.complaint_type || 'general'),
    complaintCategory: String(row.complaint_category || 'pending'),
    description: sanitizeNullable(row.description),
    receivedDate: toDateOnly(row.received_date) || '',
    acknowledgedDate: toDateOnly(row.acknowledged_date),
    fourWeekDueDate: toDateOnly(row.four_week_due_date),
    eightWeekDueDate: toDateOnly(row.eight_week_due_date),
    finalResponseDate: toDateOnly(row.final_response_date),
    resolvedDate: toDateOnly(row.resolved_date),
    rootCause: sanitizeNullable(row.root_cause),
    remedialAction: sanitizeNullable(row.remedial_action),
    resolution: sanitizeNullable(row.resolution),
    compensationAmount: toNullableNumber(row.compensation_amount),
    fosReferred: Boolean(row.fos_referred),
    fosOutcome: sanitizeNullable(row.fos_outcome),
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    assignedTo: sanitizeNullable(row.assigned_to),
    notes: sanitizeNullable(row.notes),
    createdBy: sanitizeNullable(row.created_by),
    updatedBy: sanitizeNullable(row.updated_by),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  };
}

function mapComplaintActivity(row: Record<string, unknown>): ComplaintActivity {
  return {
    id: String(row.id || ''),
    complaintId: String(row.complaint_id || ''),
    activityType: normalizeActivityType(row.activity_type),
    description: String(row.description || ''),
    oldValue: sanitizeNullable(row.old_value),
    newValue: sanitizeNullable(row.new_value),
    metadata: isPlainObject(row.metadata) ? (row.metadata as Record<string, unknown>) : null,
    performedBy: sanitizeNullable(row.performed_by),
    createdAt: toIsoDateTime(row.created_at),
  };
}

function mapComplaintEvidence(row: Record<string, unknown>): ComplaintEvidence {
  return {
    id: String(row.id || ''),
    complaintId: String(row.complaint_id || ''),
    fileName: String(row.file_name || 'evidence.bin'),
    contentType: String(row.content_type || 'application/octet-stream'),
    fileSize: toInt(row.file_size),
    category: normalizeEvidenceCategory(row.category),
    summary: sanitizeNullable(row.summary),
    uploadedBy: sanitizeNullable(row.uploaded_by),
    createdAt: toIsoDateTime(row.created_at),
  };
}

function mapComplaintLetter(row: Record<string, unknown>): ComplaintLetter {
  return {
    id: String(row.id || ''),
    complaintId: String(row.complaint_id || ''),
    templateKey: normalizeLetterTemplateKey(row.template_key),
    status: normalizeLetterStatus(row.status),
    versionNumber: Math.max(1, toInt(row.version_number) || 1),
    subject: String(row.subject || 'Complaint correspondence'),
    recipientName: sanitizeNullable(row.recipient_name),
    recipientEmail: sanitizeNullable(row.recipient_email),
    bodyText: String(row.body_text || ''),
    generatedBy: sanitizeNullable(row.generated_by),
    approvedAt: row.approved_at ? toIsoDateTime(row.approved_at) : null,
    approvedBy: sanitizeNullable(row.approved_by),
    sentAt: row.sent_at ? toIsoDateTime(row.sent_at) : null,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  };
}

function mapComplaintLetterVersion(row: Record<string, unknown>): ComplaintLetterVersion {
  return {
    id: String(row.id || ''),
    letterId: String(row.letter_id || ''),
    complaintId: String(row.complaint_id || ''),
    versionNumber: Math.max(1, toInt(row.version_number) || 1),
    status: normalizeLetterStatus(row.status),
    subject: String(row.subject || 'Complaint correspondence'),
    recipientName: sanitizeNullable(row.recipient_name),
    recipientEmail: sanitizeNullable(row.recipient_email),
    bodyText: String(row.body_text || ''),
    snapshotReason: sanitizeNullable(row.snapshot_reason),
    snapshotBy: sanitizeNullable(row.snapshot_by),
    createdAt: toIsoDateTime(row.created_at),
  };
}

function mapComplaintWorkspaceSettings(row: Record<string, unknown>): ComplaintWorkspaceSettings {
  return {
    organizationName: sanitizeText(row.organization_name) || DEFAULT_COMPLAINT_WORKSPACE_SETTINGS.organizationName,
    complaintsTeamName: sanitizeText(row.complaints_team_name) || DEFAULT_COMPLAINT_WORKSPACE_SETTINGS.complaintsTeamName,
    complaintsEmail: sanitizeNullable(row.complaints_email),
    complaintsPhone: sanitizeNullable(row.complaints_phone),
    complaintsAddress: sanitizeNullable(row.complaints_address),
    boardPackSubtitle: sanitizeNullable(row.board_pack_subtitle) || DEFAULT_COMPLAINT_WORKSPACE_SETTINGS.boardPackSubtitle,
    lateReferralPosition: normalizeLateReferralPosition(row.late_referral_position),
    lateReferralCustomText: sanitizeNullable(row.late_referral_custom_text),
    updatedAt: row.updated_at ? toIsoDateTime(row.updated_at) : DEFAULT_COMPLAINT_WORKSPACE_SETTINGS.updatedAt,
  };
}

function mapComplaintImportRun(row: Record<string, unknown>): ComplaintImportRun {
  return {
    id: String(row.id || ''),
    fileName: String(row.file_name || 'import'),
    status: String(row.status || 'success') as ComplaintImportRun['status'],
    totalRows: toInt(row.total_rows),
    importedCount: toInt(row.imported_count),
    overwrittenCount: toInt(row.overwritten_count),
    skippedCount: toInt(row.skipped_count),
    createdBy: sanitizeNullable(row.created_by),
    createdAt: toIsoDateTime(row.created_at),
    warnings: parseJsonStringArray(row.warnings),
  };
}

function mapComplaintStats(row: Record<string, unknown> | null | undefined): ComplaintStats {
  return {
    totalComplaints: toInt(row?.total_complaints),
    openComplaints: toInt(row?.open_complaints),
    referredToFos: toInt(row?.referred_to_fos),
    overdueComplaints: toInt(row?.overdue_complaints),
    urgentComplaints: toInt(row?.urgent_complaints),
  };
}

function normalizeStatus(value: unknown): ComplaintStatus {
  return VALID_STATUSES.includes(String(value) as ComplaintStatus) ? (String(value) as ComplaintStatus) : 'open';
}

function normalizePriority(value: unknown): ComplaintPriority {
  return VALID_PRIORITIES.includes(String(value) as ComplaintPriority) ? (String(value) as ComplaintPriority) : 'medium';
}

function normalizeActivityType(value: unknown): ComplaintActivityType {
  return VALID_ACTIVITY_TYPES.includes(String(value) as ComplaintActivityType)
    ? (String(value) as ComplaintActivityType)
    : 'note_added';
}

function normalizeEvidenceCategory(value: unknown): ComplaintEvidenceCategory {
  return VALID_EVIDENCE_CATEGORIES.includes(String(value) as ComplaintEvidenceCategory)
    ? (String(value) as ComplaintEvidenceCategory)
    : 'other';
}

function normalizeLetterTemplateKey(value: unknown): ComplaintLetterTemplateKey {
  return VALID_LETTER_TEMPLATE_KEYS.includes(String(value) as ComplaintLetterTemplateKey)
    ? (String(value) as ComplaintLetterTemplateKey)
    : 'custom';
}

function normalizeLetterStatus(value: unknown): ComplaintLetterStatus {
  return VALID_LETTER_STATUSES.includes(String(value) as ComplaintLetterStatus)
    ? (String(value) as ComplaintLetterStatus)
    : 'draft';
}

function normalizeLateReferralPosition(value: unknown): ComplaintLateReferralPosition {
  return VALID_LATE_REFERRAL_POSITIONS.includes(String(value) as ComplaintLateReferralPosition)
    ? (String(value) as ComplaintLateReferralPosition)
    : 'review_required';
}

function normalizeComplaintWorkspaceSettingsInput(
  input: ComplaintWorkspaceSettingsInput,
  fallback: ComplaintWorkspaceSettings
): ComplaintWorkspaceSettings {
  const has = (key: keyof ComplaintWorkspaceSettingsInput) => Object.prototype.hasOwnProperty.call(input, key);
  const organizationName = sanitizeText(input.organizationName ?? fallback.organizationName) || DEFAULT_COMPLAINT_WORKSPACE_SETTINGS.organizationName;
  const complaintsTeamName = sanitizeText(input.complaintsTeamName ?? fallback.complaintsTeamName) || DEFAULT_COMPLAINT_WORKSPACE_SETTINGS.complaintsTeamName;
  const lateReferralPosition = normalizeLateReferralPosition(input.lateReferralPosition ?? fallback.lateReferralPosition);

  return {
    organizationName,
    complaintsTeamName,
    complaintsEmail: has('complaintsEmail') ? sanitizeNullable(input.complaintsEmail) : sanitizeNullable(fallback.complaintsEmail),
    complaintsPhone: has('complaintsPhone') ? sanitizeNullable(input.complaintsPhone) : sanitizeNullable(fallback.complaintsPhone),
    complaintsAddress: has('complaintsAddress') ? sanitizeNullable(input.complaintsAddress) : sanitizeNullable(fallback.complaintsAddress),
    boardPackSubtitle: has('boardPackSubtitle')
      ? sanitizeNullable(input.boardPackSubtitle) || DEFAULT_COMPLAINT_WORKSPACE_SETTINGS.boardPackSubtitle
      : sanitizeNullable(fallback.boardPackSubtitle) || DEFAULT_COMPLAINT_WORKSPACE_SETTINGS.boardPackSubtitle,
    lateReferralPosition,
    lateReferralCustomText: lateReferralPosition === 'custom'
      ? (has('lateReferralCustomText') ? sanitizeNullable(input.lateReferralCustomText) : sanitizeNullable(fallback.lateReferralCustomText))
      : (has('lateReferralCustomText') ? sanitizeNullable(input.lateReferralCustomText) : null),
    updatedAt: fallback.updatedAt,
  };
}

function labelForLetterTemplate(templateKey: ComplaintLetterTemplateKey): string {
  switch (templateKey) {
    case 'acknowledgement':
      return 'Acknowledgement letter';
    case 'holding_response':
      return 'Holding response';
    case 'final_response':
      return 'Final response';
    case 'fos_referral':
      return 'FOS referral letter';
    case 'custom':
    default:
      return 'Custom correspondence';
  }
}

function toInt(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function sanitizeNullable(value: unknown): string | null {
  const text = sanitizeText(value);
  return text ? text : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateOnly(value: unknown): string | null {
  if (!value) return null;
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function toIsoDateTime(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return new Date(0).toISOString();
  return dt.toISOString();
}

function addDays(dateText: string, days: number): string {
  const dt = new Date(dateText);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeText(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => sanitizeText(item)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}
