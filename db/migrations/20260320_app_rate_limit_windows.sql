CREATE TABLE IF NOT EXISTS app_rate_limit_windows (
  scope_key TEXT NOT NULL,
  bucket_start_ms BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope_key, bucket_start_ms)
);

CREATE INDEX IF NOT EXISTS idx_app_rate_limit_windows_reset_at
  ON app_rate_limit_windows (reset_at);
