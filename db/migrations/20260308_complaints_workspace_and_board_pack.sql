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
  CONSTRAINT complaint_activities_activity_type_check CHECK (activity_type IN ('complaint_created', 'status_change', 'letter_generated', 'letter_sent', 'note_added', 'assigned', 'priority_change', 'fos_referred', 'resolved', 'closed'))
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
  CREATE TRIGGER trg_complaints_records_updated_at
    BEFORE UPDATE ON complaints_records
    FOR EACH ROW
    EXECUTE FUNCTION set_complaints_workspace_updated_at();

  DROP TRIGGER IF EXISTS trg_complaint_import_runs_updated_at ON complaint_import_runs;
  CREATE TRIGGER trg_complaint_import_runs_updated_at
    BEFORE UPDATE ON complaint_import_runs
    FOR EACH ROW
    EXECUTE FUNCTION set_complaints_workspace_updated_at();

  DROP TRIGGER IF EXISTS trg_board_pack_runs_updated_at ON board_pack_runs;
  CREATE TRIGGER trg_board_pack_runs_updated_at
    BEFORE UPDATE ON board_pack_runs
    FOR EACH ROW
    EXECUTE FUNCTION set_complaints_workspace_updated_at();
END $$;
