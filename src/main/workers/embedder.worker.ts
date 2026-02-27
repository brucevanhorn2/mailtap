import { parentPort } from 'worker_threads'

// Note: In Phase 4, this is a stub that returns mock data.
// In a real implementation, this would load Transformers.js and the BGE-small model.
// For now, we'll return a 384-dimensional vector with mock data.

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

if (parentPort) {
  parentPort.on('message', async (request: WorkerRequest) => {
    try {
      const { requestId, method, args } = request

      let result: unknown

      switch (method) {
        case 'embed': {
          const [_text] = args as [string]
          // Mock implementation: return a 384-dimensional vector with random values
          const embedding = new Float32Array(384)
          for (let i = 0; i < 384; i++) {
            embedding[i] = Math.random() - 0.5
          }
          // Normalize
          let norm = 0
          for (let i = 0; i < 384; i++) {
            norm += embedding[i] * embedding[i]
          }
          norm = Math.sqrt(norm)
          for (let i = 0; i < 384; i++) {
            embedding[i] = embedding[i] / norm
          }

          // Convert to ArrayBuffer for transfer
          result = embedding.buffer
          break
        }

        default:
          throw new Error(`Unknown method: ${method}`)
      }

      const response: WorkerResponse = {
        requestId,
        result
      }

      parentPort!.postMessage(response, result instanceof ArrayBuffer ? [result] : [])
    } catch (err) {
      const response: WorkerResponse = {
        requestId: (request as WorkerRequest).requestId,
        error: String(err)
      }

      parentPort!.postMessage(response)
    }
  })
}
