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

// Lazy-loaded pipelines
let classifier: any = null
let sentimentAnalyzer: any = null

async function loadClassifier() {
  if (classifier) return

  try {
    const { pipeline } = await import('@huggingface/transformers')
    classifier = await pipeline(
      'zero-shot-classification',
      'Xenova/mobilebert-uncased-mnli',
      { dtype: 'q8' }
    )
    console.log('[classifier-worker] MobileBERT-MNLI model loaded (zero-shot classification)')
  } catch (err) {
    console.error('[classifier-worker] Failed to load classifier model:', err)
    throw err
  }
}

async function loadSentiment() {
  if (sentimentAnalyzer) return

  try {
    const { pipeline } = await import('@huggingface/transformers')
    sentimentAnalyzer = await pipeline(
      'sentiment-analysis',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
      { dtype: 'q8' }
    )
    console.log('[classifier-worker] DistilBERT-SST2 model loaded (sentiment analysis)')
  } catch (err) {
    console.error('[classifier-worker] Failed to load sentiment model:', err)
    throw err
  }
}

async function classifyText(
  text: string,
  labels: string[]
): Promise<{ labels: Record<string, number>; sentiment: { label: string; score: number } | null }> {
  // Load models on first use
  await loadClassifier()
  await loadSentiment()

  // Run zero-shot classification
  const classResult = await classifier(text, labels, { multi_label: true })

  // Build label->score map
  const labelScores: Record<string, number> = {}
  for (let i = 0; i < classResult.labels.length; i++) {
    labelScores[classResult.labels[i]] = classResult.scores[i]
  }

  // Run sentiment analysis
  let sentiment: { label: string; score: number } | null = null
  try {
    const sentResult = await sentimentAnalyzer(text)
    if (sentResult && sentResult.length > 0) {
      sentiment = {
        label: sentResult[0].label.toLowerCase(),
        score: sentResult[0].score
      }
    }
  } catch (err) {
    console.error('[classifier-worker] Sentiment analysis error:', err)
  }

  return { labels: labelScores, sentiment }
}

if (parentPort) {
  parentPort.on('message', async (request: WorkerRequest) => {
    try {
      const { requestId, method, args } = request

      let result: unknown

      switch (method) {
        case 'classify': {
          const [text, labels] = args as [string, string[]]
          result = await classifyText(text, labels)
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
