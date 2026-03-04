import React from 'react'
import { Popconfirm } from 'antd'
import { PaperClipOutlined, WarningOutlined } from '@ant-design/icons'
import type { Attachment } from '@shared/types'
import { isDangerousExtension } from '../../utils/dangerousExtensions'

interface AttachmentListProps {
  attachments: Attachment[]
  messageId: string
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }
  return `${bytes} B`
}

export function AttachmentList({ attachments, messageId, disabled = false }: AttachmentListProps) {
  if (attachments.length === 0) return null

  async function saveAttachment(attachment: Attachment) {
    await window.mailtap.invoke('mail:save-attachment', messageId, attachment.id, '')
  }

  return (
    <div
      style={{
        padding: '12px 20px',
        borderTop: '1px solid #2a2a2e',
        flexShrink: 0,
        backgroundColor: '#141414'
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#a0a0a8',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
          fontWeight: 500
        }}
      >
        {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4
        }}
      >
        {attachments.map((attachment) => {
          const isDangerous = isDangerousExtension(attachment.filename)
          const isBlocked = disabled || isDangerous

          const button = (
            <button
              key={attachment.id}
              onClick={disabled || isDangerous ? undefined : () => saveAttachment(attachment)}
              title={
                disabled
                  ? 'Downloads disabled — this email was flagged as a potential threat'
                  : isDangerous
                    ? `⚠ Executable or script file — click to confirm before saving`
                    : `Download ${attachment.filename}`
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                backgroundColor: isDangerous && !disabled ? '#2a1e0e' : '#1c1c1e',
                border: `1px solid ${isDangerous && !disabled ? '#8b5a00' : isBlocked ? '#2a2a2e' : '#2a2a2e'}`,
                borderRadius: 8,
                cursor: isBlocked ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                color: isDangerous && !disabled ? '#ffa940' : '#e2e2e2',
                fontSize: 13,
                fontFamily: 'inherit',
                opacity: disabled ? 0.4 : 1,
                transition: 'background-color 0.15s ease, border-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (isBlocked) return
                const el = e.currentTarget
                el.style.backgroundColor = isDangerous ? '#3a2a14' : '#252528'
                el.style.borderColor = isDangerous ? '#d48806' : '#4f9eff'
              }}
              onMouseLeave={(e) => {
                if (isBlocked) return
                const el = e.currentTarget
                el.style.backgroundColor = isDangerous ? '#2a1e0e' : '#1c1c1e'
                el.style.borderColor = isDangerous ? '#8b5a00' : '#2a2a2e'
              }}
            >
              {isDangerous && !disabled
                ? <WarningOutlined style={{ color: '#ffa940', fontSize: 13 }} />
                : <PaperClipOutlined style={{ color: '#a0a0a8', fontSize: 13 }} />
              }
              <span
                style={{
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {attachment.filename}
              </span>
              <span style={{ color: isDangerous && !disabled ? '#d48806' : '#a0a0a8', fontSize: 11, flexShrink: 0 }}>
                {formatFileSize(attachment.sizeBytes)}
              </span>
            </button>
          )

          if (isDangerous && !disabled) {
            return (
              <Popconfirm
                key={attachment.id}
                title="Executable or script file"
                description={`"${attachment.filename}" could be harmful. Save it anyway?`}
                onConfirm={() => saveAttachment(attachment)}
                okText="Save anyway"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                placement="top"
              >
                {button}
              </Popconfirm>
            )
          }

          return button
        })}
      </div>
    </div>
  )
}
