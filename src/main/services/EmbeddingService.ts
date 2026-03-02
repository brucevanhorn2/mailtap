import { aiWorkerPool } from './AiWorkerPool'
import { storageService } from './StorageService'
import { mailRepository } from './MailRepository'
import { emlStore } from './EmlStore'
import { searchService } from './SearchService'
import { settingsService } from './SettingsService'
import { simpleParser } from 'mailparser'
import { logger } from '../utils/logger'
import type { SearchResult } from '@shared/types'

export interface VectorSearchResult {
  messageId: string
  similarity: number
}

export interface HybridSearchResult extends SearchResult {
  similarity: number
}

class EmbeddingService {
  private configApplied = false

  private applyModelConfig(): void {
    if (this.configApplied) return
    const ai = settingsService.load().ai
    if (ai) {
      aiWorkerPool.setEmbedderConfig({
        embeddingModelId: ai.embeddingModelId,
        dtype: ai.modelDtype
      })
    }
    this.configApplied = true
  }

  /**
   * Generate and store embedding for a single message
   */
  async embedMessage(messageId: string): Promise<void> {
    try {
      this.applyModelConfig()
      const message = mailRepository.getMessage(messageId)
      if (!message) {
        logger.warn(`Message not found for embedding: ${messageId}`)
        return
      }

      // Get message text for embedding
      const emlBuffer = await emlStore.read(message.emlPath)
      const parsed = await simpleParser(emlBuffer)

      const text = `${message.subject}\n${message.fromName} ${message.fromEmail}\n${parsed.text ?? ''}`
        .slice(0, 512)

      // Generate embedding
      const embeddingBuffer = await aiWorkerPool.embed(text)
      const embedding = new Float32Array(embeddingBuffer)

      // Store in sqlite-vec
      const db = storageService.db
      db.prepare(
        `INSERT OR REPLACE INTO message_embeddings (message_id, embedding)
        VALUES (?, vec(?))`
      ).run(messageId, Buffer.from(embedding.buffer))

      logger.info(`Embedded message ${messageId}`)
    } catch (err) {
      logger.error(`Error embedding message ${messageId}:`, err)
    }
  }

  /**
   * Batch-embed unprocessed messages
   */
  async processQueue(
    batchSize: number = 50,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    try {
      const db = storageService.db

      // Find unembedded messages
      const unembedded = db
        .prepare(
          `SELECT id FROM messages
          WHERE id NOT IN (SELECT message_id FROM message_embeddings)
          AND is_deleted = 0
          ORDER BY received_at DESC`
        )
        .all() as any[]

      const total = unembedded.length
      logger.info(`EmbeddingService: found ${total} unembedded messages`)

      for (let i = 0; i < unembedded.length; i += batchSize) {
        const batch = unembedded.slice(i, i + batchSize)

        await Promise.all(batch.map((msg) => this.embedMessage(msg.id)))

        const current = Math.min(i + batchSize, total)
        onProgress?.(current, total)
      }

      logger.info('EmbeddingService: batch embedding complete')
    } catch (err) {
      logger.error('Error processing embedding queue:', err)
    }
  }

  /**
   * Vector similarity search
   */
  async searchSimilar(query: string, limit: number = 20): Promise<VectorSearchResult[]> {
    try {
      this.applyModelConfig()
      const db = storageService.db

      // Generate embedding for query
      const queryEmbeddingBuffer = await aiWorkerPool.embed(query)
      const queryEmbedding = new Float32Array(queryEmbeddingBuffer)

      // Search using sqlite-vec
      const results = db
        .prepare(
          `SELECT
            message_id,
            distance
          FROM message_embeddings
          WHERE embedding MATCH vec(?)
          ORDER BY distance ASC
          LIMIT ?`
        )
        .all(Buffer.from(queryEmbedding.buffer), limit) as any[]

      return results.map((row) => ({
        messageId: row.message_id,
        similarity: 1 - row.distance // Convert distance to similarity (1 - distance)
      }))
    } catch (err) {
      logger.error('Error performing vector search:', err)
      return []
    }
  }

  /**
   * Hybrid search: combine FTS5 keyword matches with vector similarity
   * Uses Reciprocal Rank Fusion (RRF) to combine rankings
   */
  async hybridSearch(query: string, limit: number = 20): Promise<HybridSearchResult[]> {
    try {
      // 1. Get FTS5 keyword results
      const searchQuery = {
        text: query,
        limit: limit * 2,
        offset: 0,
        accountId: undefined
      }

      const ftsResults = searchService.search(searchQuery)

      // 2. Get vector results
      const vecResults = await this.searchSimilar(query, limit * 2)

      // 3. Reciprocal Rank Fusion (RRF)
      const k = 60 // RRF constant
      const scoreMap = new Map<
        string,
        { ftsRank?: number; vecRank?: number; rrf: number; similarity: number }
      >()

      // Add FTS results
      ftsResults.results.forEach((r, idx) => {
        const messageId = r.message.id
        const ftsScore = 1 / (k + idx + 1)
        scoreMap.set(messageId, {
          ftsRank: idx,
          rrf: ftsScore,
          similarity: 0
        })
      })

      // Add vector results
      vecResults.forEach((r, idx) => {
        const existing = scoreMap.get(r.messageId) ?? { rrf: 0, similarity: r.similarity }
        existing.vecRank = idx
        existing.rrf += 1 / (k + idx + 1)
        existing.similarity = Math.max(existing.similarity, r.similarity)
        scoreMap.set(r.messageId, existing)
      })

      // 4. Sort by RRF score and take top results
      const ranked = Array.from(scoreMap.entries())
        .sort((a, b) => b[1].rrf - a[1].rrf)
        .slice(0, limit)

      // 5. Build results with message data and snippet
      const results: HybridSearchResult[] = []

      for (const [messageId, scores] of ranked) {
        const ftsResult = ftsResults.results.find((r) => r.message.id === messageId)
        if (ftsResult) {
          results.push({
            ...ftsResult,
            similarity: scores.similarity
          })
        }
      }

      return results
    } catch (err) {
      logger.error('Error performing hybrid search:', err)
      return []
    }
  }
}

export const embeddingService = new EmbeddingService()
