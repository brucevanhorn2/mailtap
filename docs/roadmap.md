# MailTap AI Integration Roadmap

## Overview

This document covers the research, technology choices, architecture, and phased implementation plan for adding local AI capabilities to MailTap. All inference runs on-device — no cloud APIs. Every technology listed is **MIT or Apache 2.0 licensed** unless otherwise noted.

---

## Current Data Model

The SQLite schema stores per-message: subject, from, to, cc, date, flags, attachment metadata, and FTS5 indexes on subject/from/to/body/attachment names. Raw `.eml` files on disk are the source of truth and contain everything else — full HTML body, all headers (`List-Unsubscribe`, `DKIM-Signature`, `Authentication-Results`, `X-Mailer`, etc.), and attachment binaries. EML files can be re-parsed on demand via `mailparser`.

---

## Inference Runtimes

Two runtimes cover all use cases:

| Runtime | License | Best For | Notes |
|---------|---------|----------|-------|
| **Transformers.js** v3+ | Apache 2.0 | Small models (classification, embeddings, sentiment) | One-line pipeline API, ONNX backend, runs in Node.js main process |
| **node-llama-cpp** v3 | MIT | LLMs (summarization, RAG Q&A) | Native llama.cpp bindings, auto-detects CUDA/Metal, GGUF format |

Transformers.js handles the small specialist models; node-llama-cpp handles the generative LLM.

---

## Recommended Model Stack

### Tier 1: Ships by Default (~175MB model downloads)

| Purpose | Technology | Params | Size | License |
|---------|-----------|--------|------|---------|
| **Spam** | `wink-naive-bayes-text-classifier` | N/A (pure JS) | ~0MB | MIT |
| **Classification** | `MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33` | 22M | 142MB | MIT |
| **Sentiment** | `Cohee/distilbert-base-uncased-go-emotions-onnx` | 66M | ~250MB | Apache 2.0 |
| **Embeddings** | `BAAI/bge-small-en-v1.5` | 33M | 32MB (int8) | MIT |
| **Vector store** | `sqlite-vec` | N/A | ~2MB native | MIT/Apache 2.0 |
| **Newsletter detection** | Header heuristics (no model) | N/A | 0MB | N/A |

### Tier 2: User-Downloaded LLM (~1-2GB)

| Model | Params | Quantized Size | License | Strengths |
|-------|--------|---------------|---------|-----------|
| **Qwen3-1.7B-Instruct** (recommended default) | 1.7B | ~1GB | Apache 2.0 | Best quality/size ratio, performs like Qwen2.5-3B, 32K context |
| Phi-3.5-mini-instruct (high quality option) | 3.8B | ~2.2GB | MIT | 128K context, excellent instruction following |
| Qwen3-0.6B-Instruct (lightweight option) | 0.6B | ~400MB | Apache 2.0 | Performs like Qwen2.5-1.5B, dual-mode thinking |
| SmolLM2-1.7B-Instruct | 1.7B | ~1GB | Apache 2.0 | Outperforms Llama-3.2-1B, 8K context |

### Models Evaluated but Not Recommended

| Model | License | Reason to Avoid |
|-------|---------|-----------------|
| Gemma-2-2B | Gemma License (custom) | Remote enforcement clause, redistribution requirements |
| Qwen2.5-3B | Qwen Research License | Not Apache 2.0, restrictive terms |
| spamscanner | Business Source License 1.1 | Not open source for production use |
| cardiffnlp/twitter-roberta-base-sentiment | CC-BY-4.0 | Attribution requirements, legal ambiguity for model weights |

---

## Feature-by-Feature Design

### 1. Spam Detection

**Two-layer approach:**

- **Layer 1 -- Bayesian classifier** (`wink-naive-bayes-text-classifier`, MIT): Trains on the user's own data. User marks messages as spam, the classifier learns over time. Serializes to JSON, stored alongside SQLite. Instant inference, zero model download.

