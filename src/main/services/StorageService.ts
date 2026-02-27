import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'
import { getDbPath } from '../utils/paths'
import { logger } from '../utils/logger'

const SCHEMA_VERSION = 2

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
        if (currentVersion < 2) {
          this.applyMigrationV2()
          db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
            2,
            Date.now()
          )
          logger.info('Migration v2 applied')
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

  private applyMigrationV2(): void {
    const db = this._db!

    // Add AI columns to messages table
    db.exec(`
      ALTER TABLE messages ADD COLUMN ai_labels TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE messages ADD COLUMN ai_spam_score REAL;
      ALTER TABLE messages ADD COLUMN ai_threat_score REAL;
      ALTER TABLE messages ADD COLUMN ai_sentiment TEXT;
      ALTER TABLE messages ADD COLUMN ai_summary TEXT;
      ALTER TABLE messages ADD COLUMN ai_classified_at INTEGER;
      ALTER TABLE messages ADD COLUMN ai_embedded_at INTEGER;
      ALTER TABLE messages ADD COLUMN is_newsletter INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE messages ADD COLUMN newsletter_unsubscribe_url TEXT;

      CREATE INDEX IF NOT EXISTS idx_messages_ai_spam_score ON messages(ai_spam_score);
      CREATE INDEX IF NOT EXISTS idx_messages_ai_threat_score ON messages(ai_threat_score);
      CREATE INDEX IF NOT EXISTS idx_messages_is_newsletter ON messages(is_newsletter);
      CREATE INDEX IF NOT EXISTS idx_messages_ai_classified_at ON messages(ai_classified_at);

      CREATE TABLE IF NOT EXISTS subscriptions (
        id            TEXT PRIMARY KEY,
        from_email    TEXT NOT NULL,
        from_name     TEXT NOT NULL DEFAULT '',
        list_id       TEXT,
        unsubscribe_url TEXT,
        unsubscribe_post TEXT,
        message_count INTEGER NOT NULL DEFAULT 0,
        first_seen_at INTEGER NOT NULL,
        last_seen_at  INTEGER NOT NULL,
        is_muted      INTEGER NOT NULL DEFAULT 0,
        UNIQUE(from_email, list_id)
      );

      CREATE TABLE IF NOT EXISTS ai_queue (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        task_type   TEXT NOT NULL,
        priority    INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        UNIQUE(message_id, task_type)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_queue_priority ON ai_queue(priority DESC, created_at ASC);

      CREATE TABLE IF NOT EXISTS ai_models (
        id          TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        tier        INTEGER NOT NULL,
        size_bytes  INTEGER NOT NULL,
        downloaded_at INTEGER,
        local_path  TEXT,
        model_type  TEXT NOT NULL
      );
    `)
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
