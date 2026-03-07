import type { BrowserWindow } from 'electron'
import type { ImapFlow, ListResponse } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { Account, SyncPhase } from '@shared/types'
import { createImapClient } from './ImapConnection'
import { accountService } from './AccountService'
import { mailRepository } from './MailRepository'
import { emlStore } from './EmlStore'
import { extractAttachmentText } from './AttachmentExtractorService'
import { logger } from '../utils/logger'

const IDLE_TIMEOUT_MS = 28 * 60 * 1000 // 28 minutes per RFC 2177
const SYNC_BATCH_SIZE = 100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class ImapWorker {
  private client: ImapFlow | null = null
  private stopped = false
  private syncLoopPromise: Promise<void> | null = null

  constructor(
    private readonly account: Account,
    private readonly win: BrowserWindow
  ) {}

  start(): void {
    this.stopped = false
    this.syncLoopPromise = this.run().catch((err) => {
      logger.error(`ImapWorker[${this.account.id}]: unexpected error in run()`, err)
    })
  }

  async stop(): Promise<void> {
    this.stopped = true
    try {
      if (this.client) {
        await this.client.logout().catch(() => {
          // ignore logout errors during stop
        })
        this.client = null
      }
    } catch {
      // ignore
    }
    if (this.syncLoopPromise) {
      await this.syncLoopPromise.catch(() => {})
      this.syncLoopPromise = null
    }
    this.emitProgress('stopped')
  }

  private emitProgress(
    phase: SyncPhase,
    mailboxName?: string,
    current?: number,
    total?: number
  ): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('sync:progress', {
        accountId: this.account.id,
        phase,
        mailboxName,
        current,
        total
      })
    }
  }

  private emitError(error: string, recoverable: boolean): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('sync:error', {
        accountId: this.account.id,
        error,
        recoverable
      })
    }
  }

  private async run(): Promise<void> {
    let backoffMs = 1000
    const maxBackoffMs = 60_000

    while (!this.stopped) {
      try {
        await this.syncCycle()
        // Reset backoff on success
        backoffMs = 1000
      } catch (err) {
        if (this.stopped) break

        if (this.isAuthError(err)) {
          logger.error(
            `ImapWorker[${this.account.id}]: authentication error, stopping`,
            err
          )
          this.stopped = true
          this.emitProgress('error')
          this.emitError(String(err), false)
          break
        }

        logger.warn(
          `ImapWorker[${this.account.id}]: network/connection error, retrying in ${backoffMs}ms`,
          err
        )
        this.emitProgress('error')
        this.emitError(String(err), true)

        // Wait with backoff before retrying
        await sleep(backoffMs)
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs)
      }
    }
  }

  private async syncCycle(): Promise<void> {
    // 1. Get credentials
    const creds = accountService.getCredentials(this.account.id)

    // 2. Create client and connect
    this.emitProgress('connecting')
    this.client = createImapClient(creds)
    await this.client.connect()

    try {
      // 3. Full sync
      await this.fullSync()

      // 4. If not stopped: idle on INBOX
      if (!this.stopped) {
        await this.idleOnInbox()
      }
    } finally {
      // 5. Logout
      try {
        await this.client.logout()
      } catch {
        // ignore logout errors
      }
      this.client = null
    }
  }

  private async fullSync(): Promise<void> {
    if (!this.client) return

    this.emitProgress('listing')
    const mailboxes = await this.client.list()

    for (const mb of mailboxes) {
      if (this.stopped) break
      await this.syncMailbox(mb)
    }

    if (!this.stopped && !this.win.isDestroyed()) {
      this.win.webContents.send('sync:complete', this.account.id)
    }
  }

  private async syncMailbox(mb: ListResponse): Promise<void> {
    if (!this.client) return

    let lock: { release: () => void } | null = null

    try {
      // 1. Get or create mailbox row (preliminary, before we have uidValidity)
      const existingMailbox = mailRepository.getMailbox(this.account.id, mb.path)

      // 2. Acquire lock
      lock = await this.client.getMailboxLock(mb.path)

      const imapMailbox = this.client.mailbox as {
        path: string
        uidValidity: bigint
        exists: number
      }

      const serverUidValidity = Number(imapMailbox.uidValidity)
      const serverExists = imapMailbox.exists

      // 3a. Check for UID validity changes — if changed, purge old messages
      if (existingMailbox && existingMailbox.uidvalidity !== 0 &&
          existingMailbox.uidvalidity !== serverUidValidity) {
        logger.warn(
          `ImapWorker[${this.account.id}]: UID validity changed for ${mb.path}, purging messages`
        )
        mailRepository.deleteMailboxMessages(existingMailbox.id)
      }

      // 3b. Upsert mailbox row with current server info
      const mailbox = mailRepository.upsertMailbox({
        accountId: this.account.id,
        path: mb.path,
        name: mb.name,
        delimiter: mb.delimiter ?? '/',
        attributes: Array.from(mb.flags ?? []),
        uidvalidity: serverUidValidity,
        totalCount: serverExists,
        unreadCount: existingMailbox?.unreadCount ?? 0
      })

      // 3c. Determine start UID — reset if UID validity changed
      const lastSeenUid =
        existingMailbox && existingMailbox.uidvalidity === serverUidValidity
          ? existingMailbox.lastSeenUid
          : 0

      // Search for new UIDs (returns false or [] when nothing to fetch — no exception)
      const searchCriteria = lastSeenUid > 0 ? { uid: `${lastSeenUid + 1}:*` } : { all: true }
      const searchResult = await this.client.search(searchCriteria, { uid: true })
      const newUids: number[] = Array.isArray(searchResult) ? searchResult : []

      if (newUids.length === 0) {
        // Nothing to fetch
        mailRepository.updateMailboxSyncedAt(mailbox.id)
        return
      }

      // Sort descending so we fetch newest messages first
      newUids.sort((a, b) => b - a)

      const total = newUids.length
      this.emitProgress('fetching', mb.name, 0, total)

      // 3d. Fetch and process messages in batches of SYNC_BATCH_SIZE
      let highestUid = lastSeenUid
      let processed = 0

      for (let i = 0; i < newUids.length && !this.stopped; i += SYNC_BATCH_SIZE) {
        const batch = newUids.slice(i, i + SYNC_BATCH_SIZE)
        const range = batch.join(',')

        for await (const msg of this.client.fetch(
          range,
          { uid: true, source: true, flags: true },
          { uid: true }
        )) {
          if (this.stopped) break

          await this.processMessage(
            { uid: msg.uid, source: msg.source as Buffer, flags: msg.flags as Set<string> },
            mailbox.id
          )

          if (msg.uid > highestUid) {
            highestUid = msg.uid
          }
          processed++
        }

        if (this.stopped) break

        // After each complete batch: update progress and notify UI
        this.emitProgress('fetching', mb.name, processed, total)
        if (!this.win.isDestroyed()) {
          this.win.webContents.send('mail:new-messages', {
            accountId: this.account.id,
            count: batch.length
          })
        }
      }

      // 3e. Update lastSeenUid and syncedAt
      if (highestUid > lastSeenUid) {
        mailRepository.updateMailboxLastSeenUid(mailbox.id, highestUid)
      }
      mailRepository.updateMailboxSyncedAt(mailbox.id)

      // 3f. Get unread count via status
      try {
        const status = await this.client.status(mb.path, { unseen: true, messages: true })
        if (typeof status.unseen === 'number') {
          mailRepository.updateMailboxUnreadCount(mailbox.id, status.unseen)
        }
      } catch (statusErr) {
        logger.warn(
          `ImapWorker[${this.account.id}]: failed to get status for ${mb.path}`,
          statusErr
        )
      }
    } catch (err) {
      // Per-mailbox error: log and continue, don't abort whole sync
      logger.error(
        `ImapWorker[${this.account.id}]: error syncing mailbox ${mb.path}`,
        err
      )
    } finally {
      if (lock) {
        lock.release()
      }
    }
  }

  private async processMessage(
    msg: { uid: number; source: Buffer; flags: Set<string> },
    mailboxId: string
  ): Promise<void> {
    try {
      // 1. Parse the raw email
      const parsed = await simpleParser(msg.source)

      // 2. Determine date
      const messageDate = parsed.date?.getTime() ?? Date.now()
      const dateObj = parsed.date ?? new Date()
      const year = dateObj.getFullYear()
      const month = dateObj.getMonth() + 1

      // 3. Build and save EML file
      const filename = emlStore.buildFilename(parsed.messageId ?? null, msg.uid, mailboxId)
      const emlPath = await emlStore.save(this.account.id, year, month, filename, msg.source)

      // 4. Extract flags
      const flagsArray = Array.from(msg.flags)
      const isRead = msg.flags.has('\\Seen')
      const isStarred = msg.flags.has('\\Flagged')
      const isDeleted = msg.flags.has('\\Deleted')

      // 5. Extract sender
      const fromEntry = parsed.from?.value?.[0]
      const fromName = fromEntry?.name ?? ''
      const fromEmail = fromEntry?.address ?? ''

      // 6. Extract to/cc — handle both AddressObject and AddressObject[]
      const normalizeAddresses = (
        field: typeof parsed.to
      ): Array<{ name: string; email: string }> => {
        if (!field) return []
        const arr = Array.isArray(field) ? field : [field]
        const result: Array<{ name: string; email: string }> = []
        for (const ao of arr) {
          if (ao && 'value' in ao && Array.isArray(ao.value)) {
            for (const addr of ao.value) {
              result.push({ name: addr.name ?? '', email: addr.address ?? '' })
            }
          }
        }
        return result
      }

      const toAddresses = normalizeAddresses(parsed.to)
      const ccAddresses = normalizeAddresses(parsed.cc)

      // 7. Compute thread ID
      const references = parsed.references
      const firstReference = Array.isArray(references) ? references[0] : references
      const threadId =
        parsed.inReplyTo ??
        firstReference ??
        parsed.messageId ??
        null

      // 8. Process attachments — only non-inline ones
      const nonInlineAttachments = (parsed.attachments ?? []).filter(
        (att) => !att.related
      )
      const hasAttachments = nonInlineAttachments.length > 0

      // 9. Upsert message row
      const message = mailRepository.upsertMessage({
        accountId: this.account.id,
        mailboxId,
        uid: msg.uid,
        messageId: parsed.messageId ?? null,
        threadId,
        subject: parsed.subject ?? '(no subject)',
        fromName,
        fromEmail,
        toAddresses,
        ccAddresses,
        date: messageDate,
        receivedAt: Date.now(),
        sizeBytes: msg.source.length,
        isRead,
        isStarred,
        isDeleted,
        hasAttachments,
        emlPath,
        flags: flagsArray
      })

      // 10. Upsert attachment rows + extract content for FTS
      for (const att of nonInlineAttachments) {
        const attachment = mailRepository.upsertAttachment({
          messageId: message.id,
          filename: att.filename ?? 'attachment',
          contentType: att.contentType,
          sizeBytes: att.size ?? att.content?.length ?? 0,
          contentId: att.cid ?? null,
          isInline: false
        })

        if (att.content && att.content.length > 0) {
          try {
            const text = await extractAttachmentText(
              att.content,
              att.contentType,
              att.filename ?? 'attachment'
            )
            if (text) {
              mailRepository.insertAttachmentContent({
                attachmentId: attachment.id,
                messageId: message.id,
                filename: att.filename ?? 'attachment',
                content: text
              })
            }
          } catch (extractErr) {
            logger.warn(
              `ImapWorker[${this.account.id}]: attachment text extraction failed for ${att.filename}`,
              extractErr
            )
          }
        }
      }

      // 11. Insert FTS row
      const attachmentNames = nonInlineAttachments
        .map((att) => att.filename ?? '')
        .filter(Boolean)
        .join(' ')

      const toText = toAddresses.map((a) => `${a.name} ${a.email}`).join(' ')

      mailRepository.insertFts({
        messageId: message.id,
        subject: parsed.subject ?? '',
        fromText: `${fromName} ${fromEmail}`,
        toText,
        bodyText: parsed.text ?? '',
        attachmentNames
      })

    } catch (err) {
      logger.error(
        `ImapWorker[${this.account.id}]: failed to process message uid=${msg.uid}`,
        err
      )
      // Don't rethrow — continue processing other messages
    }
  }

  private async idleOnInbox(): Promise<void> {
    if (!this.client || this.stopped) return

    let lock: { release: () => void } | null = null

    try {
      // Find INBOX case-insensitively
      const mailboxes = await this.client.list()
      const inboxMb = mailboxes.find((mb) => mb.path.toLowerCase() === 'inbox')
      if (!inboxMb) {
        logger.info(`ImapWorker[${this.account.id}]: no INBOX found, skipping idle`)
        return
      }

      lock = await this.client.getMailboxLock(inboxMb.path)
      this.emitProgress('idle')

      // Race between idle (resolves on EXISTS notification) and timeout
      await Promise.race([
        this.client.idle(),
        sleep(IDLE_TIMEOUT_MS)
      ])
    } catch (err) {
      // Idle is optional — log and continue silently
      logger.info(
        `ImapWorker[${this.account.id}]: idle ended or errored (non-fatal)`,
        err
      )
    } finally {
      if (lock) {
        lock.release()
      }
    }
  }

  private isAuthError(err: unknown): boolean {
    const msg = String(err).toLowerCase()
    return (
      msg.includes('authentication') ||
      msg.includes('credentials') ||
      msg.includes('[authenticationfailed]') ||
      msg.includes('invalid credentials') ||
      msg.includes('bad credentials') ||
      msg.includes('login failed')
    )
  }
}
