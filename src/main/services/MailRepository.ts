import { v4 as uuidv4 } from 'uuid'
import type { Database as DB } from 'better-sqlite3'
import type {
  Mailbox,
  Message,
  Attachment,
  EmailAddress,
  MailListQuery,
  MailListResult
} from '@shared/types'
import { storageService } from './StorageService'

// ─── Row types returned from SQLite ──────────────────────────────────────────

interface MailboxRow {
  id: string
  account_id: string
  name: string
  path: string
  delimiter: string
  attributes: string
  last_seen_uid: number
  uidvalidity: number
  total_count: number
  unread_count: number
  synced_at: number | null
}

interface MessageRow {
  id: string
  account_id: string
  mailbox_id: string
  uid: number
  message_id: string | null
  thread_id: string | null
  subject: string
  from_name: string
  from_email: string
  to_addresses: string
  cc_addresses: string
  date: number
  received_at: number
  size_bytes: number
  is_read: number
  is_starred: number
  is_deleted: number
  has_attachments: number
  eml_path: string
  flags: string
}

interface AttachmentRow {
  id: string
  message_id: string
  filename: string
  content_type: string
  size_bytes: number
  content_id: string | null
  is_inline: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToMailbox(row: MailboxRow): Mailbox {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    path: row.path,
    delimiter: row.delimiter,
    attributes: JSON.parse(row.attributes) as string[],
    lastSeenUid: row.last_seen_uid,
    uidvalidity: row.uidvalidity,
    totalCount: row.total_count,
    unreadCount: row.unread_count,
    syncedAt: row.synced_at
  }
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    accountId: row.account_id,
    mailboxId: row.mailbox_id,
    uid: row.uid,
    messageId: row.message_id,
    threadId: row.thread_id,
    subject: row.subject,
    fromName: row.from_name,
    fromEmail: row.from_email,
    toAddresses: JSON.parse(row.to_addresses) as EmailAddress[],
    ccAddresses: JSON.parse(row.cc_addresses) as EmailAddress[],
    date: row.date,
    receivedAt: row.received_at,
    sizeBytes: row.size_bytes,
    isRead: row.is_read === 1,
    isStarred: row.is_starred === 1,
    isDeleted: row.is_deleted === 1,
    hasAttachments: row.has_attachments === 1,
    emlPath: row.eml_path,
    flags: JSON.parse(row.flags) as string[]
  }
}

function rowToAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    messageId: row.message_id,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    contentId: row.content_id,
    isInline: row.is_inline === 1
  }
}

// ─── MailRepository ───────────────────────────────────────────────────────────

class MailRepository {
  private get db(): DB {
    return storageService.db
  }

  // ─── Mailboxes ──────────────────────────────────────────────────────────────

  upsertMailbox(data: {
    accountId: string
    path: string
    name: string
    delimiter: string
    attributes: string[]
    uidvalidity: number
    totalCount: number
    unreadCount: number
  }): Mailbox {
    const db = this.db

    // Check for existing row
    const existing = db
      .prepare<[string, string]>('SELECT id FROM mailboxes WHERE account_id = ? AND path = ?')
      .get(data.accountId, data.path) as { id: string } | undefined

    const id = existing?.id ?? uuidv4()

    db.prepare<[string, string, string, string, string, string, number, number, number]>(
      `INSERT INTO mailboxes
         (id, account_id, name, path, delimiter, attributes, uidvalidity, total_count, unread_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, path) DO UPDATE SET
         name        = excluded.name,
         delimiter   = excluded.delimiter,
         attributes  = excluded.attributes,
         uidvalidity = excluded.uidvalidity,
         total_count = excluded.total_count,
         unread_count= excluded.unread_count`
    ).run(
      id,
      data.accountId,
      data.name,
      data.path,
      data.delimiter,
      JSON.stringify(data.attributes),
      data.uidvalidity,
      data.totalCount,
      data.unreadCount
    )

    const row = db
      .prepare<[string]>('SELECT * FROM mailboxes WHERE id = ?')
      .get(id) as MailboxRow
    return rowToMailbox(row)
  }

  getMailbox(accountId: string, path: string): Mailbox | null {
    const row = this.db
      .prepare<[string, string]>(
        'SELECT * FROM mailboxes WHERE account_id = ? AND path = ?'
      )
      .get(accountId, path) as MailboxRow | undefined
    return row ? rowToMailbox(row) : null
  }

  getMailboxById(id: string): Mailbox | null {
    const row = this.db
      .prepare<[string]>('SELECT * FROM mailboxes WHERE id = ?')
      .get(id) as MailboxRow | undefined
    return row ? rowToMailbox(row) : null
  }

