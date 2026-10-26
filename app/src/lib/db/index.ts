/**
 * Local database bootstrap. expo-sqlite + Drizzle (ADR-06).
 *
 * The schema is created here rather than through drizzle-kit migrations: the
 * local store holds only an outbox and a disposable cache, so if it is ever
 * corrupt the correct repair is to delete and recreate it. Nothing here is a
 * system of record — that is Postgres, on the server.
 */
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DATABASE_NAME = 'limitbeyond.db';

const sqlite = SQLite.openDatabaseSync(DATABASE_NAME);

export const db = drizzle(sqlite, { schema });

/** Called once from the root layout, before anything reads the outbox. */
export function initialiseLocalDatabase(): void {
  sqlite.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS outbox (
      id               TEXT PRIMARY KEY,
      idempotency_key  TEXT NOT NULL UNIQUE,
      type             TEXT NOT NULL,
      payload          TEXT NOT NULL,
      occurred_at      TEXT NOT NULL,
      attempts         INTEGER NOT NULL DEFAULT 0,
      next_attempt_at  TEXT,
      last_error       TEXT,
      state            TEXT NOT NULL DEFAULT 'PENDING',
      created_at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_pending
      ON outbox (state, next_attempt_at);

    CREATE TABLE IF NOT EXISTS cache (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      cached_at  TEXT NOT NULL,
      expires_at TEXT
    );
  `);
}

/** Sign-out must not leave one account's queued writes for the next account. */
export function clearLocalDatabase(): void {
  sqlite.execSync(`DELETE FROM outbox; DELETE FROM cache;`);
}
