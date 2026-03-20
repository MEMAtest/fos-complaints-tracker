CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS generated_by_role TEXT NOT NULL DEFAULT 'operator';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS updated_by_role TEXT NOT NULL DEFAULT 'operator';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approval_role_required TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaint_letters ADD COLUMN IF NOT EXISTS approved_role TEXT;

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

ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS approval_role_required TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS approved_role TEXT;
ALTER TABLE complaint_letter_versions ADD COLUMN IF NOT EXISTS snapshot_by_role TEXT;

ALTER TABLE complaint_letter_versions DROP CONSTRAINT IF EXISTS complaint_letter_versions_approval_role_required_check;
ALTER TABLE complaint_letter_versions
  ADD CONSTRAINT complaint_letter_versions_approval_role_required_check CHECK (approval_role_required IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letter_versions DROP CONSTRAINT IF EXISTS complaint_letter_versions_approved_role_check;
ALTER TABLE complaint_letter_versions
  ADD CONSTRAINT complaint_letter_versions_approved_role_check CHECK (approved_role IS NULL OR approved_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaint_letter_versions DROP CONSTRAINT IF EXISTS complaint_letter_versions_snapshot_by_role_check;
ALTER TABLE complaint_letter_versions
  ADD CONSTRAINT complaint_letter_versions_snapshot_by_role_check CHECK (snapshot_by_role IS NULL OR snapshot_by_role IN ('operator', 'reviewer', 'manager', 'admin'));

ALTER TABLE complaints_workspace_settings ADD COLUMN IF NOT EXISTS current_actor_name TEXT NOT NULL DEFAULT 'MEMA reviewer';
ALTER TABLE complaints_workspace_settings ADD COLUMN IF NOT EXISTS current_actor_role TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaints_workspace_settings ADD COLUMN IF NOT EXISTS letter_approval_role TEXT NOT NULL DEFAULT 'reviewer';
ALTER TABLE complaints_workspace_settings ADD COLUMN IF NOT EXISTS require_independent_reviewer BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE complaints_workspace_settings DROP CONSTRAINT IF EXISTS complaints_workspace_settings_current_actor_role_check;
ALTER TABLE complaints_workspace_settings
  ADD CONSTRAINT complaints_workspace_settings_current_actor_role_check CHECK (current_actor_role IN ('operator', 'reviewer', 'manager', 'admin'));
ALTER TABLE complaints_workspace_settings DROP CONSTRAINT IF EXISTS complaints_workspace_settings_letter_approval_role_check;
ALTER TABLE complaints_workspace_settings
  ADD CONSTRAINT complaints_workspace_settings_letter_approval_role_check CHECK (letter_approval_role IN ('operator', 'reviewer', 'manager', 'admin'));
