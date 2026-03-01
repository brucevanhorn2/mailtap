# Code Review Issues: PR #1 — AI Integration

Reviewed 2026-02-28. All issues confirmed against source files.

---

## CRITICAL

### C1. SQL Injection in Analytics Queries
**File:** `src/main/services/AiAnalyticsService.ts:59, 117–127`

Runtime values (`days`, `cutoffTime`, `msPerGranule`) are string-interpolated directly into SQL instead of using bound `?` parameters.

```typescript
// Line 59 — interpolated into SQL
${days ? `AND received_at > ${Date.now() - days * 24 * 60 * 60 * 1000}` : ''}
```

**Fix:** Use bound `?` parameters for all runtime values. For `msPerGranule`, allowlist the three valid integers before using in the query:

```typescript
const validGranules: Record<string, number> = {
  day: 86400000,
  week: 604800000,
  month: 2592000000
}
const ms = validGranules[granularity] ?? validGranules.day
const query = `
  SELECT (received_at / ?) * ? as timestamp, COUNT(*) as count
  FROM messages
  WHERE is_deleted = 0 AND received_at > ?
  ${accountId ? 'AND account_id = ?' : ''}
  GROUP BY timestamp ORDER BY timestamp ASC
`
const params = accountId ? [ms, ms, cutoffTime, accountId] : [ms, ms, cutoffTime]
```

---

### C2. Migration V2 Is Not Crash-Safe
**File:** `src/main/services/StorageService.ts:170–228`

All `ALTER TABLE ADD COLUMN` statements run in a single `db.exec()`. If the process crashes mid-migration, on restart the already-added columns cause `"duplicate column name"` errors. Since `schema_version` hasn't been bumped yet, this retries on every startup — permanently bricking the database.

**Fix:** Check `PRAGMA table_info(messages)` for each column before adding it:

```typescript
const existingColumns = (db.prepare("PRAGMA table_info(messages)").all() as {name: string}[])
  .map(r => r.name)

if (!existingColumns.includes('ai_labels')) {
  db.exec("ALTER TABLE messages ADD COLUMN ai_labels TEXT NOT NULL DEFAULT '{}'")
}
// repeat for each column
```

---

### C3. `SearchResult` Missing from `globals.d.ts` Imports
**File:** `src/renderer/src/globals.d.ts:85`

`SearchResult` is used in the `ai:hybrid-search` return type but is not listed in the `import type { ... }` block at the top of the file. Will cause a TypeScript compile error.

**Fix:** Add `SearchResult` to the import:

```typescript
import type {
  // ... existing imports ...
  SearchResult,   // add this
  // ...
} from '../../shared/types'
```

---

## HIGH

### H1. Race Condition: Concurrent Worker Startup Spawns Duplicates
**File:** `src/main/services/AiWorkerPool.ts` — all lazy-start methods

All three lazy-start patterns use `if (!this.worker) { await this.startWorker() }`. Two concurrent async callers both pass the null check before either completes, spawning duplicate workers. The first worker is orphaned and its pending requests leak until timeout.

**Fix:** Store an in-flight startup promise per worker type:

```typescript
private classifierStartPromise: Promise<void> | null = null

async startClassifier(): Promise<void> {
  if (this.classifierWorker) return
  if (!this.classifierStartPromise) {
    this.classifierStartPromise = this._doStartClassifier().finally(() => {
      this.classifierStartPromise = null
    })
  }
  return this.classifierStartPromise
}
```

Apply the same pattern for `startEmbedder()` and `startLlm()`.

---

### H2. Worker Error Rejects ALL Pending Requests Across ALL Workers
**File:** `src/main/services/AiWorkerPool.ts:51–55, 83–87, 113–117`

All three worker types share a single `pendingRequests` map. When one worker crashes and calls `rejectAllRequests()`, it also kills in-flight requests for healthy workers. Their eventual responses are silently discarded.

**Fix:** Use separate `pendingRequests` maps per worker (e.g., `classifierPending`, `embedderPending`, `llmPending`), or tag each entry with its worker type and only reject matching entries.

