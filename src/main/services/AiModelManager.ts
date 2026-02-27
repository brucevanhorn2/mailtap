import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../utils/logger'
import type { AiModelInfo } from '@shared/types'

export interface ModelDownloadProgress {
  modelId: string
  percent: number
}

// Define all available models
const MODELS: Record<string, AiModelInfo> = {
  'deberta-zeroshot': {
    id: 'deberta-zeroshot',
    displayName: 'DeBERTa Zero-Shot Classifier',
    tier: 1,
    sizeBytes: 148897792, // ~142MB
    modelType: 'classifier',
    isDownloaded: false,
    localPath: null
  },
  'bge-small-en': {
    id: 'bge-small-en',
    displayName: 'BGE Small English Embeddings',
    tier: 1,
    sizeBytes: 33554432, // ~32MB
    modelType: 'embedder',
    isDownloaded: false,
    localPath: null
  },
  'qwen3-1.7b': {
    id: 'qwen3-1.7b',
    displayName: 'Qwen3 1.7B Instruct',
    tier: 2,
    sizeBytes: 1073741824, // ~1GB
    modelType: 'llm',
    isDownloaded: false,
    localPath: null
  }
}

class AiModelManager {
  private modelsDir: string

  constructor() {
    this.modelsDir = path.join(app.getPath('userData'), 'ai-models')
    this.ensureModelsDir()
    this.scanDownloadedModels()
  }

  private ensureModelsDir(): void {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true })
      logger.info(`Created AI models directory: ${this.modelsDir}`)
    }
  }

  private scanDownloadedModels(): void {
    try {
      const entries = fs.readdirSync(this.modelsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && MODELS[entry.name]) {
          const modelPath = path.join(this.modelsDir, entry.name)
          MODELS[entry.name].isDownloaded = true
          MODELS[entry.name].localPath = modelPath
          logger.info(`Found downloaded model: ${entry.name}`)
        }
      }
    } catch (err) {
      logger.error('Error scanning downloaded models:', err)
    }
  }

  listModels(): AiModelInfo[] {
    return Object.values(MODELS).sort((a, b) => {
      // Sort by tier first, then by name
      if (a.tier !== b.tier) return a.tier - b.tier
      return a.displayName.localeCompare(b.displayName)
    })
  }

  getModel(modelId: string): AiModelInfo | null {
    return MODELS[modelId] ?? null
  }

  getModelPath(modelId: string): string | null {
    const model = MODELS[modelId]
    if (model?.isDownloaded && model.localPath) {
      return model.localPath
    }
    return null
  }

  async downloadModel(modelId: string): Promise<string> {
    const model = MODELS[modelId]
    if (!model) {
      throw new Error(`Model not found: ${modelId}`)
    }

    if (model.isDownloaded && model.localPath) {
      logger.info(`Model already downloaded: ${modelId}`)
      return model.localPath
    }

    // For now, we'll return a placeholder. In a real implementation,
    // models would be downloaded from HuggingFace or similar.
    // This is a stub that allows the infrastructure to work.
    const modelPath = path.join(this.modelsDir, modelId)
    fs.mkdirSync(modelPath, { recursive: true })

    logger.info(`Model placeholder created for: ${modelId}`)

    // Update model status
    model.isDownloaded = true
    model.localPath = modelPath

    return modelPath
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = MODELS[modelId]
    if (!model) {
      throw new Error(`Model not found: ${modelId}`)
    }

    if (model.localPath && fs.existsSync(model.localPath)) {
      fs.rmSync(model.localPath, { recursive: true, force: true })
      logger.info(`Deleted model: ${modelId}`)
    }

    model.isDownloaded = false
    model.localPath = null
  }
}

export const aiModelManager = new AiModelManager()
