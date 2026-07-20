import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

await import('./assert-test-database.mjs');

const migrationFiles = [
  'db/migrations/20260219_fos_cutover.sql',
  'db/migrations/20260307_fos_summary_snapshots.sql',
  'db/migrations/20260320_app_rate_limit_windows.sql',
  'db/migrations/20260321_insight_publication_overrides.sql',
  'db/migrations/20260720_fos_advisor_briefs.sql',
  'db/test-fixtures/fos-decisions.sql',
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1,
});

try {
  for (const relativePath of migrationFiles) {
    const sql = await readFile(resolve(process.cwd(), relativePath), 'utf8');
    await pool.query(sql);
    console.log(`Applied ${relativePath}`);
  }
} finally {
  await pool.end();
}
