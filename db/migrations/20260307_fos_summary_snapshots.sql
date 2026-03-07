CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS fos_summary_snapshots (
  snapshot_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  source_row_count INTEGER,
  source_max_decision_date DATE,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fos_summary_snapshots_refreshed_at
  ON fos_summary_snapshots (refreshed_at DESC);

CREATE TABLE IF NOT EXISTS fos_summary_refresh_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  snapshot_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_row_count INTEGER,
  source_max_decision_date DATE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fos_summary_refresh_runs_started_at
  ON fos_summary_refresh_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_fos_summary_refresh_runs_status_started_at
  ON fos_summary_refresh_runs (status, started_at DESC);

DO $$
BEGIN
  CREATE OR REPLACE FUNCTION set_fos_summary_updated_at()
  RETURNS TRIGGER AS $fn$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_fos_summary_snapshots_updated_at ON fos_summary_snapshots;
  CREATE TRIGGER trg_fos_summary_snapshots_updated_at
    BEFORE UPDATE ON fos_summary_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION set_fos_summary_updated_at();

  DROP TRIGGER IF EXISTS trg_fos_summary_refresh_runs_updated_at ON fos_summary_refresh_runs;
  CREATE TRIGGER trg_fos_summary_refresh_runs_updated_at
    BEFORE UPDATE ON fos_summary_refresh_runs
    FOR EACH ROW
    EXECUTE FUNCTION set_fos_summary_updated_at();
END $$;
