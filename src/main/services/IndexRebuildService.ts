import { BrowserWindow } from 'electron'
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser'
import { storageService } from './StorageService'
import { mailRepository } from './MailRepository'
import { emlStore } from './EmlStore'
import { getMailRoot } from '../utils/paths'
import { logger } from '../utils/logger'

class IndexRebuildService {
  /**
   * Rebuild the entire message index by walking all EML files on disk.
   * 1. Clears all message rows (keeps mailbox rows).
   * 2. Walks every .eml file under the mail root.
   * 3. Parses each file and upserts the message + FTS index.
   * 4. Sends progress events to the renderer.
   */
  async rebuild(): Promise<void> {
    logger.info('IndexRebuildService: starting rebuild')

    const mailRoot = getMailRoot()

    // Step 1: Collect all EML paths first so we can report total progress
    const allFiles: { emlPath: string; accountId: string }[] = []
    for await (const entry of emlStore.walkAllEml(mailRoot)) {
      allFiles.push(entry)
    }

    const total = allFiles.length
    logger.info(`IndexRebuildService: found ${total} EML files`)

    // Clear existing message rows (FTS rows are cleared inside deleteMailboxMessages
    // but we need a direct clear here since we're not going mailbox-by-mailbox).
    // We delete all FTS rows and all message rows directly.
    try {
      const db = storageService.db
      db.exec('DELETE FROM messages_fts')
      db.exec('DELETE FROM messages')
      logger.info('IndexRebuildService: cleared existing message rows')
    } catch (err) {
      logger.error('IndexRebuildService: failed to clear message rows', err)
      throw err
    }

    const sendProgress = (current: number): void => {
      const windows = BrowserWindow.getAllWindows()
      if (windows[0]) {
        windows[0].webContents.send('rebuild:progress', { current, total })
      }
    }

    let current = 0

    for (const { emlPath, accountId } of allFiles) {
      current++

      try {
        const buffer = await emlStore.read(emlPath)
        const parsed: ParsedMail = await simpleParser(buffer)

        // Derive mailboxId from path: {mailRoot}/{accountId}/{year}/{MM}/{filename}
        // We don't have a mailboxId embedded in the path, so we'll need to look
        // up or create a placeholder mailbox. For rebuild, we try to infer from
        // any existing mailbox for the account, or use a generic id.
        const mailbox = mailRepository.listMailboxes(accountId)[0]
        if (!mailbox) {
          logger.warn(
            `IndexRebuildService: no mailbox found for account ${accountId}, skipping ${emlPath}`
          )
          sendProgress(current)
          continue
        }

        // Extract fields from parsed message
        const fromAddress = parsed.from?.value?.[0]
        const fromName = fromAddress?.name ?? ''
        const fromEmail = fromAddress?.address ?? ''

        const toAddresses = flattenAddresses(parsed.to)
        const ccAddresses = flattenAddresses(parsed.cc)

        const date = parsed.date ? parsed.date.getTime() : Date.now()
        const receivedAt = date

        const subject = parsed.subject ?? ''
        const messageId = parsed.messageId ?? null

        // Derive a uid from the filename if possible
        const filename = emlPath.split('/').pop() ?? ''
        const uidMatch = filename.match(/^uid_(\d+)_/)
        const uid = uidMatch ? parseInt(uidMatch[1], 10) : current

        const hasAttachments =
          Array.isArray(parsed.attachments) && parsed.attachments.length > 0

        const message = mailRepository.upsertMessage({
          accountId,
          mailboxId: mailbox.id,
          uid,
          messageId,
          threadId: null,
          subject,
          fromName,
          fromEmail,
          toAddresses,
          ccAddresses,
          date,
          receivedAt,
          sizeBytes: buffer.length,
          isRead: false,
          isStarred: false,
          isDeleted: false,
          hasAttachments,
          emlPath,
          flags: []
        })

        // FTS index
        const bodyText = parsed.text ?? ''
        const toText = toAddresses.map((a) => `${a.name} ${a.email}`).join(' ')
        const attachmentNames = parsed.attachments
          ? parsed.attachments.map((a) => a.filename ?? '').join(' ')
          : ''

        mailRepository.insertFts({
          messageId: message.id,
          subject,
          fromText: `${fromName} ${fromEmail}`,
          toText,
          bodyText,
          attachmentNames
        })

        // Upsert attachments
        if (parsed.attachments) {
          for (const att of parsed.attachments) {
            mailRepository.upsertAttachment({
              messageId: message.id,
              filename: att.filename ?? 'unnamed',
              contentType: att.contentType,
              sizeBytes: att.size ?? 0,
              contentId: att.cid ?? null,
              isInline: att.related ?? false
            })
          }
        }
      } catch (err) {
        logger.error(`IndexRebuildService: error processing ${emlPath}:`, err)
        // Skip and continue
      }

      sendProgress(current)
    }

    logger.info('IndexRebuildService: rebuild complete')
  }
}

function flattenAddresses(
  addr: AddressObject | AddressObject[] | undefined
): { name: string; email: string }[] {
  if (!addr) return []
  const list = Array.isArray(addr) ? addr : [addr]
  return list.flatMap((a) =>
    a.value.map((v) => ({
      name: v.name ?? '',
      email: v.address ?? ''
    }))
  )
}

export const indexRebuildService = new IndexRebuildService()
