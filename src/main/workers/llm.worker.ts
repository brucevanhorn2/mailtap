import { parentPort } from 'worker_threads'

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

// Lazy-load LLaMA to avoid loading if not needed
let completion: any = null

async function loadModel(modelPath: string) {
  if (completion) return

  try {
    const { getLlama, LlamaCompletion } = await import('node-llama-cpp')

    // Initialize llama.cpp binding
    const llama = await getLlama()

    // Load the GGUF model
    const model = await llama.loadModel({
      modelPath: modelPath,
      gpuLayers: 0 // CPU only for compatibility
    })

    // Create context for inference
    const context = await model.createContext()

    // Get a sequence from the context
    const sequence = context.getSequence()

    // Create completion handler
    completion = new LlamaCompletion({ contextSequence: sequence })

    console.log('[llm-worker] Model loaded:', modelPath)
  } catch (err) {
    console.error('[llm-worker] Failed to load model:', err)
    throw err
  }
}

async function generate(prompt: string, maxTokens: number = 512): Promise<string> {
  if (!completion) {
    throw new Error('Model not loaded. Call loadModel first.')
  }

  try {
    // Generate completion
    const response = await completion.generateCompletion(prompt, {
      maxTokens: maxTokens,
      topK: 40,
      topP: 0.9,
      temperature: 0.3
    })

    return response.trim()
  } catch (err) {
    console.error('[llm-worker] Generation error:', err)
    throw err
  }
}

if (parentPort) {
  parentPort.on('message', async (request: WorkerRequest) => {
    try {
      const { requestId, method, args } = request

      let result: unknown

      switch (method) {
        case 'load': {
          const [modelPath] = args as [string]
          await loadModel(modelPath)
          result = { loaded: true }
          break
        }

        case 'generate': {
          const [prompt, maxTokens] = args as [string, number]
          result = await generate(prompt, maxTokens || 512)
          break
        }

        default:
          throw new Error(`Unknown method: ${method}`)
      }

      const response: WorkerResponse = {
        requestId,
        result
      }

      parentPort!.postMessage(response)
    } catch (err) {
      const response: WorkerResponse = {
        requestId: (request as WorkerRequest).requestId,
        error: String(err)
      }

      parentPort!.postMessage(response)
    }
  })
}
