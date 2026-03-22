-- Add enhanced AI columns to fos_advisor_briefs
ALTER TABLE fos_advisor_briefs ADD COLUMN IF NOT EXISTS ai_executive_summary TEXT;
ALTER TABLE fos_advisor_briefs ADD COLUMN IF NOT EXISTS outcome_distribution JSONB;
