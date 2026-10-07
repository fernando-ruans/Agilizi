import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = process.cwd();
const dbPath = path.join(here, 'prisma', 'dev.db');
const migDir = path.join(here, 'prisma', 'migrations');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys=OFF;');
db.exec('CREATE TABLE IF NOT EXISTS "_prisma_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "finished_at" DATETIME, "migration_name" TEXT NOT NULL, "logs" TEXT, "rolled_back_at" DATETIME, "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "applied_steps_count" INTEGER NOT NULL DEFAULT 0);');
let applied = [];
try { applied = db.prepare('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL').all().map(r => r.migration_name); } catch (e) {}
console.log('already applied:', applied);
const dirs = fs.readdirSync(migDir).filter(d => d !== 'migration_lock.toml').sort();
console.log('dirs:', dirs);
for (const d of dirs) {
  if (applied.includes(d)) { console.log('skip', d); continue; }
  const sql = fs.readFileSync(path.join(migDir, d, 'migration.sql'), 'utf8');
  console.log('applying', d, sql.length);
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  db.prepare('INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, applied_steps_count) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)').run(id, 'manual', d);
  db.exec(sql);
  db.prepare('UPDATE _prisma_migrations SET finished_at = CURRENT_TIMESTAMP, applied_steps_count = 1 WHERE id = ?').run(id);
  console.log('ok', d);
}
db.close();
console.log('DONE ' + dbPath);