  listMailboxes(accountId?: string): Mailbox[] {
    if (accountId) {
      const rows = this.db
        .prepare<[string]>('SELECT * FROM mailboxes WHERE account_id = ? ORDER BY path ASC')
        .all(accountId) as MailboxRow[]
      return rows.map(rowToMailbox)
    }
    const rows = this.db
      .prepare('SELECT * FROM mailboxes ORDER BY account_id ASC, path ASC')
      .all() as MailboxRow[]
    return rows.map(rowToMailbox)
  }

  updateMailboxLastSeenUid(mailboxId: string, uid: number): void {
    this.db
      .prepare<[number, string]>(
        'UPDATE mailboxes SET last_seen_uid = ? WHERE id = ?'
      )
      .run(uid, mailboxId)
  }

  updateMailboxUnreadCount(mailboxId: string, count: number): void {
    this.db
      .prepare<[number, string]>(
        'UPDATE mailboxes SET unread_count = ? WHERE id = ?'
      )
      .run(count, mailboxId)
  }

  updateMailboxSyncedAt(mailboxId: string): void {
    this.db
      .prepare<[number, string]>(
        'UPDATE mailboxes SET synced_at = ? WHERE id = ?'
      )
      .run(Date.now(), mailboxId)
  }

  deleteMailboxMessages(mailboxId: string): void {
    // First, delete FTS rows for all messages in this mailbox
    const messageIds = this.db
      .prepare<[string]>('SELECT id FROM messages WHERE mailbox_id = ?')
      .all(mailboxId) as { id: string }[]

    const deleteFts = this.db.prepare<[string]>(
      'DELETE FROM messages_fts WHERE message_id = ?'
    )

    const deleteAll = this.db.transaction(() => {
      for (const { id } of messageIds) {
        deleteFts.run(id)
      }
      this.db
        .prepare<[string]>('DELETE FROM messages WHERE mailbox_id = ?')
        .run(mailboxId)
    })

    deleteAll()
  }

  // ─── Messages ───────────────────────────────────────────────────────────────

  upsertMessage(data: {
    accountId: string
    mailboxId: string
    uid: number
    messageId: string | null
    threadId: string | null
    subject: string
    fromName: string
    fromEmail: string
    toAddresses: EmailAddress[]
    ccAddresses: EmailAddress[]
    date: number
    receivedAt: number
    sizeBytes: number
    isRead: boolean
    isStarred: boolean
    isDeleted: boolean
    hasAttachments: boolean
    emlPath: string
    flags: string[]
  }): Message {
    const db = this.db

    const existing = db
      .prepare<[string, string, number]>(
        'SELECT id FROM messages WHERE account_id = ? AND mailbox_id = ? AND uid = ?'
      )
      .get(data.accountId, data.mailboxId, data.uid) as { id: string } | undefined

    const id = existing?.id ?? uuidv4()

    db.prepare(
      `INSERT INTO messages
         (id, account_id, mailbox_id, uid, message_id, thread_id, subject,
          from_name, from_email, to_addresses, cc_addresses, date, received_at,
          size_bytes, is_read, is_starred, is_deleted, has_attachments, eml_path, flags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, mailbox_id, uid) DO UPDATE SET
         message_id      = excluded.message_id,
         thread_id       = excluded.thread_id,
         subject         = excluded.subject,
         from_name       = excluded.from_name,
         from_email      = excluded.from_email,
         to_addresses    = excluded.to_addresses,
         cc_addresses    = excluded.cc_addresses,
         date            = excluded.date,
         received_at     = excluded.received_at,
         size_bytes      = excluded.size_bytes,
         is_read         = excluded.is_read,
         is_starred      = excluded.is_starred,
         is_deleted      = excluded.is_deleted,
         has_attachments = excluded.has_attachments,
         eml_path        = excluded.eml_path,
         flags           = excluded.flags`
    ).run(
      id,
      data.accountId,
      data.mailboxId,
      data.uid,
      data.messageId,
      data.threadId,
      data.subject,
      data.fromName,
      data.fromEmail,
      JSON.stringify(data.toAddresses),
      JSON.stringify(data.ccAddresses),
      data.date,
      data.receivedAt,
      data.sizeBytes,
      data.isRead ? 1 : 0,
      data.isStarred ? 1 : 0,
      data.isDeleted ? 1 : 0,
      data.hasAttachments ? 1 : 0,
      data.emlPath,
      JSON.stringify(data.flags)
    )

    const row = db
      .prepare<[string]>('SELECT * FROM messages WHERE id = ?')
      .get(id) as MessageRow
    return rowToMessage(row)
  }

  getMessage(id: string): Message | null {
    const row = this.db
      .prepare<[string]>('SELECT * FROM messages WHERE id = ?')
      .get(id) as MessageRow | undefined
    return row ? rowToMessage(row) : null
  }

