import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Db = Database.Database;

const here = dirname(fileURLToPath(import.meta.url));
// dev/test: src/db -> ../../migrations ; build: dist/src/db -> ../../migrations (bản sao trong dist)
const candidates = [join(here, '..', '..', 'migrations'), join(here, '..', '..', '..', 'migrations')];

function migrationsDir(): string {
  for (const c of candidates) {
    try {
      readdirSync(c);
      return c;
    } catch {
      /* thử đường dẫn tiếp theo */
    }
  }
  throw new Error('Không tìm thấy thư mục migrations');
}

export function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const applied = new Set(
    db
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((r) => (r as { name: string }).name),
  );
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(f);
    })();
  }
}

export function openDb(path: string): Db {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}
