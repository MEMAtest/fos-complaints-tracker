const connectionString = String(process.env.DATABASE_URL || '').trim();
const explicitLocalOverride = process.env.ALLOW_NON_TEST_DATABASE_FOR_E2E === '1';

if (!connectionString) {
  console.error('E2E database guard failed: DATABASE_URL is required and must point to an isolated test database.');
  process.exit(1);
}

let target;
try {
  target = new URL(connectionString);
} catch {
  console.error('E2E database guard failed: DATABASE_URL is invalid.');
  process.exit(1);
}

const hostname = target.hostname.toLowerCase();
const databaseName = target.pathname.replace(/^\//, '').toLowerCase();
const protectedHosts = new Set([
  '89.167.95.173',
  ...String(process.env.E2E_PROTECTED_DB_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
]);

if (protectedHosts.has(hostname)) {
  console.error(`E2E database guard failed: ${hostname} is a protected database host.`);
  process.exit(1);
}

if (!databaseName.endsWith('_test') && !explicitLocalOverride) {
  console.error(`E2E database guard failed: database name "${databaseName || '(missing)'}" must end in _test.`);
  console.error('For an intentional disposable local database only, set ALLOW_NON_TEST_DATABASE_FOR_E2E=1.');
  process.exit(1);
}

console.log(`E2E database guard passed for ${hostname}/${databaseName}.`);
