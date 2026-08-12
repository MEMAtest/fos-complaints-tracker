import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

await import('./assert-test-database.mjs');

const migrationFiles = [
  'db/migrations/20260219_fos_cutover.sql',
  'db/migrations/20260307_fos_summary_snapshots.sql',
  'db/migrations/20260308_complaints_workspace_and_board_pack.sql',
  'db/migrations/20260319_complaint_evidence_and_letters.sql',
  'db/migrations/20260319_complaints_workspace_settings.sql',
  'db/migrations/20260320_app_rate_limit_windows.sql',
  'db/migrations/20260320_complaint_letter_versioning.sql',
  'db/migrations/20260320_complaint_letter_review_workflow.sql',
  'db/migrations/20260720_fos_advisor_briefs.sql',
  'db/migrations/20260321_advisor_briefs_enhanced.sql',
  'db/migrations/20260321_insight_publication_overrides.sql',
  'db/migrations/20260812_complaints_workspace_hardening.sql',
  'db/migrations/20260812_fos_product_taxonomy.sql',
  'db/migrations/20260812_complaint_letter_assistance.sql',
  'db/test-fixtures/fos-decisions.sql',
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1,
});

try {
  if (process.env.TEST_DB_PRESERVE !== '1') {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    console.log('Reset isolated test database schema.');
  }
  for (const relativePath of migrationFiles) {
    const sql = await readFile(resolve(process.cwd(), relativePath), 'utf8');
    await pool.query(sql);
    console.log(`Applied ${relativePath}`);
  }
} finally {
  await pool.end();
}
