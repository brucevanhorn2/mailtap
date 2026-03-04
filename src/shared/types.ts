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
  aiLabels: Record<string, number> | null
  aiSpamScore: number | null
  aiThreatScore: number | null
  aiSentiment: string | null
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

export interface MailListFilter {
  aiLabel?: string
  threatLevel?: 'high' | 'medium' | 'any'
  senderEmail?: string
  dateFrom?: number
  dateTo?: number
}

export interface MailListQuery {
  accountId?: string
  mailboxId?: string
  limit: number
  offset: number
  onlyUnread?: boolean
  onlyStarred?: boolean
  aiLabel?: string
  minThreatScore?: number
  maxThreatScore?: number
  senderEmail?: string
  dateFrom?: number
  dateTo?: number
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
  cc?: string             // CC recipient name or email
  // bcc — deferred: BCC is stripped by SMTP on delivery; add when classification lands
  before?: number         // Unix timestamp (ms) — messages sent before this
  after?: number          // Unix timestamp (ms) — messages sent after this
  hasAttachment?: boolean
  isUnread?: boolean
  isStarred?: boolean
  isCcMe?: boolean        // any of the user's account emails is in the CC field
  isForwarded?: boolean   // subject begins with Fwd: or FW:
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

export type SuggestField = 'from' | 'to' | 'cc' | 'subject' | 'tag' | 'is' | 'has' | 'date'

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
  ai?: AiSettings
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface AiSettings {
  enabled: boolean
  autoClassify: boolean
  autoEmbed: boolean
  spamThreshold: number
  threatThreshold: number
  labelMinScore: number
  customLabels: string[]
  llmEnabled: boolean
  llmModelId: string | null
  classifierModelId: string
  sentimentModelId: string
  embeddingModelId: string
  modelDtype: string
}

export interface AiModelInfo {
  id: string
  displayName: string
  tier: number
  sizeBytes: number
  modelType: string
  isDownloaded: boolean
  localPath: string | null
}

export interface Subscription {
  id: string
  fromEmail: string
  fromName: string
  listId: string | null
  unsubscribeUrl: string | null
  messageCount: number
  firstSeenAt: number
  lastSeenAt: number
  isMuted: boolean
}

// ─── AI Analytics ────────────────────────────────────────────────────────────

export interface LabelCount {
  label: string
  count: number
  percentage: number
}

export interface TimeSeriesPoint {
  date: string
  timestamp: number
  count: number
  label?: string
}

export interface SenderStat {
  email: string
  name: string
  count: number
  avgSpamScore: number
}

export interface ThreatMessage {
  id: string
  subject: string
  fromEmail: string
  threatScore: number
  labels: Record<string, number>
  sentiment: string | null
}

export interface ClassifiedMessage {
  id: string
  subject: string
  fromEmail: string
  date: number
  labels: Record<string, number>
  sentiment: string | null
}

export interface ThreatSummary {
  totalThreats: number
  highRisk: number
  mediumRisk: number
  details: ThreatMessage[]
}

export interface SentimentCount {
  sentiment: string
  count: number
  percentage: number
}

export interface AccountStats {
  accountId: string
  totalAll: number
  total30d: number
  total7d: number
  totalToday: number
}

// ─── IPC generic ─────────────────────────────────────────────────────────────

export interface IpcResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
