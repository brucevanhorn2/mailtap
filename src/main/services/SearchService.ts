import type { Database as DB } from 'better-sqlite3'
import type {
  SearchQuery,
  SearchResultPage,
  SuggestRequest,
  SuggestResult,
  Message
} from '@shared/types'
import { storageService } from './StorageService'
import { accountService } from './AccountService'
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

/** Escape a string for use inside an FTS5 quoted token */
function escapeFts(s: string): string {
  return s.replace(/"/g, '""')
}

/**
 * Build FTS5 column-qualified tokens for a multi-word value.
 * e.g. buildFtsTokens('from_text', 'john smith') → 'from_text:"john"* from_text:"smith"*'
 */
function buildFtsTokens(column: string, value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${column}:"${escapeFts(w)}"*`)
    .join(' ')
}

class SearchService {
  private get db(): DB {
    return storageService.db
  }

  search(query: SearchQuery): SearchResultPage {
    const { limit, offset } = query

    // Build FTS MATCH expression from text-based filters
    const ftsParts: string[] = []
    if (query.text?.trim()) ftsParts.push(query.text.trim())
    if (query.subject?.trim()) ftsParts.push(buildFtsTokens('subject', query.subject))
    if (query.from?.trim()) ftsParts.push(buildFtsTokens('from_text', query.from))
    if (query.to?.trim()) ftsParts.push(buildFtsTokens('to_text', query.to))
    if (query.body?.trim()) ftsParts.push(buildFtsTokens('body_text', query.body))

    const useFts = ftsParts.length > 0
    const ftsMatch = ftsParts.join(' ')

    // SQL conditions (always applied)
    const conditions: string[] = ['m.is_deleted = 0']
    const sqlParams: (string | number)[] = []

    if (query.accountId) {
      conditions.push('m.account_id = ?')
      sqlParams.push(query.accountId)
    }
    if (query.before != null) {
      conditions.push('m.date < ?')
      sqlParams.push(query.before)
    }
    if (query.after != null) {
      conditions.push('m.date > ?')
      sqlParams.push(query.after)
    }
    if (query.hasAttachment === true) {
      conditions.push('m.has_attachments = 1')
    }
    if (query.isUnread === true) {
      conditions.push('m.is_read = 0')
    }
    if (query.isStarred === true) {
      conditions.push('m.is_starred = 1')
    }

    // CC recipient (SQL LIKE on the stored JSON — FTS doesn't index cc_addresses)
    if (query.cc?.trim()) {
      conditions.push('m.cc_addresses LIKE ?')
      sqlParams.push(`%${query.cc.trim()}%`)
    }

    // CC:me — any of the user's account emails appears in cc_addresses
    if (query.isCcMe === true) {
      try {
        const accountEmails = accountService.listAccounts().map((a) => a.email).filter(Boolean)
        if (accountEmails.length > 0) {
          const ccMeConds = accountEmails.map(() => 'm.cc_addresses LIKE ?')
          conditions.push(`(${ccMeConds.join(' OR ')})`)
          for (const email of accountEmails) sqlParams.push(`%${email}%`)
        }
      } catch (err) {
        logger.warn('SearchService: could not resolve account emails for isCcMe', err)
      }
    }

    // Forwarded — subject starts with common forward prefixes (LIKE is case-insensitive for ASCII)
    if (query.isForwarded === true) {
      conditions.push("(m.subject LIKE 'Fwd:%' OR m.subject LIKE 'FW:%')")
    }

    // No filters at all → return empty
    if (!useFts && conditions.length === 1) {
      return { results: [], total: 0 }
    }

    try {
      if (useFts) {
        const extraWhere = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

        const countSql = `
          SELECT COUNT(*) AS cnt
          FROM messages m
          JOIN messages_fts ON m.id = messages_fts.message_id
          WHERE messages_fts MATCH ?
          ${extraWhere}
        `
        const dataSql = `
          SELECT
            m.*,
            snippet(messages_fts, 4, '<b>', '</b>', '\u2026', 12) AS snippet
          FROM messages m
          JOIN messages_fts ON m.id = messages_fts.message_id
          WHERE messages_fts MATCH ?
          ${extraWhere}
          ORDER BY m.date DESC
          LIMIT ? OFFSET ?
        `

        const countRow = this.db.prepare(countSql).get(ftsMatch, ...sqlParams) as { cnt: number }
        const rows = this.db
          .prepare(dataSql)
          .all(ftsMatch, ...sqlParams, limit, offset) as SearchRow[]

        return {
          results: rows.map((row) => ({ message: rowToMessage(row), snippet: row.snippet })),
          total: countRow.cnt
        }
      } else {
        // SQL-only query (date/flag filters, no full-text)
        const whereClause = `WHERE ${conditions.join(' AND ')}`

        const countSql = `SELECT COUNT(*) AS cnt FROM messages m ${whereClause}`
        const dataSql = `
          SELECT m.*, '' AS snippet
          FROM messages m
          ${whereClause}
          ORDER BY m.date DESC
          LIMIT ? OFFSET ?
        `

        const countRow = this.db.prepare(countSql).get(...sqlParams) as { cnt: number }
        const rows = this.db
          .prepare(dataSql)
          .all(...sqlParams, limit, offset) as SearchRow[]

        return {
          results: rows.map((row) => ({ message: rowToMessage(row), snippet: '' })),
          total: countRow.cnt
        }
      }
    } catch (err) {
      logger.error('SearchService.search error:', err)
      return { results: [], total: 0 }
    }
  }

  suggest(req: SuggestRequest): SuggestResult[] {
    const limit = req.limit ?? 8
    const prefix = req.prefix.trim()

    try {
      switch (req.field) {
        case 'from': {
          const rows = this.db
            .prepare(
              `SELECT from_name AS name, from_email AS email, COUNT(*) AS cnt
               FROM messages
               WHERE is_deleted = 0
                 ${prefix ? 'AND (from_name LIKE ? OR from_email LIKE ?)' : ''}
               GROUP BY from_email
               ORDER BY cnt DESC
               LIMIT ?`
            )
            .all(...(prefix ? [`%${prefix}%`, `%${prefix}%`] : []), limit) as {
              name: string
              email: string
              cnt: number
            }[]
          return rows.map((r) => ({
            value: r.email,
            label: r.name ? `${r.name} <${r.email}>` : r.email,
            count: r.cnt
          }))
        }

        case 'to': {
          // to_addresses is JSON: [{"name":"...","email":"..."},...]
          const rows = this.db
            .prepare(
              `SELECT
                 json_extract(j.value, '$.name') AS name,
                 json_extract(j.value, '$.email') AS email,
                 COUNT(*) AS cnt
               FROM messages, json_each(messages.to_addresses) AS j
               WHERE messages.is_deleted = 0
                 ${prefix ? "AND (json_extract(j.value, '$.name') LIKE ? OR json_extract(j.value, '$.email') LIKE ?)" : ''}
               GROUP BY json_extract(j.value, '$.email')
               ORDER BY cnt DESC
               LIMIT ?`
            )
            .all(...(prefix ? [`%${prefix}%`, `%${prefix}%`] : []), limit) as {
              name: string | null
              email: string
              cnt: number
            }[]
          return rows.map((r) => ({
            value: r.email,
            label: r.name ? `${r.name} <${r.email}>` : r.email,
            count: r.cnt
          }))
        }

        case 'cc': {
          // cc_addresses is JSON: [{"name":"...","email":"..."},...]
          const rows = this.db
            .prepare(
              `SELECT
                 json_extract(j.value, '$.name') AS name,
                 json_extract(j.value, '$.email') AS email,
                 COUNT(*) AS cnt
               FROM messages, json_each(messages.cc_addresses) AS j
               WHERE messages.is_deleted = 0
                 ${prefix ? "AND (json_extract(j.value, '$.name') LIKE ? OR json_extract(j.value, '$.email') LIKE ?)" : ''}
               GROUP BY json_extract(j.value, '$.email')
               ORDER BY cnt DESC
               LIMIT ?`
            )
            .all(...(prefix ? [`%${prefix}%`, `%${prefix}%`] : []), limit) as {
              name: string | null
              email: string
              cnt: number
            }[]
          return rows.map((r) => ({
            value: r.email,
            label: r.name ? `${r.name} <${r.email}>` : r.email,
            count: r.cnt
          }))
        }

        case 'subject': {
          if (!prefix) return []
          const ftsQuery = buildFtsTokens('subject', prefix)
          const rows = this.db
            .prepare(
              `SELECT DISTINCT subject
               FROM messages_fts
               WHERE messages_fts MATCH ?
               LIMIT ?`
            )
            .all(ftsQuery, limit) as { subject: string }[]
          return rows.map((r) => ({ value: r.subject, label: r.subject }))
        }

        case 'tag': {
          const allTags: SuggestResult[] = [
            { value: 'from:', label: 'from: — filter by sender' },
            { value: 'to:', label: 'to: — filter by recipient' },
            { value: 'cc:', label: 'cc: — filter by CC recipient' },
            { value: 'subject:', label: 'subject: — filter by subject' },
            { value: 'body:', label: 'body: — search message body' },
            { value: 'before:', label: 'before: — sent before a date' },
            { value: 'after:', label: 'after: — sent after a date' },
            { value: 'is:', label: 'is: — status filter (unread, starred, forwarded, ccme)' },
            { value: 'has:', label: 'has: — content filter (attachment)' }
          ]
          if (!prefix) return allTags
          const lp = prefix.toLowerCase()
          return allTags.filter(
            (t) => t.value.startsWith(lp) || t.label.toLowerCase().includes(lp)
          )
        }

        case 'is': {
          const opts: SuggestResult[] = [
            { value: 'unread', label: 'unread — show only unread messages' },
            { value: 'read', label: 'read — show only read messages' },
            { value: 'starred', label: 'starred — show only starred messages' },
            { value: 'ccme', label: 'ccme — you are in the CC field' },
            { value: 'forwarded', label: 'forwarded — forwarded messages (Fwd: / FW:)' }
          ]
          if (!prefix) return opts
          return opts.filter((o) => o.value.startsWith(prefix.toLowerCase()))
        }

        case 'has': {
          const opts: SuggestResult[] = [
            { value: 'attachment', label: 'attachment — has file attachments' }
          ]
          if (!prefix) return opts
          return opts.filter((o) => o.value.startsWith(prefix.toLowerCase()))
        }

        case 'date': {
          const opts: SuggestResult[] = [
            { value: 'today', label: 'today' },
            { value: 'yesterday', label: 'yesterday' },
            { value: 'this week', label: 'this week' },
            { value: 'last week', label: 'last week' },
            { value: 'this month', label: 'this month' },
            { value: 'last month', label: 'last month' }
          ]
          if (!prefix) return opts
          return opts.filter((o) => o.value.startsWith(prefix.toLowerCase()))
        }

        default:
          return []
      }
    } catch (err) {
      logger.error('SearchService.suggest error:', err)
      return []
    }
  }
}

export const searchService = new SearchService()
