import { storageService } from './StorageService'
import { settingsService } from './SettingsService'
import { logger } from '../utils/logger'
import type { AccountStats } from '@shared/types'

export interface LabelCount {
  label: string
  count: number
  percentage: number
}

export interface TimeSeriesPoint {
  date: string
  timestamp: number
  count: number
  label?: string
}

export interface SenderStat {
  email: string
  name: string
  count: number
  avgSpamScore: number
}

export interface ThreatMessage {
  id: string
  subject: string
  fromEmail: string
  threatScore: number
  labels: Record<string, number>
  sentiment: string | null
}

export interface ClassifiedMessage {
  id: string
  subject: string
  fromEmail: string
  date: number
  labels: Record<string, number>
  sentiment: string | null
}

export interface ThreatSummary {
  totalThreats: number
  highRisk: number
  mediumRisk: number
  details: ThreatMessage[]
}

export interface SentimentCount {
  sentiment: string
  count: number
  percentage: number
}

class AiAnalyticsService {
  /**
   * Get classification label distribution (pie chart data)
   */
  getClassificationBreakdown(accountId?: string, days?: number): LabelCount[] {
    const SECURITY_LABELS = new Set(['phishing', 'spam', 'security alert'])
    const THREAT_THRESHOLD = 0.5

    try {
      const db = storageService.db

      const params: (string | number)[] = []
      let query = `
        SELECT ai_labels
        FROM messages
        WHERE ai_labels IS NOT NULL AND ai_labels != '{}' AND is_deleted = 0
      `
      if (accountId) {
        query += ' AND account_id = ?'
        params.push(accountId)
      }
      if (days) {
        query += ' AND received_at > ?'
        params.push(Date.now() - days * 24 * 60 * 60 * 1000)
      }

      const rows = db.prepare(query).all(...params) as any[]

      // For each message, pick one effective label:
      // - If any security label scores > threshold, use the highest security label
      // - Otherwise, use the highest-scoring non-security label
      const labelCounts = new Map<string, number>()
      let totalMessages = 0

      for (const row of rows) {
        try {
          const labels = JSON.parse(row.ai_labels) as Record<string, number>
          const entries = Object.entries(labels)
          if (entries.length === 0) continue

          // Find highest security label above threshold
          let topSecurityLabel: string | null = null
          let topSecurityScore = 0
          for (const [label, score] of entries) {
            if (SECURITY_LABELS.has(label) && score > THREAT_THRESHOLD && score > topSecurityScore) {
              topSecurityLabel = label
              topSecurityScore = score
            }
          }

          let effectiveLabel: string
          if (topSecurityLabel) {
            effectiveLabel = topSecurityLabel
          } else {
            // Highest-scoring non-security label
            let topLabel = entries[0][0]
            let topScore = entries[0][1]
            for (const [label, score] of entries) {
              if (!SECURITY_LABELS.has(label) && score > topScore) {
                topLabel = label
                topScore = score
              }
            }
            effectiveLabel = topLabel
          }

          totalMessages++
          labelCounts.set(effectiveLabel, (labelCounts.get(effectiveLabel) ?? 0) + 1)
        } catch (err) {
          logger.warn('Failed to parse labels JSON:', err)
        }
      }

      const result: LabelCount[] = Array.from(labelCounts.entries())
        .map(([label, count]) => ({
          label,
          count,
          percentage: totalMessages > 0 ? Math.round((count / totalMessages) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)

      return result
    } catch (err) {
      logger.error('Error getting classification breakdown:', err)
      return []
    }
  }

  /**
   * Get message volume over time (line chart data)
   */
  getVolumeTimeSeries(
    accountId?: string,
    granularity: 'day' | 'week' | 'month' = 'day',
    range: number = 30
  ): TimeSeriesPoint[] {
    try {
      const db = storageService.db

      const validGranules: Record<string, number> = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      }
      const msPerGranule = validGranules[granularity] ?? validGranules.day

      const cutoffTime = Date.now() - range * msPerGranule

      // Use the email's actual date (Date header), not received_at (sync timestamp)
      const queryParams: (string | number)[] = [msPerGranule, msPerGranule, cutoffTime]
      let query = `
        SELECT
          CAST((date / ?) * ? as INTEGER) as timestamp,
          COUNT(*) as count
        FROM messages
        WHERE is_deleted = 0
          AND date > ?
      `
      if (accountId) {
        query += ' AND account_id = ?'
        queryParams.push(accountId)
      }
      query += ' GROUP BY timestamp ORDER BY timestamp ASC'

      const rows = db.prepare(query).all(...queryParams) as any[]

      const result: TimeSeriesPoint[] = rows.map((row) => {
        const date = new Date(row.timestamp).toLocaleDateString()
        return {
          date,
          timestamp: row.timestamp as number,
          count: row.count
        }
      })

      return result
    } catch (err) {
      logger.error('Error getting volume time series:', err)
      return []
    }
  }

  /**
   * Get top senders by message count (excludes sent folder)
   */
  getTopSenders(limit: number = 10, accountId?: string): SenderStat[] {
    try {
      const db = storageService.db

      const query = `
        SELECT
          m.from_email,
          m.from_name,
          COUNT(*) as count,
          COALESCE(AVG(m.ai_spam_score), 0) as avg_spam_score
        FROM messages m
        JOIN mailboxes mb ON m.mailbox_id = mb.id
        WHERE m.is_deleted = 0
          AND mb.attributes NOT LIKE '%Sent%'
          AND mb.attributes NOT LIKE '%All%'
          AND mb.attributes NOT LIKE '%Drafts%'
          ${accountId ? 'AND m.account_id = ?' : ''}
        GROUP BY m.from_email
        ORDER BY count DESC
        LIMIT ?
      `

      const rows = db.prepare(query).all(...(accountId ? [accountId, limit] : [limit])) as any[]

      const result: SenderStat[] = rows.map((row) => ({
        email: row.from_email,
        name: row.from_name || row.from_email,
        count: row.count,
        avgSpamScore: row.avg_spam_score ?? 0
      }))

      return result
    } catch (err) {
      logger.error('Error getting top senders:', err)
      return []
    }
  }

  /**
   * Get threat summary
   */
  getThreatSummary(days: number = 30, accountId?: string): ThreatSummary {
    try {
      const db = storageService.db
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000
      const settings = settingsService.load()
      const threatThreshold = settings.ai?.threatThreshold ?? 0.5
      const mediumRiskThreshold = Math.max(0.3, threatThreshold * 0.5)

      const accountFilter = accountId ? 'AND account_id = ?' : ''
      const baseParams: (string | number)[] = accountId ? [cutoffTime, accountId] : [cutoffTime]

      // Count threats by severity using dynamic thresholds
      const countRow = db.prepare(`
        SELECT
          SUM(CASE WHEN ai_threat_score > ? THEN 1 ELSE 0 END) as high_risk,
          SUM(CASE WHEN ai_threat_score > ? AND ai_threat_score <= ? THEN 1 ELSE 0 END) as medium_risk,
          COUNT(*) as total
        FROM messages
        WHERE ai_threat_score IS NOT NULL
          AND is_deleted = 0
          AND received_at > ?
          ${accountFilter}
      `).get(threatThreshold, mediumRiskThreshold, threatThreshold, ...baseParams) as any

      // No longer fetching detail rows — they were only used by the removed table
      const detailRows: any[] = []

      return {
        totalThreats: countRow.total ?? 0,
        highRisk: countRow.high_risk ?? 0,
        mediumRisk: countRow.medium_risk ?? 0,
        details: detailRows.map((row) => {
          let labels: Record<string, number> = {}
          let sentiment: string | null = null
          try {
            if (row.ai_labels) labels = JSON.parse(row.ai_labels)
          } catch { /* ignore */ }
          try {
            if (row.ai_sentiment) {
              const parsed = JSON.parse(row.ai_sentiment)
              sentiment = parsed.label ?? null
            }
          } catch { /* ignore */ }
          return {
            id: row.id,
            subject: row.subject,
            fromEmail: row.from_email,
            threatScore: row.ai_threat_score ?? 0,
            labels,
            sentiment
          }
        })
      }
    } catch (err) {
      logger.error('Error getting threat summary:', err)
      return {
        totalThreats: 0,
        highRisk: 0,
        mediumRisk: 0,
        details: []
      }
    }
  }

  /**
   * Get sample messages for a given classification label
   */
  getMessagesByLabel(label: string, limit: number = 20): ClassifiedMessage[] {
    const SECURITY_LABELS = new Set(['phishing', 'spam', 'security alert'])
    const THREAT_THRESHOLD = 0.5

    try {
      const db = storageService.db

      // We need to compute the effective label in JS (same logic as getClassificationBreakdown)
      const rows = db.prepare(`
        SELECT id, subject, from_email, date, ai_labels, ai_sentiment
        FROM messages
        WHERE ai_labels IS NOT NULL AND ai_labels != '{}' AND is_deleted = 0
        ORDER BY date DESC
      `).all() as any[]

      const results: ClassifiedMessage[] = []

      for (const row of rows) {
        if (results.length >= limit) break
        try {
          const labels = JSON.parse(row.ai_labels) as Record<string, number>
          const entries = Object.entries(labels)
          if (entries.length === 0) continue

          // Determine effective label (same logic as breakdown)
          let topSecurityLabel: string | null = null
          let topSecurityScore = 0
          for (const [l, score] of entries) {
            if (SECURITY_LABELS.has(l) && score > THREAT_THRESHOLD && score > topSecurityScore) {
              topSecurityLabel = l
              topSecurityScore = score
            }
          }

          let effectiveLabel: string
          if (topSecurityLabel) {
            effectiveLabel = topSecurityLabel
          } else {
            let topLabel = entries[0][0]
            let topScore = entries[0][1]
            for (const [l, score] of entries) {
              if (!SECURITY_LABELS.has(l) && score > topScore) {
                topLabel = l
                topScore = score
              }
            }
            effectiveLabel = topLabel
          }

          if (effectiveLabel !== label) continue

          let sentiment: string | null = null
          try {
            if (row.ai_sentiment) {
              const parsed = JSON.parse(row.ai_sentiment)
              sentiment = parsed.label ?? null
            }
          } catch { /* ignore */ }

          results.push({
            id: row.id,
            subject: row.subject,
            fromEmail: row.from_email,
            date: row.date,
            labels,
            sentiment
          })
        } catch {
          // skip rows with bad JSON
        }
      }

      return results
    } catch (err) {
      logger.error('Error getting messages by label:', err)
      return []
    }
  }

  /**
   * Get per-account message counts (all time, 30d, 7d, today)
   */
  getAccountStats(): AccountStats[] {
    try {
      const db = storageService.db
      const now = Date.now()
      const ago30d = now - 30 * 24 * 60 * 60 * 1000
      const ago7d = now - 7 * 24 * 60 * 60 * 1000
      const todayStart = new Date().setHours(0, 0, 0, 0)

      const rows = db.prepare(`
        SELECT
          account_id,
          COUNT(*) as total_all,
          SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) as total_30d,
          SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) as total_7d,
          SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) as total_today
        FROM messages
        WHERE is_deleted = 0
        GROUP BY account_id
      `).all(ago30d, ago7d, todayStart) as any[]

      return rows.map((row) => ({
        accountId: row.account_id,
        totalAll: row.total_all,
        total30d: row.total_30d,
        total7d: row.total_7d,
        totalToday: row.total_today
      }))
    } catch (err) {
      logger.error('Error getting account stats:', err)
      return []
    }
  }

  /**
   * Get sentiment distribution
   */
  getSentimentBreakdown(accountId?: string): SentimentCount[] {
    try {
      const db = storageService.db

      const query = `
        SELECT
          json_extract(ai_sentiment, '$.label') as sentiment,
          COUNT(*) as count
        FROM messages
        WHERE ai_sentiment IS NOT NULL
          AND is_deleted = 0
          ${accountId ? 'AND account_id = ?' : ''}
        GROUP BY sentiment
        ORDER BY count DESC
      `

      const rows = db.prepare(query).all(...(accountId ? [accountId] : [])) as any[]

      const total = rows.reduce((sum, row) => sum + row.count, 0)

      const result: SentimentCount[] = rows.map((row) => ({
        sentiment: row.sentiment ?? 'unknown',
        count: row.count,
        percentage: total > 0 ? Math.round((row.count / total) * 100) : 0
      }))

      return result
    } catch (err) {
      logger.error('Error getting sentiment breakdown:', err)
      return []
    }
  }
}

export const aiAnalyticsService = new AiAnalyticsService()