- **Layer 2 -- Tiny transformer** (`mrm8488/bert-tiny-finetuned-sms-spam-detection`, Apache 2.0, 4.39M params): Pre-trained spam detector as a second opinion. Runs through Transformers.js in milliseconds.

- **Layer 3 -- Whitelist heuristic**: If the sender isn't in any contact/previous-correspondence list, boost spam score. Pure logic, no ML.

### 2. Multi-Dimensional Classification

**Zero-shot NLI** is the core approach. The DeBERTa-xsmall model (22M params, MIT) takes email text + arbitrary labels and scores each one. No fine-tuning needed, and labels can be changed anytime.

Example labels:
```
["commercial/sales", "personal", "legal document", "financial",
 "recruitment/job offer", "security alert", "social notification", "noise"]
```

Users can add custom labels in settings (e.g., "potential client", "project update"). The model handles any English label phrase.

**For emotional tone / life moments**, the same model works with labels like:
```
["happy announcement", "angry complaint", "sad news", "celebration",
 "legal proceeding", "career milestone", "family event"]
```

Or use the dedicated GoEmotions model for 28 fine-grained emotions: admiration, anger, caring, curiosity, disappointment, excitement, fear, gratitude, grief, joy, love, sadness, surprise, and more.

### 3. Security / Phishing Detection

**Composite scoring system** built from parts (no single model):

| Signal | Method | Weight |
|--------|--------|--------|
| SPF/DKIM/DMARC failures | Parse `Authentication-Results` header | High |
| From/Reply-To mismatch | Header comparison | Medium |
| Suspicious URLs (IP-based, homoglyphs, punycode) | URL regex analysis | High |
| Dangerous attachment types (.exe, .scr, .js, .vbs) | Extension check | High |
| Double extensions (document.pdf.exe) | Filename regex | High |
| Zero-shot: "phishing attempt" / "credential harvesting" | DeBERTa model | Medium |
| Excessive urgency language | DeBERTa with urgency labels | Low |

All of this is either pure logic or reuses the zero-shot model already loaded for classification.

### 4. Analytics

Mostly SQL aggregates on AI columns -- no new models needed:

- **Volume stats**: `COUNT(*) GROUP BY date/month/year` (already queryable)
- **Classification breakdowns**: `GROUP BY` on AI label columns -> pie charts
- **Trends over time**: `COUNT(*) GROUP BY date, label` -> line charts
- **Threat monitoring**: `WHERE ai_threat_score > threshold GROUP BY week`
- **Top senders**: `GROUP BY from_email ORDER BY count DESC`
- **Sentiment distribution**: `GROUP BY ai_sentiment` -> bar charts

Use Ant Design's built-in chart components or a lightweight lib like `@ant-design/charts`.

### 5. Subscription Detection & Auto-Unsubscribe

**Detection** (no model, pure header analysis):

- `List-Unsubscribe` header -> extract `mailto:` and `https:` URLs
- `List-Id` header -> identifies the mailing list
- `Precedence: bulk` + known ESPs (`X-Mailer` matching Mailchimp, SendGrid, etc.)
- `From:` containing `noreply@`, `newsletter@`, `updates@`

**Auto-unsubscribe**: RFC 8058 defines `List-Unsubscribe-Post: List-Unsubscribe=One-Click` -- a single HTTP POST to the unsubscribe URL. This is what Gmail uses internally. For newsletters that support it, MailTap can unsubscribe with one POST request. For others, offer to open the unsubscribe link in the default browser.

### 6. RAG Q&A ("Ask Your Mailbox")

**Pipeline: Embed -> Store -> Retrieve -> Generate**

