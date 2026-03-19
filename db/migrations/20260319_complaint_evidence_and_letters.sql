CREATE TABLE IF NOT EXISTS complaint_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints_records(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  summary TEXT,
  file_bytes BYTEA NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_by TEXT,
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
  subject TEXT NOT NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  body_text TEXT NOT NULL,
  generated_by TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaint_letters_template_key_check CHECK (template_key IN ('acknowledgement', 'holding_response', 'final_response', 'fos_referral', 'custom')),
  CONSTRAINT complaint_letters_status_check CHECK (status IN ('draft', 'generated', 'sent'))
);
CREATE INDEX IF NOT EXISTS idx_complaint_letters_complaint_created_at ON complaint_letters (complaint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_letters_status ON complaint_letters (status);
