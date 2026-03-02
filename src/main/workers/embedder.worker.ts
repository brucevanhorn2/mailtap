import { parentPort, workerData } from 'worker_threads'

type DType = 'q4' | 'q8' | 'fp16' | 'fp32' | 'auto' | 'int8' | 'uint8' | 'bnb4' | 'q4f16'

const embeddingModelId: string = workerData?.embeddingModelId ?? 'Xenova/bge-small-en-v1.5'
const dtype = (workerData?.dtype ?? 'q8') as DType

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

// Lazy-load Transformers.js to avoid loading it if not needed
let embedding: any = null

async function loadEmbedder() {
  if (embedding) return

  try {
    const { pipeline } = await import('@huggingface/transformers')
    embedding = await pipeline('feature-extraction', embeddingModelId, { dtype })
    console.log(`[embedder-worker] Embedding model loaded: ${embeddingModelId} (dtype: ${dtype})`)
  } catch (err) {
    console.error('[embedder-worker] Failed to load model:', err)
    throw err
  }
}

async function embedText(text: string): Promise<ArrayBuffer> {
  if (!embedding) {
    await loadEmbedder()
  }

  try {
    // Generate embedding for the text
    const result = await embedding(text, {
      pooling: 'mean',
      normalize: true
    })

    // result is a Tensor, convert to Float32Array
    const data = new Float32Array(await result.data())

    // Return as ArrayBuffer for transfer
    return data.buffer
  } catch (err) {
    console.error('[embedder-worker] Embedding error:', err)
    throw err
  }
}

if (parentPort) {
  parentPort.on('message', async (request: WorkerRequest) => {
    try {
      const { requestId, method, args } = request

      let result: unknown

      switch (method) {
        case 'embed': {
          const [text] = args as [string]
          result = await embedText(text)
          break
        }

        default:
          throw new Error(`Unknown method: ${method}`)
      }

      const response: WorkerResponse = {
        requestId,
        result
      }

      // Transfer ArrayBuffer if present
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
