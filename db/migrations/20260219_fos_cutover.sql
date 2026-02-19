CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS fos_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_reference VARCHAR(100) UNIQUE,
  decision_date DATE,
  business_name TEXT,
  product_sector TEXT,
  outcome VARCHAR(50),
  ombudsman_name TEXT,
  source_url TEXT,
  pdf_url TEXT,
  pdf_sha256 TEXT,
  full_text TEXT,
  complaint_text TEXT,
  firm_response_text TEXT,
  ombudsman_reasoning_text TEXT,
  final_decision_text TEXT,
  decision_summary TEXT,
  precedents JSONB,
  root_cause_tags JSONB,
  vulnerability_flags JSONB,
  decision_logic TEXT,
  embedding JSONB,
  embedding_model VARCHAR(100),
  embedding_dim INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fos_decisions_date ON fos_decisions (decision_date);
CREATE INDEX IF NOT EXISTS idx_fos_decisions_outcome ON fos_decisions (outcome);
CREATE INDEX IF NOT EXISTS idx_fos_decisions_business ON fos_decisions (business_name);
CREATE INDEX IF NOT EXISTS idx_fos_decisions_product ON fos_decisions (product_sector);
CREATE INDEX IF NOT EXISTS idx_fos_decisions_updated ON fos_decisions (updated_at);

CREATE TABLE IF NOT EXISTS fos_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(32) NOT NULL DEFAULT 'idle',
  active_year INTEGER,
  windows_done INTEGER,
  windows_total INTEGER,
  failed_windows INTEGER DEFAULT 0,
  records_ingested INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  last_success_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fos_ingestion_runs_updated ON fos_ingestion_runs (updated_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fos_decisions'
      AND column_name = 'updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION set_fos_decisions_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_fos_decisions_updated_at ON fos_decisions;
    CREATE TRIGGER trg_fos_decisions_updated_at
      BEFORE UPDATE ON fos_decisions
      FOR EACH ROW
      EXECUTE FUNCTION set_fos_decisions_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fos_ingestion_runs'
      AND column_name = 'updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION set_fos_ingestion_runs_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_fos_ingestion_runs_updated_at ON fos_ingestion_runs;
    CREATE TRIGGER trg_fos_ingestion_runs_updated_at
      BEFORE UPDATE ON fos_ingestion_runs
      FOR EACH ROW
      EXECUTE FUNCTION set_fos_ingestion_runs_updated_at();
  END IF;
END $$;
