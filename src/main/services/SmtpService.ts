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
        port: account.smtpPort ?? 587,
        secure: account.smtpTls ?? false,
        auth: {
          user: account.smtpUser || account.email,
          pass: smtpPassword
        }
      })

      const info = await transporter.sendMail({
        from: { name: account.name, address: account.email },
        to: payload.to.map((a) => ({ name: a.name, address: a.email })),
        cc: payload.cc.length > 0 ? payload.cc.map((a) => ({ name: a.name, address: a.email })) : undefined,
        bcc: payload.bcc.length > 0 ? payload.bcc.map((a) => ({ name: a.name, address: a.email })) : undefined,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        inReplyTo: payload.inReplyTo,
        // TODO: RFC 2822 §3.6.4 — references should be the full ancestor chain;
        // currently only the direct parent is available since we don't store the full chain.
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
