import { DatabaseClient } from '@/lib/database';

let ensurePromise: Promise<void> | null = null;

export async function ensureInsightsSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = DatabaseClient.query(`
      CREATE TABLE IF NOT EXISTS insight_publication_overrides (
        kind TEXT NOT NULL,
        entity_key TEXT NOT NULL,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        is_noindex BOOLEAN NOT NULL DEFAULT FALSE,
        title_override TEXT,
        description_override TEXT,
        hero_dek_override TEXT,
        featured_rank INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (kind, entity_key)
      );

      CREATE INDEX IF NOT EXISTS insight_publication_overrides_kind_idx
        ON insight_publication_overrides (kind, featured_rank, updated_at DESC);
    `).then(() => undefined).finally(() => {
      ensurePromise = null;
    });
  }

  await ensurePromise;
}
