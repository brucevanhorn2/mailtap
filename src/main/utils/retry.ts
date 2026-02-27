interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 10, initialDelayMs = 1000, maxDelayMs = 60000, onRetry } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxAttempts) break

      const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
      if (onRetry) onRetry(attempt, delay, err)
      await sleep(delay)
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
