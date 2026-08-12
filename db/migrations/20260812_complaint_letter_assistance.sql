ALTER TABLE complaint_letter_versions
  ADD COLUMN IF NOT EXISTS assistance_provenance JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_complaint_letter_versions_evidence_links
  ON complaint_letter_versions USING GIN (evidence_links);
