import { ipcMain } from 'electron'
import { aiModelManager } from '../services/AiModelManager'
import { subscriptionService } from '../services/SubscriptionService'
import { classificationService } from '../services/ClassificationService'
import { aiPipelineService } from '../services/AiPipelineService'
import { aiAnalyticsService } from '../services/AiAnalyticsService'
import { embeddingService } from '../services/EmbeddingService'
import { ragService } from '../services/RagService'
import { settingsService } from '../services/SettingsService'
import type { IpcResult, AiSettings } from '@shared/types'
import { logger } from '../utils/logger'

export function registerAiIpc(): void {
  // ─── Model Management ───────────────────────────────────────────────────────

  ipcMain.handle('ai:list-models', async () => {
    try {
      return aiModelManager.listModels()
    } catch (err) {
      logger.error('Error listing models:', err)
      return []
    }
  })

  ipcMain.handle('ai:download-model', async (_event, modelId: string) => {
    try {
      const modelPath = await aiModelManager.downloadModel(modelId)

      return {
        success: true,
        data: { modelPath }
      } as IpcResult<{ modelPath: string }>
    } catch (err) {
      logger.error(`Error downloading model ${modelId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:delete-model', async (_event, modelId: string) => {
    try {
      await aiModelManager.deleteModel(modelId)
      return { success: true } as IpcResult
    } catch (err) {
      logger.error(`Error deleting model ${modelId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  ipcMain.handle('ai:list-subscriptions', async () => {
    try {
      return subscriptionService.listSubscriptions()
    } catch (err) {
      logger.error('Error listing subscriptions:', err)
      return []
    }
  })

  ipcMain.handle('ai:mute-subscription', async (_event, subscriptionId: string) => {
    try {
      subscriptionService.muteSubscription(subscriptionId)
      return { success: true } as IpcResult
    } catch (err) {
      logger.error(`Error muting subscription ${subscriptionId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:unmute-subscription', async (_event, subscriptionId: string) => {
    try {
      subscriptionService.unmuteSubscription(subscriptionId)
      return { success: true } as IpcResult
    } catch (err) {
      logger.error(`Error unmuting subscription ${subscriptionId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:unsubscribe', async (_event, subscriptionId: string) => {
    try {
      const result = await subscriptionService.unsubscribe(subscriptionId)
      return { success: result.success, error: result.error } as IpcResult
    } catch (err) {
      logger.error(`Error unsubscribing from ${subscriptionId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  // ─── Classification ─────────────────────────────────────────────────────

  ipcMain.handle('ai:classify-message', async (_event, messageId: string) => {
    try {
      const labels = settingsService.load().ai?.customLabels || []
      await classificationService.classifyMessage(messageId, labels)
      return { success: true } as IpcResult
    } catch (err) {
      logger.error(`Error classifying message ${messageId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:classify-batch', async () => {
    try {
      await aiPipelineService.processQueue()
      return { success: true } as IpcResult
    } catch (err) {
      logger.error('Error processing classification batch:', err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  // ─── Embeddings & Search ────────────────────────────────────────────────

  ipcMain.handle('ai:embed-message', async (_event, messageId: string) => {
    try {
      await embeddingService.embedMessage(messageId)
      return { success: true } as IpcResult
    } catch (err) {
      logger.error(`Error embedding message ${messageId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:search-similar', async (_event, query: string, limit: number = 20) => {
    try {
      return await embeddingService.searchSimilar(query, limit)
    } catch (err) {
      logger.error('Error searching similar:', err)
      return []
    }
  })

  ipcMain.handle('ai:hybrid-search', async (_event, query: string, limit: number = 20) => {
    try {
      return await embeddingService.hybridSearch(query, limit)
    } catch (err) {
      logger.error('Error performing hybrid search:', err)
      return []
    }
  })

  // ─── Analytics ──────────────────────────────────────────────────────────

  ipcMain.handle(
    'ai:analytics-classification',
    async (_event, accountId?: string, days?: number) => {
      try {
        return aiAnalyticsService.getClassificationBreakdown(accountId, days)
      } catch (err) {
        logger.error('Error getting classification analytics:', err)
        return []
      }
    }
  )

  ipcMain.handle(
    'ai:analytics-volume',
    async (
      _event,
      accountId?: string,
      granularity?: 'day' | 'week' | 'month',
      range?: number
    ) => {
      try {
        return aiAnalyticsService.getVolumeTimeSeries(
          accountId,
          granularity ?? 'day',
          range ?? 30
        )
      } catch (err) {
        logger.error('Error getting volume analytics:', err)
        return []
      }
    }
  )

  ipcMain.handle('ai:analytics-senders', async (_event, limit: number) => {
    try {
      return aiAnalyticsService.getTopSenders(limit)
    } catch (err) {
      logger.error('Error getting top senders:', err)
      return []
    }
  })

  ipcMain.handle('ai:analytics-threats', async (_event, days: number) => {
    try {
      return aiAnalyticsService.getThreatSummary(days)
    } catch (err) {
      logger.error('Error getting threat summary:', err)
      return {
        totalThreats: 0,
        highRisk: 0,
        mediumRisk: 0,
        details: []
      }
    }
  })

  ipcMain.handle('ai:analytics-sentiment', async (_event, accountId?: string) => {
    try {
      return aiAnalyticsService.getSentimentBreakdown(accountId)
    } catch (err) {
      logger.error('Error getting sentiment analytics:', err)
      return []
    }
  })

  // ─── Settings ───────────────────────────────────────────────────────────────

  ipcMain.handle('ai:get-settings', async () => {
    try {
      const settings = settingsService.load()
      return settings.ai || getDefaultAiSettings()
    } catch (err) {
      logger.error('Error getting AI settings:', err)
      return getDefaultAiSettings()
    }
  })

  ipcMain.handle('ai:save-settings', async (_event, aiSettings: AiSettings) => {
    try {
      const settings = settingsService.load()
      settings.ai = aiSettings
      settingsService.save(settings)
      return { success: true } as IpcResult
    } catch (err) {
      logger.error('Error saving AI settings:', err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:enable', async (_event, enabled: boolean) => {
    try {
      const settings = settingsService.load()
      const aiSettings = settings.ai || getDefaultAiSettings()
      aiSettings.enabled = enabled
      settings.ai = aiSettings
      settingsService.save(settings)

      // Start/stop the pipeline based on enabled state
      if (enabled) {
        aiPipelineService.enable()
      } else {
        aiPipelineService.disable()
      }

      return { success: true } as IpcResult
    } catch (err) {
      logger.error('Error enabling/disabling AI:', err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  // ─── RAG ────────────────────────────────────────────────────────────────

  ipcMain.handle('ai:init-llm', async (_event, modelPath: string) => {
    try {
      await ragService.initLlm(modelPath)
      return { success: true } as IpcResult
    } catch (err) {
      logger.error('Error initializing LLM:', err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:ask', async (_event, question: string, limit?: number) => {
    try {
      const result = await ragService.query(question, limit)
      return { success: true, data: result } as unknown as IpcResult
    } catch (err) {
      logger.error('Error performing RAG query:', err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:summarize-message', async (_event, messageId: string) => {
    try {
      const summary = await ragService.summarizeMessage(messageId)
      return { success: true, data: { summary } } as unknown as IpcResult
    } catch (err) {
      logger.error(`Error summarizing message ${messageId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })

  ipcMain.handle('ai:summarize-thread', async (_event, messageId: string) => {
    try {
      const threadSummary = await ragService.summarizeThread(messageId)
      return { success: true, data: threadSummary } as unknown as IpcResult
    } catch (err) {
      logger.error(`Error summarizing thread for ${messageId}:`, err)
      return {
        success: false,
        error: String(err)
      } as IpcResult
    }
  })
}

function getDefaultAiSettings(): AiSettings {
  return {
    enabled: false,
    autoClassify: true,
    autoEmbed: true,
    spamThreshold: 0.7,
    threatThreshold: 0.5,
    customLabels: [
      'potential client',
      'legal document',
      'personal',
      'work'
    ],
    llmEnabled: false,
    llmModelId: null
  }
}
