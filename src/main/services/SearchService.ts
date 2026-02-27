import type { Database as DB } from 'better-sqlite3'
import type { SearchQuery, SearchResult, Message } from '@shared/types'
import { storageService } from './StorageService'
import { logger } from '../utils/logger'

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

interface SearchRow extends MessageRow {
  snippet: string
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
    toAddresses: JSON.parse(row.to_addresses),
    ccAddresses: JSON.parse(row.cc_addresses),
    date: row.date,
    receivedAt: row.received_at,
    sizeBytes: row.size_bytes,
    isRead: row.is_read === 1,
    isStarred: row.is_starred === 1,
    isDeleted: row.is_deleted === 1,
    hasAttachments: row.has_attachments === 1,
    emlPath: row.eml_path,
    flags: JSON.parse(row.flags)
  }
}

class SearchService {
  private get db(): DB {
    return storageService.db
  }

  /**
   * Full-text search over messages_fts.
   * Returns matching messages with a body snippet.
   */
  search(query: SearchQuery): SearchResult[] {
    if (!query.text || query.text.trim() === '') {
      return []
    }

    const conditions: string[] = ['messages.is_deleted = 0']
    const params: (string | number)[] = []

    // The FTS match parameter comes first
    const ftsParam = query.text.trim()

    if (query.accountId) {
      conditions.push('messages.account_id = ?')
      params.push(query.accountId)
    }

    const whereClause =
      conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT
        messages.*,
        snippet(messages_fts, 4, '<b>', '</b>', '...', 10) AS snippet
      FROM messages
      JOIN messages_fts ON messages.id = messages_fts.message_id
      WHERE messages_fts MATCH ?
        ${whereClause}
      ORDER BY messages.date DESC
      LIMIT ? OFFSET ?
    `

    try {
      const rows = this.db
        .prepare(sql)
        .all(ftsParam, ...params, query.limit, query.offset) as SearchRow[]

      return rows.map((row) => ({
        message: rowToMessage(row),
        snippet: row.snippet
      }))
    } catch (err) {
      logger.error('SearchService.search error:', err)
      return []
    }
  }

  /**
   * Prefix-search subjects for autocomplete suggestions.
   * Returns up to `limit` (default 5) distinct subjects matching the prefix.
   */
  suggest(text: string, limit = 5): string[] {
    if (!text || text.trim() === '') {
      return []
    }

    const prefix = `${text.trim()}*`

    try {
      const rows = this.db
        .prepare(
          `SELECT DISTINCT subject
           FROM messages_fts
           WHERE subject MATCH ?
           LIMIT ?`
        )
        .all(prefix, limit) as { subject: string }[]

      return rows.map((r) => r.subject)
    } catch (err) {
      logger.error('SearchService.suggest error:', err)
      return []
    }
  }
}

export const searchService = new SearchService()