---

### H3. Dynamic `require('https')` Will Fail at Runtime
**File:** `src/main/services/SubscriptionService.ts:203–204`

```typescript
const httpModule = url.startsWith('https') ? require('https') : require('http')
```

The project uses `externalizeDepsPlugin()`. Dynamic `require()` of Node built-ins is unreliable under electron-vite bundling and will likely throw `Cannot find module` on first unsubscribe attempt.

**Fix:** Use static imports at file top:

```typescript
import * as https from 'https'
import * as http from 'http'
// ...
const httpModule = url.startsWith('https') ? https : http
```

---

### H4. `getThreadMessages` LIKE Wildcard Injection
**File:** `src/main/services/MailRepository.ts:358–367`

Email subjects containing `%` or `_` (e.g., "50% off") are valid SQLite LIKE wildcards and are not escaped before use. A subject like `"50% off"` will match far more rows than intended, corrupting thread grouping and RAG context.

**Fix:**

```typescript
const escaped = normalizedSubject.replace(/[%_\\]/g, '\\$&')
rows = this.db
  .prepare(`... LIKE ? ESCAPE '\\' ...`)
  .all(message.accountId, `%${escaped}%`)
```

---

## MEDIUM

### M1. Unvalidated `emlPath` — Path Traversal Risk
**Files:** `ClassificationService.ts:36`, `EmbeddingService.ts:32`, `RagService.ts:87,126`, `SubscriptionService.ts:23`

`emlPath` stored in SQLite is passed directly to `emlStore.read()` without verifying it falls within the mail directory. An adversarial IMAP server could store a path traversal value.

**Fix:** Add a guard in `emlStore.read()` or at each call site:

```typescript
const mailRoot = path.join(app.getPath('userData'), 'mail')
if (!path.resolve(emlPath).startsWith(mailRoot + path.sep)) {
  throw new Error(`Path traversal rejected: ${emlPath}`)
}
```

---

### M2. `AiModelManager` Concurrent Download/Delete Race
**File:** `src/main/services/AiModelManager.ts:65–66, 115–116, 132–133`

The module-level `MODELS` object is mutated in-place. Concurrent `downloadModel` and `deleteModel` calls for the same model ID can interleave and leave inconsistent state.

**Fix:** Add per-model in-flight guards:

```typescript
private inFlight = new Set<string>()

async downloadModel(modelId: string): Promise<string> {
  if (this.inFlight.has(modelId)) throw new Error('Download already in progress')
  this.inFlight.add(modelId)
  try { /* ... */ } finally { this.inFlight.delete(modelId) }
}
```

---

### M3. Newsletter Detection Reads EML Twice Per Message and Ignores `batchSize`
**File:** `src/main/services/ClassificationService.ts:86–115`

The newsletter phase always fetches up to 1,000 rows (ignoring the `batchSize` parameter), then calls both `isNewsletter()` and `detectFromHeaders()` per message — each independently parsing the same EML file with `simpleParser()`. At 1,000 messages this is ~2,000 EML parses in the main process.

**Fix:**
1. Apply `batchSize` to the SQL `LIMIT` clause.
2. Merge `isNewsletter()` and `detectFromHeaders()` into a single method that parses each EML once and returns both the boolean and the header data.

---

## Summary

| ID | Severity | File | Status |
|----|----------|------|--------|
| C1 | Critical | `AiAnalyticsService.ts` | ☐ Open |
| C2 | Critical | `StorageService.ts` | ☐ Open |
| C3 | Critical | `globals.d.ts` | ☐ Open |
| H1 | High | `AiWorkerPool.ts` | ☐ Open |
| H2 | High | `AiWorkerPool.ts` | ☐ Open |
| H3 | High | `SubscriptionService.ts` | ☐ Open |
| H4 | High | `MailRepository.ts` | ☐ Open |
| M1 | Medium | Multiple files | ☐ Open |
| M2 | Medium | `AiModelManager.ts` | ☐ Open |
| M3 | Medium | `ClassificationService.ts` | ☐ Open |
