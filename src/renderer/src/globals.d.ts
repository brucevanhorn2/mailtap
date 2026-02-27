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
  SuggestRequest,
  SuggestResult,
  SyncStatus,
  AppSettings,
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

      // Generic invoke fallback
      invoke(channel: string, ...args: unknown[]): Promise<unknown>

      // Push events
      on(channel: 'sync:progress', callback: (event: import('../../shared/types').SyncProgressEvent) => void): () => void
      on(channel: 'sync:complete', callback: (accountId: string) => void): () => void
      on(channel: 'sync:error', callback: (event: import('../../shared/types').SyncErrorEvent) => void): () => void
      on(channel: 'mail:new-messages', callback: (event: import('../../shared/types').NewMessagesEvent) => void): () => void
      on(channel: 'rebuild:progress', callback: (event: { current: number; total: number }) => void): () => void
      on(channel: string, callback: (...args: unknown[]) => void): () => void
    }
  }
}

export {}
