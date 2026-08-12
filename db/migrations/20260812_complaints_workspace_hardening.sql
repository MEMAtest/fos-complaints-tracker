BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS complaint_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints_records(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL DEFAULT 'custom',
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_actions_action_type_check CHECK (action_type IN ('custom', 'four_week_progress', 'eight_week_final_response')),
  CONSTRAINT complaint_actions_source_check CHECK (source IN ('manual', 'system')),
  CONSTRAINT complaint_actions_status_check CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_complaint_actions_complaint_created_at ON complaint_actions (complaint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_actions_due_date ON complaint_actions (due_date ASC);
CREATE INDEX IF NOT EXISTS idx_complaint_actions_status ON complaint_actions (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_complaint_actions_system_unique ON complaint_actions (complaint_id, action_type) WHERE source = 'system';

CREATE TABLE IF NOT EXISTS board_pack_saved_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_key TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT board_pack_saved_definitions_template_key_check CHECK (template_key IS NULL OR template_key IN ('board', 'risk_committee', 'exco', 'complaints_mi'))
);

CREATE INDEX IF NOT EXISTS idx_board_pack_saved_definitions_created_at ON board_pack_saved_definitions (created_at DESC);

ALTER TABLE complaint_activities DROP CONSTRAINT IF EXISTS complaint_activities_activity_type_check;
ALTER TABLE complaint_activities ADD CONSTRAINT complaint_activities_activity_type_check CHECK (
  activity_type IN (
    'complaint_created', 'status_change', 'evidence_added', 'evidence_updated', 'evidence_archived', 'evidence_deleted',
    'letter_generated', 'letter_submitted_for_review', 'letter_approved', 'letter_rejected', 'letter_sent', 'letter_superseded',
    'note_added', 'action_created', 'action_updated', 'action_completed', 'action_deleted',
    'assigned', 'priority_change', 'fos_referred', 'resolved', 'closed'
  )
);

DO $$
BEGIN
  CREATE OR REPLACE FUNCTION set_complaints_workspace_updated_at()
  RETURNS TRIGGER AS $fn$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_complaint_actions_updated_at ON complaint_actions;
  CREATE TRIGGER trg_complaint_actions_updated_at BEFORE UPDATE ON complaint_actions FOR EACH ROW EXECUTE FUNCTION set_complaints_workspace_updated_at();

  DROP TRIGGER IF EXISTS trg_board_pack_saved_definitions_updated_at ON board_pack_saved_definitions;
  CREATE TRIGGER trg_board_pack_saved_definitions_updated_at BEFORE UPDATE ON board_pack_saved_definitions FOR EACH ROW EXECUTE FUNCTION set_complaints_workspace_updated_at();
END $$;

COMMIT;
