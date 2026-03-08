import { ipcMain, dialog } from 'electron'
import { promises as fs } from 'fs'
import { simpleParser } from 'mailparser'
import { mailRepository } from '../services/MailRepository'
import { emlStore } from '../services/EmlStore'
import { smtpService } from '../services/SmtpService'
import { logger } from '../utils/logger'
import type { MailListQuery, ComposePayload } from '@shared/types'

export function registerMailIpc(): void {
  ipcMain.handle('mail:send', async (_event, payload: ComposePayload) => {
    return smtpService.sendMessage(payload)
  })

  ipcMain.handle('mail:list', async (_event, query: MailListQuery) => {
    return mailRepository.listMessages(query)
  })

  ipcMain.handle('mail:get', async (_event, id: string) => {
    return mailRepository.getMessage(id)
  })

  ipcMain.handle('mail:get-body', async (_event, id: string) => {
    try {
      const emlPath = mailRepository.getEmlPath(id)
      if (!emlPath) {
        return { success: false, error: 'EML path not found for message' }
      }

      const buffer = await emlStore.read(emlPath)
      const parsed = await simpleParser(buffer)
      const attachments = mailRepository.listAttachments(id)

      return {
        success: true,
        data: {
          html: parsed.html ?? '',
          text: parsed.text ?? '',
          attachments
        }
      }
    } catch (err) {
      logger.error('mail:get-body error:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('mail:mark-read', async (_event, id: string, isRead: boolean) => {
    mailRepository.markRead(id, isRead)
    return { success: true }
  })

  ipcMain.handle('mail:delete', async (_event, id: string) => {
    mailRepository.softDeleteMessage(id)
    return { success: true }
  })

  ipcMain.handle(
    'mail:save-attachment',
    async (_event, messageId: string, attachmentId: string, savePath?: string) => {
      try {
        const emlPath = mailRepository.getEmlPath(messageId)
        if (!emlPath) {
          return { success: false, error: 'EML path not found for message' }
        }

        const buffer = await emlStore.read(emlPath)
        const parsed = await simpleParser(buffer)

        if (!parsed.attachments || parsed.attachments.length === 0) {
          return { success: false, error: 'No attachments found in message' }
        }

        // Look up the attachment record so we can match by contentId or filename
        const attachmentRecord = mailRepository.getAttachment(attachmentId)

        let targetAttachment = parsed.attachments.find((att) => {
          if (attachmentRecord?.contentId && att.cid) {
            return att.cid === attachmentRecord.contentId
          }
          if (attachmentRecord?.filename) {
            return att.filename === attachmentRecord.filename
          }
          return false
        })

        // Fallback: try to find by attachmentId as a filename directly
        if (!targetAttachment) {
          targetAttachment = parsed.attachments.find(
            (att) => att.filename === attachmentId || att.cid === attachmentId
          )
        }

        if (!targetAttachment) {
          return { success: false, error: 'Attachment not found in EML' }
        }

        // Determine the destination path
        let destination = savePath
        if (!destination) {
          const filename = targetAttachment.filename ?? 'attachment'
          const result = await dialog.showSaveDialog({
            defaultPath: filename,
            filters: [{ name: 'All Files', extensions: ['*'] }]
          })

          if (result.canceled || !result.filePath) {
            return { success: false, error: 'Save cancelled' }
          }

          destination = result.filePath
        }

        await fs.writeFile(destination, targetAttachment.content)
        logger.info('Saved attachment to', destination)
        return { success: true, data: { path: destination } }
      } catch (err) {
        logger.error('mail:save-attachment error:', err)
        return { success: false, error: String(err) }
      }
    }
  )
}
