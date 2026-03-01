import React, { useEffect, useState, useRef } from 'react'
import { Spin } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import type { Attachment } from '@shared/types'
import { useMailStore } from '../../store/mailStore'
import { useAiStore } from '../../store/aiStore'
import { ErrorBanner } from '../common/ErrorBanner'
import { MailHeader } from '../viewer/MailHeader'
import { MailBody } from '../viewer/MailBody'
import { AttachmentList } from '../viewer/AttachmentList'
import { MailViewerToolbar } from '../viewer/MailViewerToolbar'
import { MessageSummary } from '../ai/MessageSummary'
import { useMailViewer } from '../../hooks/useMailViewer'
import { useMail } from '../../hooks/useMail'

interface MailBodyData {
  html: string
  text: string
  attachments: Attachment[]
}

export function MailViewerPane() {
  const { selectedId } = useMailStore()
  const { selectedMessage, showExternalImages, hasExternalImages, setHasExternalImages, toggleExternalImages } =
    useMailViewer()
  const { deleteMail, markRead, markStarred } = useMail()
  const aiEnabled = useAiStore((s) => s.enabled)

  const [bodyData, setBodyData] = useState<MailBodyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedId) {
      setBodyData(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setBodyData(null)

    window.mailtap
      .invoke('mail:get-body', selectedId)
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setBodyData(result.data)
        } else {
          setError(result.error ?? 'Failed to load email body')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedId])

  // Reset summary panel when message changes
  useEffect(() => {
    setShowSummary(false)
  }, [selectedId])

  if (!selectedId || !selectedMessage) {
    return (
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#141414',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <MailOutlined style={{ fontSize: 48, color: '#2a2a2e' }} />
        <span style={{ color: '#a0a0a8', fontSize: 14 }}>Select an email to read</span>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#141414',
        overflow: 'hidden'
      }}
    >
      {/* Toolbar */}
      <MailViewerToolbar
        messageId={selectedMessage.id}
        isRead={selectedMessage.isRead}
        isStarred={selectedMessage.isStarred}
        onMarkRead={(isRead) => markRead(selectedMessage.id, isRead)}
        onStarToggle={() => markStarred(selectedMessage.id, !selectedMessage.isStarred)}
        onDelete={() => deleteMail(selectedMessage.id)}
        onSummarize={aiEnabled ? () => {
          setShowSummary(true)
          setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        } : undefined}
      />

      {/* Scrollable content area — block layout so email body can grow taller than viewport */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <MailHeader message={selectedMessage} />

        {/* External images banner */}
        {hasExternalImages && !showExternalImages && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              backgroundColor: '#1c1c1e',
              borderBottom: '1px solid #2a2a2e',
              fontSize: 13,
              color: '#a0a0a8',
              flexShrink: 0
            }}
          >
            <span>External images are blocked.</span>
            <button
              onClick={toggleExternalImages}
              style={{
                background: 'none',
                border: 'none',
                color: '#4f9eff',
                cursor: 'pointer',
                fontSize: 13,
                padding: 0,
                fontFamily: 'inherit',
                textDecoration: 'underline'
              }}
            >
              Show images
            </button>
          </div>
        )}

        {/* Body area */}
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200
            }}
          >
            <Spin size="default" />
          </div>
        ) : error ? (
          <div style={{ padding: '20px' }}>
            <ErrorBanner message={error} />
          </div>
        ) : bodyData ? (
          <MailBody
            html={bodyData.html}
            text={bodyData.text}
            showExternalImages={showExternalImages}
            onExternalImagesDetected={setHasExternalImages}
          />
        ) : null}

        {/* Attachments */}
        {bodyData && bodyData.attachments.length > 0 && selectedId && (
          <AttachmentList attachments={bodyData.attachments} messageId={selectedId} />
        )}

        {/* AI Summary */}
        {aiEnabled && selectedId && showSummary && (
          <div ref={summaryRef}>
            <MessageSummary messageId={selectedId} />
          </div>
        )}
      </div>
    </div>
  )
}
