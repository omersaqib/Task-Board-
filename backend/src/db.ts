import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS: string[] = [
  `CREATE TABLE users (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
     name          TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   )`,
  `CREATE TABLE tasks (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title       TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     status      TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
     priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
     due_date    TEXT,
     created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   )`,
  `CREATE INDEX idx_tasks_user_id ON tasks(user_id)`,
];

export type Database = DatabaseSync;

/** Opens the SQLite database and applies any pending migrations. */
export function openDatabase(path: string): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
  }
  migrate(db);
  return db;
}

function migrate(db: Database): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  const current = row.user_version;

  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]!);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
