// ─── Account ────────────────────────────────────────────────────────────────

export type EmailProvider = 'gmail' | 'icloud' | 'microsoft365' | 'yahoo' | 'other'
export type AuthMethod = 'app_password' | 'oauth2'

export interface Account {
  id: string
  name: string
  email: string
  provider: EmailProvider
  authMethod: AuthMethod
  imapHost: string
  imapPort: number
  imapTls: boolean
  syncIntervalMinutes: number
  enabled: boolean
  createdAt: number
}

export interface AccountWithCredentials extends Account {
  password: string
  oauthRefreshToken?: string
}

export interface AddAccountPayload {
  name: string
  email: string
  provider: EmailProvider
  authMethod: AuthMethod
  imapHost: string
  imapPort: number
  imapTls: boolean
  password: string
  syncIntervalMinutes: number
}

export interface UpdateAccountPayload {
  id: string
  name?: string
  syncIntervalMinutes?: number
  enabled?: boolean
  password?: string
}

export interface ConnectionTestResult {
  success: boolean
  error?: string
  mailboxCount?: number
}

// ─── Mailbox ─────────────────────────────────────────────────────────────────

export interface Mailbox {
  id: string
  accountId: string
  name: string
  path: string
  delimiter: string
  attributes: string[]
  lastSeenUid: number
  uidvalidity: number
  totalCount: number
  unreadCount: number
  syncedAt: number | null
}

// ─── Message ─────────────────────────────────────────────────────────────────

export interface EmailAddress {
  name: string
  email: string
}

export interface Message {
  id: string
  accountId: string
  mailboxId: string
  uid: number
  messageId: string | null
  threadId: string | null
  subject: string
  fromName: string
  fromEmail: string
  toAddresses: EmailAddress[]
  ccAddresses: EmailAddress[]
  date: number
  receivedAt: number
  sizeBytes: number
  isRead: boolean
  isStarred: boolean
  isDeleted: boolean
  hasAttachments: boolean
  emlPath: string
  flags: string[]
}

export interface Attachment {
  id: string
  messageId: string
  filename: string
  contentType: string
  sizeBytes: number
  contentId: string | null
  isInline: boolean
}

// ─── Mail queries ─────────────────────────────────────────────────────────────

export interface MailListQuery {
  accountId?: string
  mailboxId?: string
  limit: number
  offset: number
  onlyUnread?: boolean
  onlyStarred?: boolean
}

export interface MailListResult {
  messages: Message[]
  total: number
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchQuery {
  text?: string           // free-text across all indexed columns
  subject?: string        // subject line only
  body?: string           // body text only
  from?: string           // sender name or email
  to?: string             // recipient name or email
  before?: number         // Unix timestamp (ms) — messages sent before this
  after?: number          // Unix timestamp (ms) — messages sent after this
  hasAttachment?: boolean
  isUnread?: boolean
  isStarred?: boolean
  accountId?: string
  limit: number
  offset: number
}

export interface SearchResult {
  message: Message
  snippet: string
}

export interface SearchResultPage {
  results: SearchResult[]
  total: number
}

export type SuggestField = 'from' | 'to' | 'subject' | 'tag' | 'is' | 'has' | 'date'

export interface SuggestRequest {
  field: SuggestField
  prefix: string
  limit?: number
}

export interface SuggestResult {
  value: string
  label: string
  count?: number
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncPhase = 'connecting' | 'listing' | 'fetching' | 'idle' | 'error' | 'stopped'

export interface SyncStatus {
  accountId: string
  phase: SyncPhase
  mailboxName?: string
  current?: number
  total?: number
  error?: string
}

export interface SyncProgressEvent {
  accountId: string
  phase: SyncPhase
  mailboxName?: string
  current?: number
  total?: number
}

export interface SyncErrorEvent {
  accountId: string
  error: string
  recoverable: boolean
}

export interface NewMessagesEvent {
  accountId: string
  count: number
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  windowBounds?: { x: number; y: number; width: number; height: number }
  sidebarWidth: number
  showExternalImages: boolean
  syncOnStartup: boolean
  enableLogging: boolean
}

// ─── IPC generic ─────────────────────────────────────────────────────────────

export interface IpcResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
