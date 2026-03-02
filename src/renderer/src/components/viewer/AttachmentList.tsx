import React from 'react'
import { PaperClipOutlined } from '@ant-design/icons'
import type { Attachment } from '@shared/types'

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

  async function handleDownload(attachment: Attachment) {
    if (disabled) return
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
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            onClick={() => handleDownload(attachment)}
            title={disabled
              ? 'Downloads disabled — this email was flagged as a potential threat'
              : `Download ${attachment.filename}`
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              backgroundColor: '#1c1c1e',
              border: '1px solid #2a2a2e',
              borderRadius: 8,
              cursor: disabled ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              color: '#e2e2e2',
              fontSize: 13,
              fontFamily: 'inherit',
              opacity: disabled ? 0.4 : 1,
              transition: 'background-color 0.15s ease, border-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (disabled) return
              const el = e.currentTarget
              el.style.backgroundColor = '#252528'
              el.style.borderColor = '#4f9eff'
            }}
            onMouseLeave={(e) => {
              if (disabled) return
              const el = e.currentTarget
              el.style.backgroundColor = '#1c1c1e'
              el.style.borderColor = '#2a2a2e'
            }}
          >
            <PaperClipOutlined style={{ color: '#a0a0a8', fontSize: 13 }} />
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
            <span style={{ color: '#a0a0a8', fontSize: 11, flexShrink: 0 }}>
              {formatFileSize(attachment.sizeBytes)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
