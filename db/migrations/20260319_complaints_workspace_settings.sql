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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT complaints_workspace_settings_late_referral_check CHECK (late_referral_position IN ('review_required', 'consent', 'do_not_consent', 'custom'))
);

INSERT INTO complaints_workspace_settings (
  singleton,
  organization_name,
  complaints_team_name,
  board_pack_subtitle,
  late_referral_position
) VALUES (
  TRUE,
  'MEMA Consultants',
  'Complaints Team',
  'Board-ready complaints and ombudsman intelligence pack',
  'review_required'
)
ON CONFLICT (singleton) DO NOTHING;
