import { DatabaseClient } from '@/lib/database';

const COMPLAINTS_WORKSPACE_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS complaints_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_reference TEXT NOT NULL UNIQUE,
  linked_fos_case_id TEXT,
  complainant_name TEXT NOT NULL,
  complainant_email TEXT,
  complainant_phone TEXT,
  complainant_address TEXT,
  firm_name TEXT NOT NULL DEFAULT 'Unknown firm',
  product TEXT,
  complaint_type TEXT NOT NULL DEFAULT 'general',
  complaint_category TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  received_date DATE NOT NULL,
  acknowledged_date DATE,
  four_week_due_date DATE,
  eight_week_due_date DATE,
  final_response_date DATE,
  resolved_date DATE,
  root_cause TEXT,
  remedial_action TEXT,
  resolution TEXT,
  compensation_amount NUMERIC(12,2),
  fos_referred BOOLEAN NOT NULL DEFAULT FALSE,
  fos_outcome TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to TEXT,
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaints_records_status_check CHECK (status IN ('open', 'investigating', 'resolved', 'closed', 'escalated', 'referred_to_fos')),
  CONSTRAINT complaints_records_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);
CREATE INDEX IF NOT EXISTS idx_complaints_records_received_date ON complaints_records (received_date DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_records_status ON complaints_records (status);
CREATE INDEX IF NOT EXISTS idx_complaints_records_priority ON complaints_records (priority);
CREATE INDEX IF NOT EXISTS idx_complaints_records_firm_name ON complaints_records (firm_name);
CREATE INDEX IF NOT EXISTS idx_complaints_records_assigned_to ON complaints_records (assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_records_fos_referred ON complaints_records (fos_referred);
CREATE INDEX IF NOT EXISTS idx_complaints_records_linked_fos_case_id ON complaints_records (linked_fos_case_id);

CREATE TABLE IF NOT EXISTS complaint_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints_records(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_activities_activity_type_check CHECK (activity_type IN ('complaint_created', 'status_change', 'evidence_added', 'evidence_updated', 'evidence_archived', 'evidence_deleted', 'letter_generated', 'letter_submitted_for_review', 'letter_approved', 'letter_rejected', 'letter_sent', 'letter_superseded', 'note_added', 'assigned', 'priority_change', 'fos_referred', 'resolved', 'closed'))
);
CREATE INDEX IF NOT EXISTS idx_complaint_activities_complaint_created_at ON complaint_activities (complaint_id, created_at DESC);

CREATE TABLE IF NOT EXISTS complaint_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  overwritten_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_import_runs_status_check CHECK (status IN ('success', 'partial', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_complaint_import_runs_created_at ON complaint_import_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_import_runs_status ON complaint_import_runs (status);

CREATE TABLE IF NOT EXISTS complaint_import_run_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES complaint_import_runs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  complaint_reference TEXT,
  action TEXT NOT NULL,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  normalized_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_import_run_rows_action_check CHECK (action IN ('new', 'overwrite', 'duplicate_in_file', 'invalid', 'skipped'))
);
CREATE INDEX IF NOT EXISTS idx_complaint_import_run_rows_import_run_id ON complaint_import_run_rows (import_run_id, row_number ASC);

CREATE TABLE IF NOT EXISTS board_pack_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  title TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_name TEXT,
  generated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT board_pack_runs_format_check CHECK (format IN ('pdf', 'pptx')),
  CONSTRAINT board_pack_runs_status_check CHECK (status IN ('success', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_board_pack_runs_created_at ON board_pack_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_pack_runs_format ON board_pack_runs (format);

DO $$
BEGIN
  CREATE OR REPLACE FUNCTION set_complaints_workspace_updated_at()
  RETURNS TRIGGER AS $fn$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_complaints_records_updated_at ON complaints_records;
  CREATE TRIGGER trg_complaints_records_updated_at BEFORE UPDATE ON complaints_records FOR EACH ROW EXECUTE FUNCTION set_complaints_workspace_updated_at();

  DROP TRIGGER IF EXISTS trg_complaint_import_runs_updated_at ON complaint_import_runs;
  CREATE TRIGGER trg_complaint_import_runs_updated_at BEFORE UPDATE ON complaint_import_runs FOR EACH ROW EXECUTE FUNCTION set_complaints_workspace_updated_at();

  DROP TRIGGER IF EXISTS trg_board_pack_runs_updated_at ON board_pack_runs;
  CREATE TRIGGER trg_board_pack_runs_updated_at BEFORE UPDATE ON board_pack_runs FOR EACH ROW EXECUTE FUNCTION set_complaints_workspace_updated_at();
END $$;
`;

const COMPLAINTS_WORKSPACE_EXTENSION_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS complaint_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints_records(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  summary TEXT,
  preview_text TEXT,
  file_bytes BYTEA NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_by TEXT,
  archived_at TIMESTAMPTZ,
  archived_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_evidence_category_check CHECK (category IN ('email', 'statement', 'screenshot', 'call_recording', 'policy_document', 'letter', 'other'))
);
CREATE INDEX IF NOT EXISTS idx_complaint_evidence_complaint_created_at ON complaint_evidence (complaint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_evidence_sha256 ON complaint_evidence (sha256);

CREATE TABLE IF NOT EXISTS complaint_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints_records(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'draft',
  version_number INTEGER NOT NULL DEFAULT 1,
  subject TEXT NOT NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  body_text TEXT NOT NULL,
  generated_by TEXT,
  generated_by_role TEXT NOT NULL DEFAULT 'operator',
  updated_by TEXT,
  updated_by_role TEXT NOT NULL DEFAULT 'operator',
  reviewer_notes TEXT,
  approval_role_required TEXT NOT NULL DEFAULT 'reviewer',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_role TEXT,
  review_decision_code TEXT,
  review_decision_note TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_role TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_letters_template_key_check CHECK (template_key IN ('acknowledgement', 'holding_response', 'final_response', 'fos_referral', 'custom')),
  CONSTRAINT complaint_letters_status_check CHECK (status IN ('draft', 'generated', 'under_review', 'approved', 'rejected_for_rework', 'sent', 'superseded')),
  CONSTRAINT complaint_letters_generated_by_role_check CHECK (generated_by_role IN ('operator', 'reviewer', 'manager', 'admin')),
  CONSTRAINT complaint_letters_updated_by_role_check CHECK (updated_by_role IN ('operator', 'reviewer', 'manager', 'admin')),
  CONSTRAINT complaint_letters_approval_role_required_check CHECK (approval_role_required IN ('operator', 'reviewer', 'manager', 'admin')),
  CONSTRAINT complaint_letters_approved_role_check CHECK (approved_role IS NULL OR approved_role IN ('operator', 'reviewer', 'manager', 'admin')),
  CONSTRAINT complaint_letters_reviewed_role_check CHECK (reviewed_role IS NULL OR reviewed_role IN ('operator', 'reviewer', 'manager', 'admin'))
);
CREATE INDEX IF NOT EXISTS idx_complaint_letters_complaint_created_at ON complaint_letters (complaint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_letters_status ON complaint_letters (status);
`;

const COMPLAINTS_WORKSPACE_LETTER_VERSIONING_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS generated_by_role TEXT NOT NULL DEFAULT 'operator';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS updated_by_role TEXT NOT NULL DEFAULT 'operator';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approval_role_required TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewed_role TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS review_decision_code TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS review_decision_note TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approved_role TEXT;

ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_status_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_status_check CHECK (status IN ('draft', 'generated', 'under_review', 'approved', 'rejected_for_rework', 'sent', 'superseded'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_generated_by_role_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_generated_by_role_check CHECK (generated_by_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_updated_by_role_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_updated_by_role_check CHECK (updated_by_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_approval_role_required_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_approval_role_required_check CHECK (approval_role_required IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_approved_role_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_approved_role_check CHECK (approved_role IS NULL OR approved_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_reviewed_role_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_reviewed_role_check CHECK (reviewed_role IS NULL OR reviewed_role IN ('operator', 'reviewer', 'manager', 'admin'));

ALTER TABLE complaint_activities DROP CONSTRAINT IF EXISTS complaint_activities_activity_type_check;
ALTER TABLE complaint_activities
  ADD CONSTRAINT complaint_activities_activity_type_check CHECK (
    activity_type IN ('complaint_created', 'status_change', 'evidence_added', 'evidence_updated', 'evidence_archived', 'evidence_deleted', 'letter_generated', 'letter_submitted_for_review', 'letter_approved', 'letter_rejected', 'letter_sent', 'letter_superseded', 'note_added', 'assigned', 'priority_change', 'fos_referred', 'resolved', 'closed')
  );

CREATE TABLE IF NOT EXISTS complaint_letter_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID NOT NULL REFERENCES complaint_letters(id) ON DELETE CASCADE,
  complaint_id UUID NOT NULL REFERENCES complaints_records(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  subject TEXT NOT NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  body_text TEXT NOT NULL,
  reviewer_notes TEXT,
  approval_role_required TEXT NOT NULL DEFAULT 'reviewer',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_role TEXT,
  review_decision_code TEXT,
  review_decision_note TEXT,
  approved_role TEXT,
  snapshot_reason TEXT,
  snapshot_by TEXT,
  snapshot_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_letter_versions_status_check CHECK (status IN ('draft', 'generated', 'under_review', 'approved', 'rejected_for_rework', 'sent', 'superseded')),
  CONSTRAINT complaint_letter_versions_unique UNIQUE (letter_id, version_number),
  CONSTRAINT complaint_letter_versions_approval_role_required_check CHECK (approval_role_required IN ('operator', 'reviewer', 'manager', 'admin')),
  CONSTRAINT complaint_letter_versions_approved_role_check CHECK (approved_role IS NULL OR approved_role IN ('operator', 'reviewer', 'manager', 'admin')),
  CONSTRAINT complaint_letter_versions_reviewed_role_check CHECK (reviewed_role IS NULL OR reviewed_role IN ('operator', 'reviewer', 'manager', 'admin')),
  CONSTRAINT complaint_letter_versions_snapshot_by_role_check CHECK (snapshot_by_role IS NULL OR snapshot_by_role IN ('operator', 'reviewer', 'manager', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_complaint_letter_versions_letter_version ON complaint_letter_versions (letter_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_letter_versions_complaint_created_at ON complaint_letter_versions (complaint_id, created_at DESC);
`;

const COMPLAINTS_WORKSPACE_SETTINGS_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS complaints_workspace_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  organization_name TEXT NOT NULL DEFAULT 'MEMA Consultants',
  complaints_team_name TEXT NOT NULL DEFAULT 'Complaints Team',
  complaints_email TEXT,
  complaints_phone TEXT,
  complaints_address TEXT,
  board_pack_subtitle TEXT,
  late_referral_position TEXT NOT NULL DEFAULT 'review_required',
  late_referral_custom_text TEXT,
  current_actor_name TEXT NOT NULL DEFAULT 'MEMA reviewer',
  current_actor_role TEXT NOT NULL DEFAULT 'reviewer',
  letter_approval_role TEXT NOT NULL DEFAULT 'reviewer',
  require_independent_reviewer BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaints_workspace_settings_late_referral_check CHECK (late_referral_position IN ('review_required', 'consent', 'do_not_consent', 'custom')),
  CONSTRAINT complaints_workspace_settings_current_actor_role_check CHECK (current_actor_role IN ('operator', 'reviewer', 'manager', 'admin')),
  CONSTRAINT complaints_workspace_settings_letter_approval_role_check CHECK (letter_approval_role IN ('operator', 'reviewer', 'manager', 'admin'))
);

INSERT INTO complaints_workspace_settings (
  singleton,
  organization_name,
  complaints_team_name,
  board_pack_subtitle,
  late_referral_position,
  current_actor_name,
  current_actor_role,
  letter_approval_role,
  require_independent_reviewer
) VALUES (
  TRUE,
  'MEMA Consultants',
  'Complaints Team',
  'Board-ready complaints and ombudsman intelligence pack',
  'review_required',
  'MEMA reviewer',
  'reviewer',
  'reviewer',
  FALSE
)
ON CONFLICT (singleton) DO NOTHING;
`;

const COMPLAINTS_WORKSPACE_LETTER_REVIEW_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE complaint_evidence ADD COLUMN IF NOT EXISTS preview_text TEXT;
ALTER TABLE complaint_evidence ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE complaint_evidence ADD COLUMN IF NOT EXISTS archived_by TEXT;

ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS generated_by_role TEXT NOT NULL DEFAULT 'operator';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS updated_by_role TEXT NOT NULL DEFAULT 'operator';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approval_role_required TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewed_role TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS review_decision_code TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS review_decision_note TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approved_role TEXT;

ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_status_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_status_check CHECK (status IN ('draft', 'generated', 'under_review', 'approved', 'rejected_for_rework', 'sent', 'superseded'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_generated_by_role_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_generated_by_role_check CHECK (generated_by_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_updated_by_role_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_updated_by_role_check CHECK (updated_by_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_approval_role_required_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_approval_role_required_check CHECK (approval_role_required IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_approved_role_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_approved_role_check CHECK (approved_role IS NULL OR approved_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_reviewed_role_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_reviewed_role_check CHECK (reviewed_role IS NULL OR reviewed_role IN ('operator', 'reviewer', 'manager', 'admin'));

ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS approval_role_required TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS reviewed_role TEXT;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS review_decision_code TEXT;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS review_decision_note TEXT;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS approved_role TEXT;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS snapshot_by_role TEXT;

ALTER TABLE complaint_letter_versions DROP CONSTRAINT IF EXISTS complaint_letter_versions_status_check;
ALTER TABLE complaint_letter_versions
  ADD CONSTRAINT complaint_letter_versions_status_check CHECK (status IN ('draft', 'generated', 'under_review', 'approved', 'rejected_for_rework', 'sent', 'superseded'));
ALTER TABLE complaint_letter_versions DROP CONSTRAINT IF EXISTS complaint_letter_versions_approval_role_required_check;
ALTER TABLE complaint_letter_versions
  ADD CONSTRAINT complaint_letter_versions_approval_role_required_check CHECK (approval_role_required IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letter_versions DROP CONSTRAINT IF EXISTS complaint_letter_versions_approved_role_check;
ALTER TABLE complaint_letter_versions
  ADD CONSTRAINT complaint_letter_versions_approved_role_check CHECK (approved_role IS NULL OR approved_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letter_versions DROP CONSTRAINT IF EXISTS complaint_letter_versions_reviewed_role_check;
ALTER TABLE complaint_letter_versions
  ADD CONSTRAINT complaint_letter_versions_reviewed_role_check CHECK (reviewed_role IS NULL OR reviewed_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letter_versions DROP CONSTRAINT IF EXISTS complaint_letter_versions_snapshot_by_role_check;
ALTER TABLE complaint_letter_versions
  ADD CONSTRAINT complaint_letter_versions_snapshot_by_role_check CHECK (snapshot_by_role IS NULL OR snapshot_by_role IN ('operator', 'reviewer', 'manager', 'admin'));

ALTER TABLE complaints_workspace_settings ADD COLUMN IF NOT EXISTS current_actor_name TEXT NOT NULL DEFAULT 'MEMA reviewer';
ALTER TABLE complaints_workspace_settings ADD COLUMN IF NOT EXISTS current_actor_role TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaints_workspace_settings ADD COLUMN IF NOT EXISTS letter_approval_role TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaints_workspace_settings ADD COLUMN IF NOT EXISTS require_independent_reviewer BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE complaint_activities DROP CONSTRAINT IF EXISTS complaint_activities_activity_type_check;
ALTER TABLE complaint_activities
  ADD CONSTRAINT complaint_activities_activity_type_check CHECK (
    activity_type IN ('complaint_created', 'status_change', 'evidence_added', 'evidence_updated', 'evidence_archived', 'evidence_deleted', 'letter_generated', 'letter_submitted_for_review', 'letter_approved', 'letter_rejected', 'letter_sent', 'letter_superseded', 'note_added', 'assigned', 'priority_change', 'fos_referred', 'resolved', 'closed')
  );

ALTER TABLE complaints_workspace_settings DROP CONSTRAINT IF EXISTS complaints_workspace_settings_current_actor_role_check;
ALTER TABLE complaints_workspace_settings
  ADD CONSTRAINT complaints_workspace_settings_current_actor_role_check CHECK (current_actor_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaints_workspace_settings DROP CONSTRAINT IF EXISTS complaints_workspace_settings_letter_approval_role_check;
ALTER TABLE complaints_workspace_settings
  ADD CONSTRAINT complaints_workspace_settings_letter_approval_role_check CHECK (letter_approval_role IN ('operator', 'reviewer', 'manager', 'admin'));
`;

let schemaPromise: Promise<void> | null = null;
let schemaReady = false;

const BASE_TABLES = [
  'complaints_records',
  'complaint_activities',
  'complaint_import_runs',
  'complaint_import_run_rows',
  'board_pack_runs',
];

const EXTENSION_TABLES = [
  'complaint_evidence',
  'complaint_letters',
];

const SETTINGS_TABLES = [
  'complaints_workspace_settings',
];

const LETTER_VERSIONING_TABLES = [
  'complaint_letter_versions',
];

const LETTER_REVIEW_COLUMNS = [
  'generated_by_role',
  'updated_by',
  'updated_by_role',
  'reviewer_notes',
  'approval_role_required',
  'reviewed_at',
  'reviewed_by',
  'reviewed_role',
  'review_decision_code',
  'review_decision_note',
  'approved_role',
];

const EVIDENCE_MANAGEMENT_COLUMNS = [
  'preview_text',
  'archived_at',
  'archived_by',
];

const LETTER_VERSION_REVIEW_COLUMNS = [
  'reviewer_notes',
  'approval_role_required',
  'reviewed_at',
  'reviewed_by',
  'reviewed_role',
  'review_decision_code',
  'review_decision_note',
  'approved_role',
  'snapshot_by_role',
];

const SETTINGS_REVIEW_COLUMNS = [
  'current_actor_name',
  'current_actor_role',
  'letter_approval_role',
  'require_independent_reviewer',
];

const EXPECTED_CONSTRAINT_DEFINITIONS = [
  {
    name: 'complaint_letters_status_check',
    includes: ["under_review", "rejected_for_rework", "superseded"],
  },
  {
    name: 'complaint_letter_versions_status_check',
    includes: ["under_review", "rejected_for_rework", "superseded"],
  },
  {
    name: 'complaint_activities_activity_type_check',
    includes: ["evidence_added", "evidence_updated", "evidence_archived", "evidence_deleted", "letter_submitted_for_review", "letter_rejected", "letter_superseded"],
  },
];

export async function ensureComplaintsWorkspaceSchema(): Promise<void> {
  if (schemaReady) return;
  const hasBaseTables = await hasComplaintsWorkspaceTables(BASE_TABLES);
  if (!hasBaseTables) {
    await ensureSchemaSql(COMPLAINTS_WORKSPACE_SCHEMA_SQL, BASE_TABLES);
  }

  const hasExtensionTables = await hasComplaintsWorkspaceTables(EXTENSION_TABLES);
  if (!hasExtensionTables) {
    await ensureSchemaSql(COMPLAINTS_WORKSPACE_EXTENSION_SQL, EXTENSION_TABLES);
  }

  const hasSettingsTables = await hasComplaintsWorkspaceTables(SETTINGS_TABLES);
  if (!hasSettingsTables) {
    await ensureSchemaSql(COMPLAINTS_WORKSPACE_SETTINGS_SQL, SETTINGS_TABLES);
  }

  const hasLetterVersioningTables = await hasComplaintsWorkspaceTables(LETTER_VERSIONING_TABLES);
  if (!hasLetterVersioningTables) {
    await ensureSchemaSql(COMPLAINTS_WORKSPACE_LETTER_VERSIONING_SQL, LETTER_VERSIONING_TABLES);
  }

  const hasLetterReviewColumns = await hasComplaintsWorkspaceColumns('complaint_letters', LETTER_REVIEW_COLUMNS);
  const hasLetterVersionReviewColumns = await hasComplaintsWorkspaceColumns('complaint_letter_versions', LETTER_VERSION_REVIEW_COLUMNS);
  const hasSettingsReviewColumns = await hasComplaintsWorkspaceColumns('complaints_workspace_settings', SETTINGS_REVIEW_COLUMNS);
  const hasEvidenceManagementColumns = await hasComplaintsWorkspaceColumns('complaint_evidence', EVIDENCE_MANAGEMENT_COLUMNS);
  const hasExpectedConstraints = await hasComplaintsWorkspaceConstraints(EXPECTED_CONSTRAINT_DEFINITIONS);
  if (!hasLetterReviewColumns || !hasLetterVersionReviewColumns || !hasSettingsReviewColumns || !hasEvidenceManagementColumns || !hasExpectedConstraints) {
    await ensureSchemaSql(COMPLAINTS_WORKSPACE_LETTER_REVIEW_SQL, [...LETTER_VERSIONING_TABLES, ...SETTINGS_TABLES]);
  }

  if (
    await hasComplaintsWorkspaceTables(BASE_TABLES)
    && await hasComplaintsWorkspaceTables(EXTENSION_TABLES)
    && await hasComplaintsWorkspaceTables(SETTINGS_TABLES)
    && await hasComplaintsWorkspaceTables(LETTER_VERSIONING_TABLES)
    && await hasComplaintsWorkspaceColumns('complaint_evidence', EVIDENCE_MANAGEMENT_COLUMNS)
    && await hasComplaintsWorkspaceColumns('complaint_letters', LETTER_REVIEW_COLUMNS)
    && await hasComplaintsWorkspaceColumns('complaint_letter_versions', LETTER_VERSION_REVIEW_COLUMNS)
    && await hasComplaintsWorkspaceColumns('complaints_workspace_settings', SETTINGS_REVIEW_COLUMNS)
    && await hasComplaintsWorkspaceConstraints(EXPECTED_CONSTRAINT_DEFINITIONS)
  ) {
    schemaReady = true;
    return;
  }

  throw new Error('Complaints workspace schema is not ready.');
}

async function ensureSchemaSql(sql: string, expectedTables: string[]): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = DatabaseClient.query(sql)
      .then(() => undefined)
      .catch(async (error) => {
        schemaPromise = null;
        if (await hasComplaintsWorkspaceTables(expectedTables)) {
          return;
        }
        throw error;
      });
  }

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

async function hasComplaintsWorkspaceTables(tables: string[]): Promise<boolean> {
  const row = await DatabaseClient.queryOne<{ existing_count: number }>(
    `
      SELECT COUNT(*)::INT AS existing_count
      FROM UNNEST($1::text[]) AS table_name
      WHERE to_regclass('public.' || table_name) IS NOT NULL
    `,
    [tables]
  );

  return Number(row?.existing_count || 0) === tables.length;
}

async function hasComplaintsWorkspaceColumns(table: string, columns: string[]): Promise<boolean> {
  const row = await DatabaseClient.queryOne<{ existing_count: number }>(
    `
      SELECT COUNT(*)::INT AS existing_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = ANY($2::text[])
    `,
    [table, columns]
  );

  return Number(row?.existing_count || 0) === columns.length;
}

async function hasComplaintsWorkspaceConstraints(
  constraints: Array<{ name: string; includes: string[] }>
): Promise<boolean> {
  const rows = await DatabaseClient.query<{ conname: string; definition: string }>(
    `
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = ANY($1::text[])
    `,
    [constraints.map((constraint) => constraint.name)]
  );

  const byName = new Map(rows.map((row) => [row.conname, String(row.definition || '').toLowerCase()]));
  return constraints.every((constraint) => {
    const definition = byName.get(constraint.name);
    if (!definition) return false;
    return constraint.includes.every((fragment) => definition.includes(fragment.toLowerCase()));
  });
}
