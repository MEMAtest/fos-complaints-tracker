ALTER TABLE fos_ingestion_runs
  ADD COLUMN IF NOT EXISTS source_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_window_start DATE,
  ADD COLUMN IF NOT EXISTS source_window_end DATE,
  ADD COLUMN IF NOT EXISTS source_latest_decision_date DATE,
  ADD COLUMN IF NOT EXISTS records_discovered INTEGER,
  ADD COLUMN IF NOT EXISTS records_imported INTEGER,
  ADD COLUMN IF NOT EXISTS source_sync_status VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_fos_ingestion_runs_source_checked
  ON fos_ingestion_runs (source_checked_at DESC NULLS LAST);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fos_ingestion_runs'
      AND column_name = 'source_sync_status'
  ) THEN
    ALTER TABLE fos_ingestion_runs
      DROP CONSTRAINT IF EXISTS fos_ingestion_runs_source_sync_status_check;
    ALTER TABLE fos_ingestion_runs
      ADD CONSTRAINT fos_ingestion_runs_source_sync_status_check
      CHECK (
        source_sync_status IS NULL
        OR source_sync_status IN ('in_sync', 'behind', 'partial', 'source_unavailable', 'unknown')
      );
  END IF;
END $$;
