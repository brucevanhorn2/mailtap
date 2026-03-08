import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, Button, Space, Alert, message } from 'antd'
import type { Message, ComposePayload, EmailAddress } from '@shared/types'
import { useAccountStore } from '../../store/accountStore'
import { useMailStore } from '../../store/mailStore'

interface ComposeModalProps {
  open: boolean
  onClose: () => void
  replyTo?: Message
}

type FormValues = {
  accountId: string
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  body: string
}

function parseEmailTag(tag: string): EmailAddress {
  // Accepts "Name <email>" or just "email"
  const match = tag.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() }
  }
  return { name: '', email: tag.trim() }
}

export function ComposeModal({ open, onClose, replyTo }: ComposeModalProps) {
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const [showCcBcc, setShowCcBcc] = useState(false)
  const accounts = useAccountStore((s) => s.accounts)
  const activeAccountId = useMailStore((s) => s.activeAccountId)

  const defaultAccountId =
    replyTo?.accountId ??
    activeAccountId ??
    accounts[0]?.id ??
    ''

  const selectedAccountId = Form.useWatch('accountId', form) ?? defaultAccountId
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const smtpMissing = selectedAccount && !selectedAccount.smtpHost

  // Pre-fill when replying
  useEffect(() => {
    if (!open) return

    if (replyTo) {
      form.setFieldsValue({
        accountId: replyTo.accountId,
        to: [`${replyTo.fromName ? replyTo.fromName + ' <' + replyTo.fromEmail + '>' : replyTo.fromEmail}`],
        cc: [],
        bcc: [],
        subject: replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject ?? ''}`,
        body: ''
      })

      // Fetch plain-text body for quote
      window.mailtap.invoke('mail:get-body', replyTo.id).then((result) => {
        if (result.success && result.data) {
          const quoted = result.data.text
            ? result.data.text
                .split('\n')
                .map((line: string) => `> ${line}`)
                .join('\n')
            : ''
          form.setFieldValue('body', `\n\n--- Original message ---\n${quoted}`)
        }
      })
    } else {
      form.setFieldsValue({
        accountId: defaultAccountId,
        to: [],
        cc: [],
        bcc: [],
        subject: '',
        body: ''
      })
    }
    setShowCcBcc(false)
  }, [open, replyTo, defaultAccountId])

  async function handleSend() {
    setLoading(true)
    try {
      const values = await form.validateFields()

      const payload: ComposePayload = {
        accountId: values.accountId,
        to: values.to.map(parseEmailTag),
        cc: (values.cc ?? []).map(parseEmailTag),
        bcc: (values.bcc ?? []).map(parseEmailTag),
        subject: values.subject,
        text: values.body ?? '',
        inReplyTo: replyTo?.messageId ?? undefined,
        references: replyTo?.messageId ?? undefined
      }

      const result = await window.mailtap.invoke('mail:send', payload)
      if (result.success) {
        message.success('Sent!')
        onClose()
      } else {
        message.error(result.error ?? 'Failed to send message')
      }
    } catch {
      // covers both validation errors and send errors — modal stays open
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={replyTo ? 'Reply' : 'New Message'}
      width={720}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={loading} onClick={handleSend}>
            Send
          </Button>
        </Space>
      }
    >
      {smtpMissing && (
        <Alert
          type="warning"
          message="SMTP not configured for this account. Edit the account to add SMTP settings before sending."
          style={{ marginBottom: 16, fontSize: 12 }}
          showIcon
        />
      )}

      <Form form={form} layout="vertical" size="middle">
        <Form.Item label="From" name="accountId" rules={[{ required: true }]}>
          <Select
            options={accounts.map((a) => ({
              value: a.id,
              label: `${a.name} <${a.email}>`
            }))}
          />
        </Form.Item>

        <Form.Item
          label={
            <span>
              To{' '}
              {!showCcBcc && (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4f9eff',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '0 0 0 8px',
                    fontFamily: 'inherit'
                  }}
                >
                  Cc / Bcc
                </button>
              )}
            </span>
          }
          name="to"
          rules={[{ required: true, message: 'At least one recipient is required', type: 'array', min: 1 }]}
        >
          <Select
            mode="tags"
            tokenSeparators={[',', ';']}
            placeholder="recipient@example.com"
            style={{ width: '100%' }}
          />
        </Form.Item>

        {showCcBcc && (
          <>
            <Form.Item label="Cc" name="cc">
              <Select
                mode="tags"
                tokenSeparators={[',', ';']}
                placeholder="cc@example.com"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Bcc" name="bcc">
              <Select
                mode="tags"
                tokenSeparators={[',', ';']}
                placeholder="bcc@example.com"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}

        <Form.Item
          label="Subject"
          name="subject"
          rules={[{ required: true, message: 'Subject is required' }]}
        >
          <Input placeholder="Subject" />
        </Form.Item>

        <Form.Item label="Message" name="body">
          <Input.TextArea
            autoSize={{ minRows: 8, maxRows: 20 }}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            placeholder="Write your message here..."
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
