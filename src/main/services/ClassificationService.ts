import { aiWorkerPool, type ClassificationResult } from './AiWorkerPool'
import { mailRepository } from './MailRepository'
import { emlStore } from './EmlStore'
import { storageService } from './StorageService'
import { subscriptionService } from './SubscriptionService'
import { simpleParser } from 'mailparser'
import { logger } from '../utils/logger'

export interface ClassificationProgress {
  current: number
  total: number
  phase: string
}

interface ProgressCallback {
  (progress: ClassificationProgress): void
}

class ClassificationService {
  private spamTrainingData: Array<{ text: string; isSpam: boolean }> = []

  /**
   * Classify a single message
   */
  async classifyMessage(
    messageId: string,
    labels: string[]
  ): Promise<void> {
    try {
      const message = mailRepository.getMessage(messageId)
      if (!message) {
        logger.warn(`Message not found: ${messageId}`)
        return
      }

      const emlBuffer = await emlStore.read(message.emlPath)
      const parsed = await simpleParser(emlBuffer)

      // Prepare text for classification
      const text = `${message.subject}\n${message.fromName} ${message.fromEmail}\n${parsed.text ?? ''}`
        .slice(0, 512) // Truncate to avoid token limits

      // Run zero-shot classification
      let classificationResult: ClassificationResult | null = null
      try {
        classificationResult = await aiWorkerPool.classify(text, labels)
      } catch (err) {
        logger.error(`Classification failed for ${messageId}:`, err)
      }

      // Update message with classification results
      if (classificationResult) {
        const db = storageService.db

        // Derive spam score from label confidences
        const spamScore = classificationResult.labels['spam'] ?? 0

        // Derive threat score from security/phishing label confidences
        const threatScore = Math.max(
          classificationResult.labels['phishing'] ?? 0,
          classificationResult.labels['security alert'] ?? 0
        )

        db.prepare(
          `UPDATE messages SET
            ai_labels = ?,
            ai_spam_score = ?,
            ai_threat_score = ?,
            ai_sentiment = ?,
            ai_classified_at = ?
          WHERE id = ?`
        ).run(
          JSON.stringify(classificationResult.labels),
          spamScore,
          threatScore,
          classificationResult.sentiment ? JSON.stringify(classificationResult.sentiment) : null,
          Date.now(),
          messageId
        )
      }

      logger.info(`Classified message ${messageId}`)
    } catch (err) {
      logger.error(`Error classifying message ${messageId}:`, err)
    }
  }

  /**
   * Process the AI queue in batches with progress reporting
   */
  async processQueue(
    batchSize: number = 50,
    onProgress?: ProgressCallback
  ): Promise<void> {
    try {
      const db = storageService.db

      // Phase 1: Newsletter detection (pure header heuristics, fast)
      onProgress?.({ current: 0, total: 0, phase: 'Detecting newsletters' })

      // Respect batchSize; parse EML once per message via detectFromHeaders
      const newsletterMessages = db
        .prepare(
          `SELECT id FROM messages
          WHERE is_newsletter = 0 AND is_deleted = 0
          ORDER BY received_at DESC
          LIMIT ?`
        )
        .all(batchSize) as any[]

      let current = 0
      for (const row of newsletterMessages) {
        try {
          // detectFromHeaders parses EML once and returns null for non-newsletters
          const info = await subscriptionService.detectFromHeaders(row.id)
          if (info !== null) {
            db.prepare(
              `UPDATE messages SET is_newsletter = 1,
               newsletter_unsubscribe_url = ?
               WHERE id = ?`
            ).run(info.unsubscribeUrl ?? null, row.id)
          }
        } catch (err) {
          logger.error(`Error detecting newsletter for ${row.id}:`, err)
        }
        current++
        if (current % 50 === 0) {
          onProgress?.({ current, total: newsletterMessages.length, phase: 'Detecting newsletters' })
        }
      }

      // Phase 2: Get unclassified messages
      const unclassifiedMessages = db
        .prepare(
          `SELECT id FROM messages
          WHERE ai_classified_at IS NULL AND is_deleted = 0
          ORDER BY received_at DESC`
        )
        .all() as any[]

      const total = unclassifiedMessages.length
      logger.info(`ClassificationService: found ${total} unclassified messages`)

      // Phase 3: Classify in batches
      onProgress?.({ current: 0, total, phase: 'Classifying messages' })

      const defaultLabels = [
        'work',
        'personal',
        'newsletter',
        'billing',
        'spam',
        'promotional',
        'shipping',
        'travel',
        'security alert',
        'phishing',
        'social notification',
        'financial'
      ]

      for (let i = 0; i < unclassifiedMessages.length; i += batchSize) {
        const batch = unclassifiedMessages.slice(i, i + batchSize)

        await Promise.all(
          batch.map((msg) => this.classifyMessage(msg.id, defaultLabels))
        )

        const current = Math.min(i + batchSize, total)
        onProgress?.({ current, total, phase: 'Classifying messages' })
      }

      logger.info('ClassificationService: batch processing complete')
    } catch (err) {
      logger.error('Error processing classification queue:', err)
    }
  }

  /**
   * Enqueue messages for classification
   */
  enqueueMessages(messageIds: string[]): void {
    try {
      const db = storageService.db
      const insert = db.prepare(
        `INSERT OR IGNORE INTO ai_queue (message_id, task_type, priority, created_at)
        VALUES (?, ?, ?, ?)`
      )

      for (const messageId of messageIds) {
        insert.run(messageId, 'classify', 0, Date.now())
      }

      logger.info(`Enqueued ${messageIds.length} messages for classification`)
    } catch (err) {
      logger.error('Error enqueuing messages:', err)
    }
  }

  /**
   * Train spam classifier on user feedback
   */
  trainSpamClassifier(text: string, isSpam: boolean): void {
    this.spamTrainingData.push({ text, isSpam })
    logger.info(`Trained spam classifier: ${isSpam ? 'spam' : 'ham'}`)
  }

  /**
   * Get spam training data (for persistence if needed)
   */
  getSpamTrainingData(): Array<{ text: string; isSpam: boolean }> {
    return [...this.spamTrainingData]
  }
}

export const classificationService = new ClassificationService()