1. **Embed**: Each message gets a 384-dim vector from `bge-small-en-v1.5` (concatenate subject + from + body text, truncated to ~512 tokens).
2. **Store**: Vectors go in `sqlite-vec` -- a loadable SQLite extension that adds a `vec0` virtual table. Loads directly into the existing better-sqlite3 database. No separate vector DB process.
3. **Retrieve**: When the user asks a question, embed the question -> query `sqlite-vec` for top-K similar messages. Combine with FTS5 keyword results using Reciprocal Rank Fusion (RRF) for hybrid search.
4. **Generate**: Feed retrieved messages as context to Qwen3-1.7B via node-llama-cpp with a RAG prompt template.

The `sqlite-vec` integration is elegant: `sqliteVec.load(db)` adds vector support to the same DB file, same process, same WAL mode. FTS5 keyword search and vector semantic search live side by side.

---

## Architecture Design

### Schema Migration (v2)

New columns on `messages`:

| Column | Type | Purpose |
|--------|------|---------|
| `ai_labels` | TEXT DEFAULT '{}' | JSON of label -> score |
| `ai_spam_score` | REAL | 0.0-1.0, null = not yet classified |
| `ai_threat_score` | REAL | 0.0-1.0, null = not yet analyzed |
| `ai_sentiment` | TEXT | JSON `{label, score}` |
| `ai_summary` | TEXT | LLM-generated summary |
| `ai_classified_at` | INTEGER | Timestamp of last classification |
| `ai_embedded_at` | INTEGER | Timestamp of embedding generation |
| `is_newsletter` | INTEGER DEFAULT 0 | Newsletter heuristic flag |
| `newsletter_unsubscribe_url` | TEXT | Extracted List-Unsubscribe URL |

New tables:

| Table | Purpose |
|-------|---------|
| `subscriptions` | Track detected newsletters: sender, list ID, unsubscribe URLs, message count, mute status |
| `ai_queue` | Processing queue: message ID, task type (classify/embed/summarize), priority |
| `ai_models` | Model registry: ID, display name, tier, size, download status, local path |
| `message_embeddings` | sqlite-vec `vec0` virtual table with 384-dim float vectors |

### New Services (`src/main/services/`)

| Service | Purpose |
|---------|---------|
| `AiModelManager` | Download, cache, load models at `{userData}/ai-models/` |
| `AiWorkerPool` | Manage 3 `worker_threads`: classifier, embedder, LLM |
| `ClassificationService` | Orchestrate spam + zero-shot + sentiment + threat scoring |
| `EmbeddingService` | Generate vectors, sqlite-vec queries, hybrid search |
| `RagService` | Tier 2: retrieve -> prompt -> generate |
| `SubscriptionService` | Header heuristics, unsubscribe actions |
| `AiAnalyticsService` | SQL aggregate queries for dashboard charts |
| `AiPipelineService` | Background queue processor, triggers after sync |

### Worker Thread Strategy

- **Classifier worker**: Loads DeBERTa (142MB ONNX) + wink-naive-bayes via Transformers.js. Stays alive while AI features are enabled. Handles both zero-shot classification and sentiment in the same process.
- **Embedder worker**: Loads bge-small-en-v1.5 (32MB int8 ONNX). Stays alive while AI features are enabled.
- **LLM worker** (Tier 2 only): Loads Qwen3-1.7B via node-llama-cpp. Spawned on demand, terminated after 5 minutes idle to reclaim memory.

Workers are spawned lazily on first use. Communication uses request-ID-based RPC over `worker_threads` message passing.

### Processing Pipeline

```
ImapWorker.processMessage() stores a new message
  -> enqueue 'classify' + 'embed' tasks to ai_queue

AiPipelineService (background, runs after sync:complete):
  1. Newsletter detection (instant, pure header parsing, main thread)
  2. Spam classification (Bayesian, instant, main thread)
  3. Zero-shot classification (DeBERTa, ~50ms/message, classifier worker)
  4. Sentiment analysis (~30ms/message, classifier worker)
  5. Threat assessment (headers + zero-shot, classifier worker)
  6. Embeddings (~20ms/message, embedder worker)

Progress pushed to renderer via 'ai:classification-progress' events
```

