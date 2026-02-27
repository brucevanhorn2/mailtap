import { ipcMain } from 'electron'
import { aiModelManager } from '../services/AiModelManager'
import { subscriptionService } from '../services/SubscriptionService'
import { classificationService } from '../services/ClassificationService'
import { aiPipelineService } from '../services/AiPipelineService'
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
