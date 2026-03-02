import type {
  Account,
  AddAccountPayload,
  UpdateAccountPayload,
  ConnectionTestResult,
  Mailbox,
  Message,
  Attachment,
  MailListQuery,
  MailListResult,
  SearchQuery,
  SearchResultPage,
  SearchResult,
  SuggestRequest,
  SuggestResult,
  SyncStatus,
  AppSettings,
  AiSettings,
  AiModelInfo,
  Subscription,
  LabelCount,
  TimeSeriesPoint,
  SenderStat,
  ThreatSummary,
  SentimentCount,
  AccountStats,
  IpcResult
} from '../../shared/types'

declare global {
  interface Window {
    mailtap: {
      // Account
      invoke(channel: 'account:list'): Promise<Account[]>
      invoke(channel: 'account:add', payload: AddAccountPayload): Promise<IpcResult<Account>>
      invoke(channel: 'account:remove', id: string): Promise<IpcResult>
      invoke(channel: 'account:update', payload: UpdateAccountPayload): Promise<IpcResult<Account>>
      invoke(channel: 'account:test-connection', payload: AddAccountPayload): Promise<ConnectionTestResult>
      invoke(channel: 'account:oauth-start', provider: string): Promise<IpcResult<{ code: string }>>

      // Sync
      invoke(channel: 'sync:start', accountId: string): Promise<IpcResult>
      invoke(channel: 'sync:stop', accountId: string): Promise<IpcResult>
      invoke(channel: 'sync:status'): Promise<SyncStatus[]>

      // Window
      invoke(channel: 'window:minimize'): Promise<void>
      invoke(channel: 'window:maximize'): Promise<void>
      invoke(channel: 'window:close'): Promise<void>
      invoke(channel: 'app:zoom-in'): Promise<void>
      invoke(channel: 'app:zoom-out'): Promise<void>
      invoke(channel: 'app:reset-zoom'): Promise<void>
      invoke(channel: 'app:open-url', url: string): Promise<void>

      // Mail
      invoke(channel: 'mail:list', query: MailListQuery): Promise<MailListResult>
      invoke(channel: 'mail:get', id: string): Promise<Message | null>
      invoke(channel: 'mail:get-body', id: string): Promise<IpcResult<{ html: string; text: string; attachments: Attachment[] }>>
      invoke(channel: 'mail:mark-read', id: string, isRead: boolean): Promise<IpcResult>
      invoke(channel: 'mail:delete', id: string): Promise<IpcResult>
      invoke(channel: 'mail:save-attachment', messageId: string, attachmentId: string, savePath: string): Promise<IpcResult>

      // Mailbox
      invoke(channel: 'mailbox:list', accountId?: string): Promise<Mailbox[]>
      invoke(channel: 'mailbox:unread-counts'): Promise<Record<string, number>>

      // Search
      invoke(channel: 'search:query', query: SearchQuery): Promise<SearchResultPage>
      invoke(channel: 'search:suggest', req: SuggestRequest): Promise<SuggestResult[]>

      // Settings
      invoke(channel: 'settings:load'): Promise<AppSettings>
      invoke(channel: 'settings:save', settings: AppSettings): Promise<void>

      // Rebuild
      invoke(channel: 'rebuild:trigger'): Promise<void>

      // AI - Model Management
      invoke(channel: 'ai:list-models'): Promise<AiModelInfo[]>
      invoke(channel: 'ai:download-model', modelId: string): Promise<IpcResult<{ modelPath: string }>>
      invoke(channel: 'ai:delete-model', modelId: string): Promise<IpcResult>

      // AI - Subscriptions
      invoke(channel: 'ai:list-subscriptions'): Promise<Subscription[]>
      invoke(channel: 'ai:mute-subscription', subscriptionId: string): Promise<IpcResult>
      invoke(channel: 'ai:unmute-subscription', subscriptionId: string): Promise<IpcResult>
      invoke(channel: 'ai:unsubscribe', subscriptionId: string): Promise<IpcResult>

      // AI - Classification
      invoke(channel: 'ai:classify-message', messageId: string): Promise<IpcResult>
      invoke(channel: 'ai:classify-batch'): Promise<IpcResult>

      // AI - Embeddings & Search
      invoke(channel: 'ai:embed-message', messageId: string): Promise<IpcResult>
      invoke(channel: 'ai:search-similar', query: string, limit?: number): Promise<Array<{ messageId: string; similarity: number }>>
      invoke(channel: 'ai:hybrid-search', query: string, limit?: number): Promise<SearchResult[]>

      // AI - Analytics
      invoke(channel: 'ai:analytics-classification', accountId?: string, days?: number): Promise<LabelCount[]>
      invoke(channel: 'ai:analytics-volume', accountId?: string, granularity?: 'day' | 'week' | 'month', range?: number): Promise<TimeSeriesPoint[]>
      invoke(channel: 'ai:analytics-senders', limit: number, accountId?: string): Promise<SenderStat[]>
      invoke(channel: 'ai:analytics-threats', days: number, accountId?: string): Promise<ThreatSummary>
      invoke(channel: 'ai:analytics-sentiment', accountId?: string): Promise<SentimentCount[]>
      invoke(channel: 'ai:analytics-account-stats'): Promise<AccountStats[]>

      // AI - Settings
      invoke(channel: 'ai:get-settings'): Promise<AiSettings>
      invoke(channel: 'ai:save-settings', settings: AiSettings): Promise<IpcResult>
      invoke(channel: 'ai:enable', enabled: boolean): Promise<IpcResult>

      // AI - RAG
      invoke(channel: 'ai:init-llm', modelPath: string): Promise<IpcResult>
      invoke(channel: 'ai:ask', question: string, limit?: number): Promise<IpcResult<{ answer: string; sources: import('../../shared/types').SearchResult[] }>>
      invoke(channel: 'ai:summarize-message', messageId: string): Promise<IpcResult<{ summary: string }>>
      invoke(channel: 'ai:summarize-thread', messageId: string): Promise<IpcResult<{ summary: string; participants: string[]; messageCount: number }>>

      // Generic invoke fallback
      invoke(channel: string, ...args: unknown[]): Promise<unknown>

      // Push events
      on(channel: 'sync:progress', callback: (event: import('../../shared/types').SyncProgressEvent) => void): () => void
      on(channel: 'sync:complete', callback: (accountId: string) => void): () => void
      on(channel: 'sync:error', callback: (event: import('../../shared/types').SyncErrorEvent) => void): () => void
      on(channel: 'mail:new-messages', callback: (event: import('../../shared/types').NewMessagesEvent) => void): () => void
      on(channel: 'rebuild:progress', callback: (event: { current: number; total: number }) => void): () => void
      on(channel: 'ai:model-download-progress', callback: (event: { modelId: string; percent: number }) => void): () => void
      on(channel: string, callback: (...args: unknown[]) => void): () => void
    }
  }
}

export {}
