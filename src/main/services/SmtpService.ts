import nodemailer from 'nodemailer'
import { accountService } from './AccountService'
import { logger } from '../utils/logger'
import type { ComposePayload, SendResult } from '@shared/types'

class SmtpService {
  async sendMessage(payload: ComposePayload): Promise<SendResult> {
    try {
      const account = accountService.getAccount(payload.accountId)
      if (!account) {
        return { success: false, error: `Account not found: ${payload.accountId}` }
      }

      if (!account.smtpHost) {
        return { success: false, error: 'SMTP host is not configured for this account' }
      }

      const smtpPassword = accountService.getDecryptedSmtpPassword(payload.accountId)

      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpTls,
        auth: {
          user: account.smtpUser || account.email,
          pass: smtpPassword
        }
      })

      const info = await transporter.sendMail({
        from: `"${account.name}" <${account.email}>`,
        to: payload.to.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', '),
        cc:
          payload.cc.length > 0
            ? payload.cc.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', ')
            : undefined,
        bcc:
          payload.bcc.length > 0
            ? payload.bcc.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', ')
            : undefined,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        inReplyTo: payload.inReplyTo,
        references: payload.references,
        attachments: payload.attachments
      })

      logger.info('SmtpService: sent message', info.messageId)
      return { success: true, messageId: info.messageId }
    } catch (err) {
      logger.error('SmtpService: send failed', err)
      return { success: false, error: String(err) }
    }
  }
}

export const smtpService = new SmtpService()
