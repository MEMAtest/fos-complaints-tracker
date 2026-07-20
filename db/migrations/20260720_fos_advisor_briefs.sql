CREATE TABLE IF NOT EXISTS fos_advisor_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,
  root_cause TEXT,
  total_cases INTEGER NOT NULL,
  upheld_rate NUMERIC(5,2) NOT NULL,
  not_upheld_rate NUMERIC(5,2) NOT NULL,
  risk_level TEXT NOT NULL,
  trend_direction TEXT NOT NULL,
  year_trend JSONB NOT NULL DEFAULT '[]'::JSONB,
  key_precedents JSONB NOT NULL DEFAULT '[]'::JSONB,
  root_cause_patterns JSONB NOT NULL DEFAULT '[]'::JSONB,
  what_wins JSONB NOT NULL DEFAULT '[]'::JSONB,
  what_loses JSONB NOT NULL DEFAULT '[]'::JSONB,
  ai_what_wins TEXT,
  ai_what_loses TEXT,
  ai_guidance TEXT,
  ai_executive_summary TEXT,
  outcome_distribution JSONB,
  vulnerabilities JSONB NOT NULL DEFAULT '[]'::JSONB,
  sample_cases JSONB NOT NULL DEFAULT '[]'::JSONB,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::JSONB,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(product, root_cause)
);

CREATE INDEX IF NOT EXISTS idx_advisor_briefs_product
  ON fos_advisor_briefs (product);