  listMessages(query: MailListQuery): MailListResult {
    const conditions: string[] = ['is_deleted = 0']
    const params: (string | number)[] = []

    if (query.accountId) {
      conditions.push('account_id = ?')
      params.push(query.accountId)
    }

    if (query.mailboxId) {
      conditions.push('mailbox_id = ?')
      params.push(query.mailboxId)
    }

    if (query.onlyUnread) {
      conditions.push('is_read = 0')
    }

    if (query.onlyStarred) {
      conditions.push('is_starred = 1')
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countRow = this.db
      .prepare<(string | number)[]>(`SELECT COUNT(*) as total FROM messages ${where}`)
      .get(...params) as { total: number }

    const total = countRow.total

    const rows = this.db
      .prepare<(string | number)[]>(
        `SELECT * FROM messages ${where} ORDER BY date DESC LIMIT ? OFFSET ?`
      )
      .all(...params, query.limit, query.offset) as MessageRow[]

    return {
      messages: rows.map(rowToMessage),
      total
    }
  }

  markRead(id: string, isRead: boolean): void {
    this.db
      .prepare<[number, string]>('UPDATE messages SET is_read = ? WHERE id = ?')
      .run(isRead ? 1 : 0, id)
  }

  markStarred(id: string, isStarred: boolean): void {
    this.db
      .prepare<[number, string]>('UPDATE messages SET is_starred = ? WHERE id = ?')
      .run(isStarred ? 1 : 0, id)
  }

  softDeleteMessage(id: string): void {
    this.db
      .prepare<[string]>('UPDATE messages SET is_deleted = 1 WHERE id = ?')
      .run(id)
  }

  getEmlPath(id: string): string | null {
    const row = this.db
      .prepare<[string]>('SELECT eml_path FROM messages WHERE id = ?')
      .get(id) as { eml_path: string } | undefined
    return row?.eml_path ?? null
  }

  getUnreadCounts(): Record<string, number> {
    const rows = this.db
      .prepare(
        `SELECT mailbox_id, COUNT(*) as count
         FROM messages
         WHERE is_read = 0 AND is_deleted = 0
         GROUP BY mailbox_id`
      )
      .all() as { mailbox_id: string; count: number }[]

    const result: Record<string, number> = {}
    for (const row of rows) {
      result[row.mailbox_id] = row.count
    }
    return result
  }

  // ─── Attachments ─────────────────────────────────────────────────────────────

  upsertAttachment(data: {
    messageId: string
    filename: string
    contentType: string
    sizeBytes: number
    contentId: string | null
    isInline: boolean
  }): Attachment {
    const db = this.db

    // Check for existing attachment by messageId + filename + contentId combination
    const existing = db
      .prepare<[string, string]>(
        'SELECT id FROM attachments WHERE message_id = ? AND filename = ?'
      )
      .get(data.messageId, data.filename) as { id: string } | undefined

    const id = existing?.id ?? uuidv4()

    db.prepare(
      `INSERT INTO attachments (id, message_id, filename, content_type, size_bytes, content_id, is_inline)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         filename     = excluded.filename,
         content_type = excluded.content_type,
         size_bytes   = excluded.size_bytes,
         content_id   = excluded.content_id,
         is_inline    = excluded.is_inline`
    ).run(
      id,
      data.messageId,
      data.filename,
      data.contentType,
      data.sizeBytes,
      data.contentId,
      data.isInline ? 1 : 0
    )

    const row = db
      .prepare<[string]>('SELECT * FROM attachments WHERE id = ?')
      .get(id) as AttachmentRow
    return rowToAttachment(row)
  }

  listAttachments(messageId: string): Attachment[] {
    const rows = this.db
      .prepare<[string]>('SELECT * FROM attachments WHERE message_id = ?')
      .all(messageId) as AttachmentRow[]
    return rows.map(rowToAttachment)
  }

  getAttachment(id: string): Attachment | null {
    const row = this.db
      .prepare<[string]>('SELECT * FROM attachments WHERE id = ?')
      .get(id) as AttachmentRow | undefined
    return row ? rowToAttachment(row) : null
  }

  // ─── FTS ─────────────────────────────────────────────────────────────────────

  insertFts(data: {
    messageId: string
    subject: string
    fromText: string
    toText: string
    bodyText: string
    attachmentNames: string
  }): void {
    // Delete existing FTS row first to avoid duplicates
    this.deleteFts(data.messageId)

    this.db
      .prepare(
        `INSERT INTO messages_fts (message_id, subject, from_text, to_text, body_text, attachment_names)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.messageId,
        data.subject,
        data.fromText,
        data.toText,
        data.bodyText,
        data.attachmentNames
      )
  }

  deleteFts(messageId: string): void {
    this.db
      .prepare<[string]>('DELETE FROM messages_fts WHERE message_id = ?')
      .run(messageId)
  }
}

export const mailRepository = new MailRepository()
