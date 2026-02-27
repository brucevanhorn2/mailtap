import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'
import { getDbPath } from '../utils/paths'
import { logger } from '../utils/logger'

const SCHEMA_VERSION = 1

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version   INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mailboxes (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  path          TEXT NOT NULL,
  delimiter     TEXT NOT NULL DEFAULT '/',
  attributes    TEXT NOT NULL DEFAULT '[]',
  last_seen_uid INTEGER NOT NULL DEFAULT 0,
  uidvalidity   INTEGER NOT NULL DEFAULT 0,
  total_count   INTEGER NOT NULL DEFAULT 0,
  unread_count  INTEGER NOT NULL DEFAULT 0,
  synced_at     INTEGER,
  UNIQUE(account_id, path)
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL,
  mailbox_id      TEXT NOT NULL,
  uid             INTEGER NOT NULL,
  message_id      TEXT,
  thread_id       TEXT,
  subject         TEXT NOT NULL DEFAULT '',
  from_name       TEXT NOT NULL DEFAULT '',
  from_email      TEXT NOT NULL DEFAULT '',
  to_addresses    TEXT NOT NULL DEFAULT '[]',
  cc_addresses    TEXT NOT NULL DEFAULT '[]',
  date            INTEGER NOT NULL,
  received_at     INTEGER NOT NULL,
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  is_read         INTEGER NOT NULL DEFAULT 0,
  is_starred      INTEGER NOT NULL DEFAULT 0,
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  eml_path        TEXT NOT NULL,
  flags           TEXT NOT NULL DEFAULT '[]',
  UNIQUE(account_id, mailbox_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox_id ON messages(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_email ON messages(from_email);

CREATE TABLE IF NOT EXISTS attachments (
  id           TEXT PRIMARY KEY,
  message_id   TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  content_id   TEXT,
  is_inline    INTEGER NOT NULL DEFAULT 0
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED,
  subject,
  from_text,
  to_text,
  body_text,
  attachment_names
);
`

class StorageService {
  private _db: DB | null = null

  get db(): DB {
    if (!this._db) {
      throw new Error('StorageService not initialized. Call initialize() first.')
    }
    return this._db
  }

  initialize(): void {
    if (this._db) {
      logger.info('StorageService already initialized')
      return
    }

    const dbPath = getDbPath()
    logger.info('Opening SQLite database at', dbPath)

    this._db = new Database(dbPath)

    // Enable WAL mode for better concurrent read performance
    this._db.pragma('journal_mode = WAL')
    // Enable foreign key enforcement
    this._db.pragma('foreign_keys = ON')

    this.runMigrations()

    logger.info('StorageService initialized')
  }

  private runMigrations(): void {
    const db = this._db!

    // Ensure schema_version table exists first
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version    INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `)

    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as
      | { version: number | null }
      | undefined

    const currentVersion = row?.version ?? 0

    if (currentVersion < SCHEMA_VERSION) {
      logger.info(`Running migrations from v${currentVersion} to v${SCHEMA_VERSION}`)

      // Run all migrations in a transaction
      const migrate = db.transaction(() => {
        if (currentVersion < 1) {
          this.applyMigrationV1()
          db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
            1,
            Date.now()
          )
          logger.info('Migration v1 applied')
        }
      })

      migrate()
    } else {
      logger.info(`Database schema is up to date (v${currentVersion})`)
    }
  }

  private applyMigrationV1(): void {
    const db = this._db!
    db.exec(SCHEMA_SQL)
  }

  close(): void {
    if (this._db) {
      this._db.close()
      this._db = null
      logger.info('StorageService closed')
    }
  }
}

export const storageService = new StorageService()
