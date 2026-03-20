CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approved_by TEXT;

ALTER TABLE complaint_letters DROP CONSTRAINT IF EXISTS complaint_letters_status_check;
ALTER TABLE complaint_letters
  ADD CONSTRAINT complaint_letters_status_check CHECK (status IN ('draft', 'generated', 'approved', 'sent', 'superseded'));

ALTER TABLE complaint_activities DROP CONSTRAINT IF EXISTS complaint_activities_activity_type_check;
ALTER TABLE complaint_activities
  ADD CONSTRAINT complaint_activities_activity_type_check CHECK (
    activity_type IN ('complaint_created', 'status_change', 'letter_generated', 'letter_approved', 'letter_sent', 'letter_superseded', 'note_added', 'assigned', 'priority_change', 'fos_referred', 'resolved', 'closed')
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
  snapshot_reason TEXT,
  snapshot_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_letter_versions_status_check CHECK (status IN ('draft', 'generated', 'approved', 'sent', 'superseded')),
  CONSTRAINT complaint_letter_versions_unique UNIQUE (letter_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_complaint_letter_versions_letter_version ON complaint_letter_versions (letter_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_letter_versions_complaint_created_at ON complaint_letter_versions (complaint_id, created_at DESC);