### IPC Channels

New `ai:*` prefix registered in `src/main/ipc/ai.ipc.ts`:

| Channel | Purpose |
|---------|---------|
| `ai:classify-message` | Classify a single message on demand |
| `ai:classify-batch` | Process the classification queue |
| `ai:get-labels` | Get AI labels for a message |
| `ai:search-similar` | Vector similarity search |
| `ai:hybrid-search` | Combined FTS5 + vector search |
| `ai:ask` | RAG Q&A (Tier 2) |
| `ai:summarize-message` | Summarize a single message (Tier 2) |
| `ai:summarize-thread` | Summarize a thread (Tier 2) |
| `ai:list-subscriptions` | List detected newsletters |
| `ai:unsubscribe` | Attempt auto-unsubscribe |
| `ai:mute-subscription` | Mute a subscription locally |
| `ai:analytics-*` | Analytics queries (classification, volume, senders, threats, sentiment) |
| `ai:list-models` | List available models |
| `ai:download-model` | Download a model with progress |
| `ai:delete-model` | Remove a downloaded model |
| `ai:get-settings` / `ai:save-settings` | AI feature settings |
| `ai:enable` | Toggle AI on/off |

Push events: `ai:classification-progress`, `ai:embedding-progress`, `ai:model-download-progress`, `ai:classification-complete`, `ai:queue-update`.

### Renderer Additions

**New Zustand store:** `aiStore.ts` -- AI enabled state, settings, models, progress tracking, subscriptions.

**New components** (all in `src/renderer/src/components/ai/`):

| Component | Purpose |
|-----------|---------|
| `AiLabelsBar` | Colored pills in mail list/viewer showing classification results |
| `AiStatusBar` | Processing status indicator in sidebar |
| `AiSettingsPanel` | Toggle features, manage models, set thresholds |
| `SubscriptionManager` | List/manage/unsubscribe from newsletters |
| `AiAnalyticsDashboard` | Charts: classification breakdown, volume trends, threats, sentiment |
| `AskMailbox` | RAG Q&A text interface (Tier 2) |
| `MessageSummary` | Per-message AI summary in viewer (Tier 2) |

**Modified components:**

- `MailListItem` -- AI label pills below subject, spam/newsletter indicators
- `MailHeader` -- AI labels section, threat warning banner
- `MailViewerPane` -- MessageSummary above body
- `SettingsModal` -- AI Settings tab
- `AccountSidebar` -- AiStatusBar, Subscriptions/Analytics nav items
- `SearchBar` -- "Smart Search" toggle for hybrid FTS5 + vector search

### New npm Dependencies

| Package | Phase | Purpose | License |
|---------|-------|---------|---------|
| `@huggingface/transformers` | 2 | ONNX runtime for small models | Apache 2.0 |
| `wink-naive-bayes-text-classifier` | 2 | Spam classifier | MIT |
| `sqlite-vec` | 4 | Vector search SQLite extension | MIT/Apache 2.0 |
| `node-llama-cpp` | 5 | LLM inference | MIT |

`sqlite-vec` and `node-llama-cpp` are native modules that need `@electron/rebuild` (same as `better-sqlite3` -- add to the `postinstall` step).

---

## Phased Implementation Plan

### Dependency Graph

```
Phase 1 (Foundation + Newsletters)
  |
  v
Phase 2 (Classification) ---------> Phase 3 (Analytics)
  |
  v
Phase 4 (Embeddings + Vector Search)
  |
  v
Phase 5 (RAG + Summarization)
```

### Phase 1: Foundation + Newsletter Detection

**Goal:** Build the infrastructure and deliver the first user-visible AI feature (newsletter management) with zero model downloads.

