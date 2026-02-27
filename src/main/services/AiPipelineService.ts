import { BrowserWindow } from 'electron'
import { classificationService, type ClassificationProgress } from './ClassificationService'
import { logger } from '../utils/logger'

class AiPipelineService {
  private enabled = false
  private processing = false
  private processingInterval: ReturnType<typeof setInterval> | null = null
  private batchSize = 50

  /**
   * Enable AI processing pipeline
   */
  enable(): void {
    if (this.enabled) {
      logger.info('AI pipeline already enabled')
      return
    }

    this.enabled = true
    logger.info('AI pipeline enabled')

    // Start background polling every 30 seconds
    if (!this.processingInterval) {
      this.processingInterval = setInterval(() => {
        this.processQueue().catch((err) => {
          logger.error('Error in background AI processing:', err)
        })
      }, 30000)
    }
  }

  /**
   * Disable AI processing pipeline
   */
  disable(): void {
    this.enabled = false

    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    logger.info('AI pipeline disabled')
  }

  /**
   * Check if pipeline is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Process the queue manually (for testing or immediate processing)
   */
  async processQueue(): Promise<void> {
    if (!this.enabled || this.processing) {
      return
    }

    this.processing = true

    try {
      await classificationService.processQueue(this.batchSize, (progress) => {
        this.broadcastProgress(progress)
      })
    } catch (err) {
      logger.error('Error processing AI queue:', err)
    } finally {
      this.processing = false
    }
  }

  /**
   * Enqueue new messages for processing
   */
  enqueueNewMessages(messageIds: string[]): void {
    if (!this.enabled) {
      return
    }

    classificationService.enqueueMessages(messageIds)
  }

  private broadcastProgress(progress: ClassificationProgress): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      try {
        win.webContents.send('ai:classification-progress', progress)
      } catch (err) {
        logger.warn('Failed to send progress to renderer:', err)
      }
    }
  }

  /**
   * Shutdown the pipeline
   */
  shutdown(): void {
    this.disable()
  }
}

export const aiPipelineService = new AiPipelineService()
