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

type PendingEntry = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

class AiWorkerPool {
  private classifierWorker: Worker | null = null
  private embedderWorker: Worker | null = null
  private llmWorker: Worker | null = null

  // Per-worker startup dedup: concurrent callers await the same promise
  private classifierStarting: Promise<void> | null = null
  private embedderStarting: Promise<void> | null = null
  private llmStarting: Promise<void> | null = null

  // Per-worker pending maps: errors on one worker don't cancel other workers' requests
  private classifierPending = new Map<string, PendingEntry>()
  private embedderPending = new Map<string, PendingEntry>()
  private llmPending = new Map<string, PendingEntry>()

  private requestIdCounter = 0

  async startClassifier(): Promise<void> {
    if (this.classifierWorker) return
    if (!this.classifierStarting) {
      this.classifierStarting = this._spawnWorker(
        path.join(__dirname, './workers/classifier.worker.js'),
        'Classifier',
        (w) => { this.classifierWorker = w },
        () => { this.classifierWorker = null },
        this.classifierPending
      ).finally(() => { this.classifierStarting = null })
    }
    return this.classifierStarting
  }

  async startEmbedder(): Promise<void> {
    if (this.embedderWorker) return
    if (!this.embedderStarting) {
      this.embedderStarting = this._spawnWorker(
        path.join(__dirname, './workers/embedder.worker.js'),
        'Embedder',
        (w) => { this.embedderWorker = w },
        () => { this.embedderWorker = null },
        this.embedderPending
      ).finally(() => { this.embedderStarting = null })
    }
    return this.embedderStarting
  }

  async startLlm(): Promise<void> {
    if (this.llmWorker) return
    if (!this.llmStarting) {
      this.llmStarting = this._spawnWorker(
        path.join(__dirname, './workers/llm.worker.js'),
        'LLM',
        (w) => { this.llmWorker = w },
        () => { this.llmWorker = null },
        this.llmPending
      ).finally(() => { this.llmStarting = null })
    }
    return this.llmStarting
  }

  async classify(text: string, labels: string[]): Promise<ClassificationResult> {
    if (!this.classifierWorker) await this.startClassifier()
    return this.sendRequest(
      this.classifierWorker!, this.classifierPending, 'classify', [text, labels]
    ) as Promise<ClassificationResult>
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.embedderWorker) await this.startEmbedder()
    const buffer = await this.sendRequest(
      this.embedderWorker!, this.embedderPending, 'embed', [text]
    )
    if (buffer instanceof ArrayBuffer) {
      return new Float32Array(buffer)
    }
    throw new Error('Invalid embedding response')
  }

  async loadLlm(modelPath: string): Promise<void> {
    if (!this.llmWorker) await this.startLlm()
    await this.sendRequest(this.llmWorker!, this.llmPending, 'load', [modelPath])
  }

  async generate(prompt: string, maxTokens: number = 512): Promise<string> {
    if (!this.llmWorker) await this.startLlm()
    const result = await this.sendRequest(
      this.llmWorker!, this.llmPending, 'generate', [prompt, maxTokens]
    )
    if (typeof result === 'string') return result
    throw new Error('Invalid LLM generation response')
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down AI worker pool')

    const promises: Promise<number>[] = []
    if (this.classifierWorker) promises.push(this.classifierWorker.terminate())
    if (this.embedderWorker) promises.push(this.embedderWorker.terminate())
    if (this.llmWorker) promises.push(this.llmWorker.terminate())
    await Promise.all(promises)

    this.classifierWorker = null
    this.embedderWorker = null
    this.llmWorker = null

    logger.info('AI worker pool shut down')
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async _spawnWorker(
    workerPath: string,
    label: string,
    onReady: (w: Worker) => void,
    onGone: () => void,
    pending: Map<string, PendingEntry>
  ): Promise<void> {
    try {
      const worker = new Worker(workerPath)

      worker.on('message', (response: WorkerResponse) => {
        this.handleResponse(pending, response)
      })

      worker.on('error', (err) => {
        logger.error(`${label} worker error:`, err)
        this.rejectPending(pending, err)
        onGone()
      })

      worker.on('exit', (code) => {
        logger.info(`${label} worker exited with code ${code}`)
        onGone()
      })

      onReady(worker)
      logger.info(`${label} worker started`)
    } catch (err) {
      logger.error(`Failed to start ${label} worker:`, err)
      throw err
    }
  }

  private sendRequest(
    worker: Worker,
    pending: Map<string, PendingEntry>,
    method: string,
    args: unknown[]
  ): Promise<unknown> {
    const requestId = String(this.requestIdCounter++)

    return new Promise((resolve, reject) => {
      // First request may need to download models (~100 MB), allow 5 minutes
      const timeoutMs = 300000
      const timeout = setTimeout(() => {
        pending.delete(requestId)
        reject(new Error(`Worker request ${method} timed out after ${timeoutMs / 1000}s`))
      }, timeoutMs)

      pending.set(requestId, { resolve, reject, timeout })

      const request: WorkerRequest = { requestId, method, args }

      try {
        worker.postMessage(request)
      } catch (err) {
        clearTimeout(timeout)
        pending.delete(requestId)
        reject(err)
      }
    })
  }

  private handleResponse(pending: Map<string, PendingEntry>, response: WorkerResponse): void {
    const { requestId, result, error } = response
    const entry = pending.get(requestId)
    if (!entry) {
      logger.warn(`Received response for unknown request: ${requestId}`)
      return
    }
    pending.delete(requestId)
    clearTimeout(entry.timeout)
    if (error) {
      entry.reject(new Error(error))
    } else {
      entry.resolve(result)
    }
  }

  private rejectPending(pending: Map<string, PendingEntry>, err: Error): void {
    for (const [, entry] of pending) {
      clearTimeout(entry.timeout)
      entry.reject(err)
    }
    pending.clear()
  }
}

export const aiWorkerPool = new AiWorkerPool()
