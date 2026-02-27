import { Worker } from 'worker_threads'
import * as path from 'path'
import { logger } from '../utils/logger'

export interface ClassificationResult {
  labels: Record<string, number>
  sentiment: { label: string; score: number } | null
}

interface WorkerRequest {
  requestId: string
  method: string
  args: unknown[]
}

interface WorkerResponse {
  requestId: string
  result?: unknown
  error?: string
}

class AiWorkerPool {
  private classifierWorker: Worker | null = null
  private embedderWorker: Worker | null = null
  private llmWorker: Worker | null = null

  private requestIdCounter = 0
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
      timeout: NodeJS.Timeout
    }
  >()

  async startClassifier(): Promise<void> {
    if (this.classifierWorker) {
      logger.info('Classifier worker already started')
      return
    }

    try {
      const workerPath = path.join(__dirname, '../workers/classifier.worker.js')
      this.classifierWorker = new Worker(workerPath)

      this.classifierWorker.on('message', (response: WorkerResponse) => {
        this.handleWorkerResponse(response)
      })

      this.classifierWorker.on('error', (err) => {
        logger.error('Classifier worker error:', err)
        this.rejectAllRequests(err)
        this.classifierWorker = null
      })

      this.classifierWorker.on('exit', (code) => {
        logger.info(`Classifier worker exited with code ${code}`)
        this.classifierWorker = null
      })

      logger.info('Classifier worker started')
    } catch (err) {
      logger.error('Failed to start classifier worker:', err)
      throw err
    }
  }

  async startEmbedder(): Promise<void> {
    if (this.embedderWorker) {
      logger.info('Embedder worker already started')
      return
    }

    try {
      const workerPath = path.join(__dirname, '../workers/embedder.worker.js')
      this.embedderWorker = new Worker(workerPath)

      this.embedderWorker.on('message', (response: WorkerResponse) => {
        this.handleWorkerResponse(response)
      })

      this.embedderWorker.on('error', (err) => {
        logger.error('Embedder worker error:', err)
        this.rejectAllRequests(err)
        this.embedderWorker = null
      })

      this.embedderWorker.on('exit', (code) => {
        logger.info(`Embedder worker exited with code ${code}`)
        this.embedderWorker = null
      })

      logger.info('Embedder worker started')
    } catch (err) {
      logger.error('Failed to start embedder worker:', err)
      throw err
    }
  }

  async classify(
    text: string,
    labels: string[]
  ): Promise<ClassificationResult> {
    if (!this.classifierWorker) {
      await this.startClassifier()
    }

    return this.sendWorkerRequest(this.classifierWorker!, 'classify', [
      text,
      labels
    ]) as Promise<ClassificationResult>
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.embedderWorker) {
      await this.startEmbedder()
    }

    const buffer = await this.sendWorkerRequest(this.embedderWorker!, 'embed', [
      text
    ])
    if (buffer instanceof ArrayBuffer) {
      return new Float32Array(buffer)
    }
    throw new Error('Invalid embedding response')
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down AI worker pool')

    const promises: Promise<number>[] = []

    if (this.classifierWorker) {
      promises.push(this.classifierWorker.terminate())
    }

    if (this.embedderWorker) {
      promises.push(this.embedderWorker.terminate())
    }

    if (this.llmWorker) {
      promises.push(this.llmWorker.terminate())
    }

    await Promise.all(promises)

    this.classifierWorker = null
    this.embedderWorker = null
    this.llmWorker = null

    logger.info('AI worker pool shut down')
  }

  private sendWorkerRequest(
    worker: Worker,
    method: string,
    args: unknown[]
  ): Promise<unknown> {
    const requestId = String(this.requestIdCounter++)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Worker request ${method} timed out after 30s`))
      }, 30000)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      const request: WorkerRequest = {
        requestId,
        method,
        args
      }

      try {
        worker.postMessage(request)
      } catch (err) {
        clearTimeout(timeout)
        this.pendingRequests.delete(requestId)
        reject(err)
      }
    })
  }

  private handleWorkerResponse(response: WorkerResponse): void {
    const { requestId, result, error } = response

    const pending = this.pendingRequests.get(requestId)
    if (!pending) {
      logger.warn(`Received response for unknown request: ${requestId}`)
      return
    }

    this.pendingRequests.delete(requestId)
    clearTimeout(pending.timeout)

    if (error) {
      pending.reject(new Error(error))
    } else {
      pending.resolve(result)
    }
  }

  private rejectAllRequests(err: Error): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(err)
    }
    this.pendingRequests.clear()
  }
}

export const aiWorkerPool = new AiWorkerPool()
