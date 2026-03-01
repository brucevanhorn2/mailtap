import { storageService } from './StorageService'
import { logger } from '../utils/logger'

export interface LabelCount {
  label: string
  count: number
  percentage: number
}

export interface TimeSeriesPoint {
  date: string
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
    try {
      const db = storageService.db

      // Get all unique labels and their counts
      const params: (string | number)[] = []
      let query = `
        SELECT
          json_extract(ai_labels, '$') as labels_json,
          COUNT(*) as count
        FROM messages
        WHERE ai_labels != '{}' AND is_deleted = 0
      `
      if (accountId) {
        query += ' AND account_id = ?'
        params.push(accountId)
      }
      if (days) {
        query += ' AND received_at > ?'
        params.push(Date.now() - days * 24 * 60 * 60 * 1000)
      }
      query += ' GROUP BY labels_json'

      const rows = db.prepare(query).all(...params) as any[]

      // Flatten label counts from JSON
      const labelCounts = new Map<string, number>()
      let totalMessages = 0

      for (const row of rows) {
        totalMessages += row.count
        try {
          const labels = JSON.parse(row.labels_json) as Record<string, number>
          for (const [label, _score] of Object.entries(labels)) {
            labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
          }
        } catch (err) {
          logger.warn('Failed to parse labels JSON:', err)
        }
      }

      // Convert to array and sort by count
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

      // Use bound parameters throughout — msPerGranule is a safe allowlisted integer
      // but we still bind it to avoid any interpolation risk
      const queryParams: (string | number)[] = [msPerGranule, msPerGranule, cutoffTime]
      let query = `
        SELECT
          CAST((received_at / ?) * ? as INTEGER) as timestamp,
          COUNT(*) as count
        FROM messages
        WHERE is_deleted = 0
          AND received_at > ?
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
   * Get top senders by message count
   */
  getTopSenders(limit: number = 10, accountId?: string): SenderStat[] {
    try {
      const db = storageService.db

      const query = `
        SELECT
          from_email,
          from_name,
          COUNT(*) as count,
          COALESCE(AVG(ai_spam_score), 0) as avg_spam_score
        FROM messages
        WHERE is_deleted = 0
          ${accountId ? 'AND account_id = ?' : ''}
        GROUP BY from_email
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
  getThreatSummary(days: number = 30): ThreatSummary {
    try {
      const db = storageService.db
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000

      // Count threats by severity
      const countQuery = `
        SELECT
          SUM(CASE WHEN ai_threat_score > 0.7 THEN 1 ELSE 0 END) as high_risk,
          SUM(CASE WHEN ai_threat_score > 0.4 AND ai_threat_score <= 0.7 THEN 1 ELSE 0 END) as medium_risk,
          COUNT(*) as total
        FROM messages
        WHERE ai_threat_score IS NOT NULL
          AND is_deleted = 0
          AND received_at > ?
      `

      const countRow = db.prepare(countQuery).get(cutoffTime) as any

      // Get details of high-risk messages
      const detailsQuery = `
        SELECT id, subject, from_email, ai_threat_score
        FROM messages
        WHERE ai_threat_score > 0.5
          AND is_deleted = 0
          AND received_at > ?
        ORDER BY ai_threat_score DESC
        LIMIT 20
      `

      const detailRows = db.prepare(detailsQuery).all(cutoffTime) as any[]

      return {
        totalThreats: countRow.total ?? 0,
        highRisk: countRow.high_risk ?? 0,
        mediumRisk: countRow.medium_risk ?? 0,
        details: detailRows.map((row) => ({
          id: row.id,
          subject: row.subject,
          fromEmail: row.from_email,
          threatScore: row.ai_threat_score ?? 0
        }))
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
