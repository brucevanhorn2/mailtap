import { aiWorkerPool } from './AiWorkerPool'
import { embeddingService } from './EmbeddingService'
import { mailRepository } from './MailRepository'
import { emlStore } from './EmlStore'
import { simpleParser } from 'mailparser'
import { logger } from '../utils/logger'
import type { SearchResult } from '@shared/types'

export interface RagResult {
  answer: string
  sources: SearchResult[]
}

export interface ThreadSummary {
  summary: string
  participants: string[]
  messageCount: number
}

class RagService {
  private llmModelPath: string | null = null

  /**
   * Set the LLM model path and load it into the worker
   */
  async initLlm(modelPath: string): Promise<void> {
    try {
      this.llmModelPath = modelPath
      await aiWorkerPool.loadLlm(modelPath)
      logger.info(`RagService: LLM loaded from ${modelPath}`)
    } catch (err) {
      logger.error('RagService: failed to load LLM:', err)
      throw err
    }
  }

  /**
   * Full RAG pipeline: retrieve relevant emails and generate answer with sources
   */
  async query(question: string, limit: number = 5): Promise<RagResult> {
    if (!this.llmModelPath) {
      throw new Error('LLM not initialized. Call initLlm() first.')
    }

    try {
      // 1. Retrieve relevant emails using hybrid search
      const sources = await embeddingService.hybridSearch(question, limit * 2)
      const topSources = sources.slice(0, limit)

      // 2. Build context from retrieved emails
      const context = this.buildContext(topSources)

      // 3. Prompt engineering
      const prompt = this.buildPrompt(question, context)

      // 4. Generate answer with LLM
      const answer = await aiWorkerPool.generate(prompt, 1024)

      logger.info(`RagService: answered question in ${topSources.length} sources`)

      return {
        answer: answer.trim(),
        sources: topSources
      }
    } catch (err) {
      logger.error('RagService: query failed:', err)
      throw err
    }
  }

  /**
   * Summarize a single message
   */
  async summarizeMessage(messageId: string): Promise<string> {
    if (!this.llmModelPath) {
      throw new Error('LLM not initialized. Call initLlm() first.')
    }

    try {
      const message = mailRepository.getMessage(messageId)
      if (!message) {
        throw new Error(`Message ${messageId} not found`)
      }

      // Get full message text
      const emlBuffer = await emlStore.read(message.emlPath)
      const parsed = await simpleParser(emlBuffer)
      const text = `Subject: ${message.subject}\n\n${parsed.text ?? ''}`
        .slice(0, 2000)

      // Generate summary
      const prompt = `Please provide a concise 2-3 sentence summary of the following email:\n\n${text}\n\nSummary:`
      const summary = await aiWorkerPool.generate(prompt, 256)

      logger.info(`RagService: summarized message ${messageId}`)
      return summary.trim()
    } catch (err) {
      logger.error(`RagService: failed to summarize message ${messageId}:`, err)
      throw err
    }
  }

  /**
   * Summarize an email thread (messages with same threadId or related message IDs)
   */
  async summarizeThread(messageId: string): Promise<ThreadSummary> {
    if (!this.llmModelPath) {
      throw new Error('LLM not initialized. Call initLlm() first.')
    }

    try {
      const message = mailRepository.getMessage(messageId)
      if (!message) {
        throw new Error(`Message ${messageId} not found`)
      }

      // Collect related messages (simple approach: same subject/sender or threadId)
      const threadMessages = mailRepository.getThreadMessages(messageId)
      const participants = new Set<string>()

      let combinedText = ''
      for (const msg of threadMessages) {
        participants.add(`${msg.fromName} <${msg.fromEmail}>`)

        try {
          const emlBuffer = await emlStore.read(msg.emlPath)
          const parsed = await simpleParser(emlBuffer)
          combinedText += `From: ${msg.fromName} <${msg.fromEmail}>\nDate: ${new Date(msg.receivedAt).toLocaleString()}\n${parsed.text ?? ''}\n\n---\n\n`
        } catch (err) {
          logger.warn(`Failed to read message ${msg.id} for thread summary:`, err)
        }
      }

      // Truncate for token budget
      combinedText = combinedText.slice(0, 4000)

      // Generate summary
      const prompt = `Please provide a concise summary (3-5 sentences) of the following email thread:\n\n${combinedText}\n\nSummary:`
      const summary = await aiWorkerPool.generate(prompt, 256)

      return {
        summary: summary.trim(),
        participants: Array.from(participants),
        messageCount: threadMessages.length
      }
    } catch (err) {
      logger.error(`RagService: failed to summarize thread for ${messageId}:`, err)
      throw err
    }
  }

  private buildContext(sources: SearchResult[]): string {
    let context = ''
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i]
      context += `[${i + 1}] From: ${src.message.fromName} <${src.message.fromEmail}>\n`
      context += `    Date: ${new Date(src.message.receivedAt).toLocaleString()}\n`
      context += `    Subject: ${src.message.subject}\n`
      context += `    Preview: ${src.snippet?.slice(0, 200) || '(no preview)'}\n\n`
    }
    return context
  }

  private buildPrompt(question: string, context: string): string {
    return `You are a helpful email assistant. Based on the following email context, answer the user's question. Be concise and cite sources by number when relevant.

Context:
${context}

Question: ${question}

Answer:`
  }
}

export const ragService = new RagService()