**Deliverables:**
- Schema migration v2 (all AI columns + tables)
- `AiModelManager` service (model download/cache infrastructure)
- `SubscriptionService` (header-based newsletter detection)
- AI settings in SettingsService and settings UI
- `ai:*` IPC channel scaffold
- `aiStore.ts` in renderer
- Newsletter detection runs on every new message (main thread, no worker needed)
- Subscription Manager UI

**Files created/modified:**
- `src/main/services/StorageService.ts` -- migration v2
- `src/main/services/AiModelManager.ts` -- new
- `src/main/services/SubscriptionService.ts` -- new
- `src/main/ipc/ai.ipc.ts` -- new (scaffold)
- `src/main/ipc/index.ts` -- register new IPC
- `src/shared/types.ts` -- new AI types
- `src/renderer/src/globals.d.ts` -- new IPC type overloads
- `src/renderer/src/store/aiStore.ts` -- new
- `src/renderer/src/components/ai/SubscriptionManager.tsx` -- new
- `src/renderer/src/components/ai/AiSettingsPanel.tsx` -- new
- `src/renderer/src/components/settings/SettingsModal.tsx` -- add AI tab

### Phase 2: Classification Pipeline

**Goal:** Automatic multi-dimensional classification of all messages with visible labels in the UI.

**Deliverables:**
- Worker thread infrastructure (`AiWorkerPool`, classifier worker)
- `ClassificationService` (spam + zero-shot + sentiment + threat)
- `AiPipelineService` (queue processing orchestrator)
- AI labels in MailListItem and MailHeader
- Processing queue with background execution
- `AiStatusBar` component
- Spam classifier training on user's "mark as spam" actions

**Files created/modified:**
- `src/main/services/AiWorkerPool.ts` -- new
- `src/main/workers/classifier.worker.ts` -- new
- `src/main/services/ClassificationService.ts` -- new
- `src/main/services/AiPipelineService.ts` -- new
- `src/renderer/src/components/ai/AiLabelsBar.tsx` -- new
- `src/renderer/src/components/ai/AiStatusBar.tsx` -- new
- `src/renderer/src/components/mail/MailListItem.tsx` -- add labels
- `src/renderer/src/components/viewer/MailHeader.tsx` -- add labels + threat warning
- `src/main/services/ImapWorker.ts` -- hook after `processMessage()` to enqueue

**Depends on:** Phase 1 (schema, model manager, IPC scaffold)

### Phase 3: Analytics Dashboard

**Goal:** Visualize classification data with charts and statistics.

**Deliverables:**
- `AiAnalyticsService` with SQL aggregate queries
- Analytics dashboard with charts
- Classification breakdown pie chart
- Volume trends line chart
- Top senders table
- Threat monitoring panel
- Sentiment distribution bar chart

**Files created/modified:**
- `src/main/services/AiAnalyticsService.ts` -- new
- `src/renderer/src/components/ai/AiAnalyticsDashboard.tsx` -- new
- `src/renderer/src/hooks/useAiAnalytics.ts` -- new

**Depends on:** Phase 2 (classification data must exist)

### Phase 4: Embeddings + Vector Search

**Goal:** Semantic search and message similarity powered by vector embeddings.

**Deliverables:**
- sqlite-vec integration with existing better-sqlite3 database
- Embedder worker thread
- `EmbeddingService`
- Hybrid search (FTS5 keyword + vector similarity with RRF ranking)
- "Smart Search" toggle in SearchBar
- "Find similar" button on messages

**Files created/modified:**
- `src/main/services/StorageService.ts` -- load sqlite-vec extension
- `src/main/workers/embedder.worker.ts` -- new
- `src/main/services/EmbeddingService.ts` -- new
- `src/renderer/src/components/search/SearchBar.tsx` -- add smart search toggle
- `src/renderer/src/hooks/useSearch.ts` -- add hybrid search support
- `package.json` -- add `sqlite-vec` dependency

**Depends on:** Phase 1 (schema), Phase 2 (worker infrastructure)

### Phase 5: RAG + Summarization (Tier 2)

