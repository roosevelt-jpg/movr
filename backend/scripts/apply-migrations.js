/**
 * Apply all SQL files in backend/migrations/ in name order.
 * Tracks applied files in schema_migrations. Idempotent when migrations use IF NOT EXISTS.
 *
 * Usage: node scripts/apply-migrations.js
 * Loads DB_* from backend/.env or repo-root .env via dotenv.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    require('dotenv').config({ path: p });
    break;
  }
}

async function main() {
  loadEnv();
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'movr',
    password: process.env.DB_PASSWORD || 'movr',
    database: process.env.DB_NAME || 'movr_db',
  });

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.+\.sql$/i.test(f))
    .sort();

  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = new Set(
    (await client.query(`SELECT filename FROM schema_migrations`)).rows.map((r) => r.filename)
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`SKIP ${file} (already applied)`);
      skipped++;
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`APPLY ${file}...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
      await client.query('COMMIT');
      console.log(`  OK ${file}`);
      ok++;
    } catch (err) {
      await client.query('ROLLBACK');
      const msg = String(err.message || '');
      const benign =
        /already exists/i.test(msg) ||
        /duplicate_object/i.test(msg) ||
        (/does not exist/i.test(msg) && /extension|postgis|geography|geometry/i.test(msg));
      if (benign) {
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
          [file]
        );
        console.log(`  OK* ${file} (benign: ${msg.split('\n')[0]})`);
        ok++;
      } else {
        failed++;
        console.error(`  FAIL ${file}: ${msg}`);
      }
    }
  }

  console.log(`\nDone. applied=${ok} skipped=${skipped} failed=${failed}`);
  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
