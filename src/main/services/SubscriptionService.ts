import { simpleParser } from 'mailparser'
import { mailRepository } from './MailRepository'
import { emlStore } from './EmlStore'
import { storageService } from './StorageService'
import { logger } from '../utils/logger'
import type { Subscription } from '@shared/types'

interface NewsletterInfo {
  listId: string | null
  unsubscribeUrl: string | null
  unsubscribePost: string | null
}

class SubscriptionService {
  /**
   * Detect newsletter info from message headers
   */
  async detectFromHeaders(messageId: string): Promise<NewsletterInfo | null> {
    try {
      const message = mailRepository.getMessage(messageId)
      if (!message) return null

      const emlBuffer = await emlStore.read(message.emlPath)
      const parsed = await simpleParser(emlBuffer)

      // Extract headers
      const listId = parsed.headers?.get('list-id') as string | undefined
      const listUnsubscribe = parsed.headers?.get('list-unsubscribe') as string | undefined
      const listUnsubscribePost = parsed.headers?.get('list-unsubscribe-post') as
        | string
        | undefined

      let unsubscribeUrl: string | null = null

      // Parse List-Unsubscribe header for HTTP URL
      if (listUnsubscribe) {
        const match = listUnsubscribe.match(/<(https?:\/\/[^>]+)>/)
        if (match) {
          unsubscribeUrl = match[1]
        }
      }

      return {
        listId: listId ?? null,
        unsubscribeUrl,
        unsubscribePost: listUnsubscribePost ?? null
      }
    } catch (err) {
      logger.error(`Error detecting newsletter for message ${messageId}:`, err)
      return null
    }
  }

  /**
   * Check if a message looks like a newsletter based on heuristics
   */
  async isNewsletter(messageId: string): Promise<boolean> {
    try {
      const message = mailRepository.getMessage(messageId)
      if (!message) return false

      const emlBuffer = await emlStore.read(message.emlPath)
      const parsed = await simpleParser(emlBuffer)

      const headers = new Map<string, any>()
      for (const [key, value] of parsed.headers) {
        headers.set(key.toLowerCase(), value)
      }

      // Check for newsletter indicators
      const hasListUnsubscribe = !!headers.get('list-unsubscribe')
      const hasListId = !!headers.get('list-id')
      const precedence = headers.get('precedence')
      const hasPrecedenceBulk = precedence?.toLowerCase() === 'bulk'
      const xMailer = headers.get('x-mailer') ?? ''
      const hasKnownEsp = /mailchimp|sendgrid|constantcontact|campaign/i.test(xMailer)

      // Signal 1: List-Unsubscribe or List-Id headers
      if (hasListUnsubscribe || hasListId) return true

      // Signal 2: Precedence bulk + known ESP
      if (hasPrecedenceBulk && hasKnownEsp) return true

      // Signal 3: Common noreply patterns
      const fromEmail = message.fromEmail.toLowerCase()
      if (
        fromEmail.includes('noreply@') ||
        fromEmail.includes('newsletter@') ||
        fromEmail.includes('updates@') ||
        fromEmail.includes('notifications@')
      ) {
        return true
      }

      return false
    } catch (err) {
      logger.error(`Error checking if newsletter for ${messageId}:`, err)
      return false
    }
  }

  /**
   * List all detected subscriptions
   */
  listSubscriptions(): Subscription[] {
    try {
      const rows = storageService.db
        .prepare('SELECT * FROM subscriptions ORDER BY last_seen_at DESC')
        .all() as any[]

      return rows.map(row => ({
        id: row.id,
        fromEmail: row.from_email,
        fromName: row.from_name,
        listId: row.list_id,
        unsubscribeUrl: row.unsubscribe_url,
        messageCount: row.message_count,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
        isMuted: row.is_muted === 1
      }))
    } catch (err) {
      logger.error('Error listing subscriptions:', err)
      return []
    }
  }

  /**
   * Mute a subscription locally (no unsubscribe action)
   */
  muteSubscription(subscriptionId: string): void {
    try {
      storageService.db
        .prepare('UPDATE subscriptions SET is_muted = 1 WHERE id = ?')
        .run(subscriptionId)
      logger.info(`Muted subscription: ${subscriptionId}`)
    } catch (err) {
      logger.error(`Error muting subscription ${subscriptionId}:`, err)
    }
  }

  /**
   * Unmute a subscription
   */
  unmuteSubscription(subscriptionId: string): void {
    try {
      storageService.db
        .prepare('UPDATE subscriptions SET is_muted = 0 WHERE id = ?')
        .run(subscriptionId)
      logger.info(`Unmuted subscription: ${subscriptionId}`)
    } catch (err) {
      logger.error(`Error unmuting subscription ${subscriptionId}:`, err)
    }
  }

  /**
   * Attempt to unsubscribe using List-Unsubscribe-Post (RFC 8058)
   */
  async unsubscribe(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const rows = storageService.db
        .prepare('SELECT unsubscribe_url, unsubscribe_post FROM subscriptions WHERE id = ?')
        .all(subscriptionId) as any[]

      if (rows.length === 0) {
        return { success: false, error: 'Subscription not found' }
      }

      const { unsubscribe_url, unsubscribe_post } = rows[0]

      // If there's a List-Unsubscribe-Post, try HTTP POST (one-click unsubscribe)
      if (unsubscribe_post && unsubscribe_url) {
        try {
          await this.postUnsubscribe(unsubscribe_url)
          logger.info(`Successfully unsubscribed from ${subscriptionId} via POST`)
          return { success: true }
        } catch (err) {
          logger.error(`Failed to POST unsubscribe:`, err)
          return {
            success: false,
            error: `Failed to unsubscribe: ${String(err)}`
          }
        }
      }

      // If there's just a URL, tell the user to open it
      if (unsubscribe_url) {
        return {
          success: false,
          error: 'Manual unsubscribe required. Please use the unsubscribe link.'
        }
      }

      return { success: false, error: 'No unsubscribe method available' }
    } catch (err) {
      logger.error(`Error unsubscribing from ${subscriptionId}:`, err)
      return { success: false, error: String(err) }
    }
  }

  private async postUnsubscribe(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const httpModule = url.startsWith('https') ? require('https') : require('http')
      const req = httpModule.request(
        url,
        {
          method: 'POST',
          headers: {
            'User-Agent': 'MailTap/1.0'
          }
        },
        (res: any) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve()
          } else {
            reject(new Error(`HTTP ${res.statusCode}`))
          }
        }
      )

      req.on('error', reject)
      req.end()
    })
  }
}

export const subscriptionService = new SubscriptionService()