**Goal:** Natural language Q&A over the email corpus and per-message/thread summarization.

**Deliverables:**
- LLM worker thread (node-llama-cpp)
- `RagService` (retrieve + prompt + generate)
- Per-message and per-thread summarization
- "Ask Mailbox" Q&A interface
- `MessageSummary` component in viewer
- Explicit model download UI with progress for Tier 2 models

**Files created/modified:**
- `src/main/workers/llm.worker.ts` -- new
- `src/main/services/RagService.ts` -- new
- `src/renderer/src/components/ai/AskMailbox.tsx` -- new
- `src/renderer/src/components/ai/MessageSummary.tsx` -- new
- `src/renderer/src/components/layout/MailViewerPane.tsx` -- add summary section
- `src/renderer/src/hooks/useAi.ts` -- add RAG methods
- `package.json` -- add `node-llama-cpp` dependency

**Depends on:** Phase 4 (embeddings for retrieval)

---

## Additional Feature Ideas

These surfaced during research and may warrant their own phases:

- **Smart compose / reply suggestions** -- The Tier 2 LLM could draft reply suggestions based on email context.
- **Contact relationship scoring** -- Track communication frequency and sentiment over time per contact to build a relationship graph.
- **Automatic email prioritization** -- Combine spam score, threat score, sender importance, and urgency signals into a single priority ranking.
- **Duplicate / near-duplicate detection** -- Use embeddings to find emails that are essentially the same (forwarded chains, CC storms).
- **Life timeline visualization** -- The emotional classification + date data could power a timeline view showing major life/career events detected in email.
- **Noise threshold tuning** -- A settings slider that controls the boundary between "meaningful" and "noise" based on combined classification scores. Messages below threshold are auto-archived or dimmed.

---

## Appendix: Bayesian Classifier Alternatives

All pure JavaScript, all MIT licensed:

| Package | Notes |
|---------|-------|
| `wink-naive-bayes-text-classifier` | Most feature-complete. Supports cross-validation, confusion matrix, precision/recall. **Recommended.** |
| `bayes` | Simple, custom tokenizer support. Last published 6 years ago but still works. |
| `classificator` | Verbose output with detailed classification info. |
| `nbayes` | Lightweight, zero dependencies. |

## Appendix: Embedding Model Comparison

| Model | Params | Dimensions | MTEB Score | ONNX Size | License |
|-------|--------|------------|------------|-----------|---------|
| `all-MiniLM-L6-v2` | 22M | 384 | ~56% | ~80MB | Apache 2.0 |
| **`bge-small-en-v1.5`** | 33M | 384 | ~62% | 32MB (int8) | MIT |
| `nomic-embed-text-v1.5` | 137M | 64-768 (Matryoshka) | ~62% | ~520MB | Apache 2.0 |
| `gte-small` | 33M | 384 | ~61% | ~127MB | MIT |
| `bge-base-en-v1.5` | 109M | 768 | ~64% | ~420MB | MIT |

`bge-small-en-v1.5` offers the best quality-to-size ratio for email-length documents.

## Appendix: Small LLM Comparison

### Under 1B (fastest, lowest quality)
1. **Qwen3-0.6B-Instruct** (Apache 2.0) -- best quality at this size
2. SmolLM2-360M-Instruct (Apache 2.0) -- faster but lower quality

### 1-2B (sweet spot for email)
1. **Qwen3-1.7B-Instruct** (Apache 2.0) -- best overall for the size
2. SmolLM2-1.7B-Instruct (Apache 2.0) -- close second

### 2-4B (highest quality, more RAM)
1. **Phi-3.5-mini-instruct** (MIT, 3.8B) -- best quality, official ONNX, 128K context
2. Qwen3-4B-Instruct (Apache 2.0) -- very close, dual-mode reasoning
3. SmolLM3-3B (Apache 2.0) -- newest contender from HuggingFace
