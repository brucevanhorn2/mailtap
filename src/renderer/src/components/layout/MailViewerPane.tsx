import React, { useEffect, useState, useRef } from 'react'
import { Spin, Button, Tooltip } from 'antd'
import { CloseOutlined, HomeOutlined, SettingOutlined } from '@ant-design/icons'
import type { Attachment, Message } from '@shared/types'
import { useMailStore } from '../../store/mailStore'
import { useUiStore } from '../../store/uiStore'
import { useAiStore } from '../../store/aiStore'
import { ErrorBanner } from '../common/ErrorBanner'
import { SyncStatusIndicator } from '../common/SyncStatusIndicator'
import { MailHeader } from '../viewer/MailHeader'
import { MailBody } from '../viewer/MailBody'
import { AttachmentList } from '../viewer/AttachmentList'
import { MessageSummary } from '../ai/MessageSummary'
import { AnalyticsHome } from '../ai/AnalyticsHome'
import { useMailViewer } from '../../hooks/useMailViewer'
import { useMail } from '../../hooks/useMail'
import { ComposeModal } from '../compose/ComposeModal'

interface MailBodyData {
  html: string
  text: string
  attachments: Attachment[]
}

export function MailViewerPane() {
  const { selectedId } = useMailStore()
  const setActiveFilters = useMailStore((s) => s.setActiveFilters)
  const { viewerTab, setViewerTab } = useUiStore()
  const { selectedMessage, showExternalImages, hasExternalImages, setHasExternalImages, toggleExternalImages } =
    useMailViewer()
  const { deleteMail, markRead, markStarred } = useMail()
  const aiEnabled = useAiStore((s) => s.enabled)
  const threatThreshold = useAiStore((s) => s.settings?.threatThreshold ?? 0.5)

  const [bodyData, setBodyData] = useState<MailBodyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [allowThreatInteraction, setAllowThreatInteraction] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [replyMessage, setReplyMessage] = useState<Message | undefined>(undefined)

  useEffect(() => {
    if (!selectedId) {
      setBodyData(null)
      setError(null)
      setAllowThreatInteraction(false)
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

  // Auto-switch to message tab when a message is selected
  useEffect(() => {
    if (selectedId) {
      setViewerTab('message')
    }
  }, [selectedId, setViewerTab])

  // Reset summary panel when message changes
  useEffect(() => {
    setShowSummary(false)
  }, [selectedId])

  // Listen for mailtap:show-dashboard event from TitleBar menu
  useEffect(() => {
    const handler = () => setViewerTab('home')
    window.addEventListener('mailtap:show-dashboard', handler)
    return () => window.removeEventListener('mailtap:show-dashboard', handler)
  }, [setViewerTab])

  // Listen for mailtap:compose event from TitleBar menu
  useEffect(() => {
    const handler = () => {
      setReplyMessage(undefined)
      setComposeOpen(true)
    }
    window.addEventListener('mailtap:compose', handler)
    return () => window.removeEventListener('mailtap:compose', handler)
  }, [])

  const isThreat = (selectedMessage?.aiThreatScore ?? 0) > threatThreshold

  // Filter callbacks for AnalyticsHome
  const handleFilterByLabel = (label: string) => {
    setActiveFilters({ aiLabel: label })
  }
  const handleFilterByThreat = (level: 'high' | 'medium') => {
    setActiveFilters({ threatLevel: level })
  }
  const handleFilterBySender = (email: string) => {
    setActiveFilters({ senderEmail: email })
  }
  const handleFilterByDate = (timestamp: number) => {
    // Filter to that day: timestamp to timestamp + 24h
    const dayMs = 24 * 60 * 60 * 1000
    setActiveFilters({ dateFrom: timestamp, dateTo: timestamp + dayMs })
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
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 10px',
          backgroundColor: '#0f0f10',
          borderBottom: '1px solid #2a2a2e',
          flexShrink: 0,
          minHeight: 36
        }}
      >
        {/* Home tab */}
        <button
          onClick={() => setViewerTab('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: viewerTab === 'home' ? 600 : 400,
            color: viewerTab === 'home' ? '#e2e2e2' : '#a0a0a8',
            backgroundColor: viewerTab === 'home' ? '#1a1a1e' : 'transparent',
            border: 'none',
            borderBottom: viewerTab === 'home' ? '2px solid #4f9eff' : '2px solid transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'color 0.15s, background-color 0.15s'
          }}
        >
          <HomeOutlined style={{ fontSize: 13 }} />
          Home
        </button>

        {/* Message tab — only when a message is selected */}
        {selectedId && selectedMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              maxWidth: 300,
              padding: '6px 8px 6px 14px',
              fontSize: 12,
              fontWeight: viewerTab === 'message' ? 600 : 400,
              color: viewerTab === 'message' ? '#e2e2e2' : '#a0a0a8',
              backgroundColor: viewerTab === 'message' ? '#1a1a1e' : 'transparent',
              borderBottom: viewerTab === 'message' ? '2px solid #4f9eff' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, background-color 0.15s'
            }}
          >
            <span
              onClick={() => setViewerTab('message')}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: 1
              }}
            >
              {selectedMessage.subject || '(No subject)'}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation()
                setViewerTab('home')
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 2,
                borderRadius: 3,
                color: '#a0a0a8',
                cursor: 'pointer',
                flexShrink: 0
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2e' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <CloseOutlined style={{ fontSize: 10 }} />
            </span>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Sync status */}
        <SyncStatusIndicator />

        {/* Settings button */}
        <Tooltip title="Settings" placement="bottom">
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => window.dispatchEvent(new CustomEvent('mailtap:settings-open'))}
            style={{ color: '#a0a0a8', width: 32, height: 32, padding: 0, marginLeft: 4 }}
          />
        </Tooltip>
      </div>

      {/* Content area */}
      {viewerTab === 'home' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <AnalyticsHome
            onFilterByLabel={handleFilterByLabel}
            onFilterByThreat={handleFilterByThreat}
            onFilterBySender={handleFilterBySender}
            onFilterByDate={handleFilterByDate}
          />
        </div>
      ) : !selectedId || !selectedMessage ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 16
          }}
        >
          <span style={{ color: '#a0a0a8', fontSize: 14 }}>Select an email to read</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Header */}
          <MailHeader
            message={selectedMessage}
            onMarkRead={(isRead) => markRead(selectedMessage.id, isRead)}
            onStarToggle={() => markStarred(selectedMessage.id, !selectedMessage.isStarred)}
            onDelete={() => deleteMail(selectedMessage.id)}
            onSummarize={aiEnabled ? () => {
              setShowSummary(true)
              setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
            } : undefined}
            onReply={() => {
              setReplyMessage(selectedMessage)
              setComposeOpen(true)
            }}
          />

          {/* Threat warning banner */}
          {isThreat && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 20px',
                backgroundColor: allowThreatInteraction ? '#1a2a1a' : '#2a1a1a',
                borderBottom: allowThreatInteraction ? '1px solid #2a4a2a' : '1px solid #4a2a2a',
                fontSize: 13,
                color: allowThreatInteraction ? '#52c41a' : '#ff7875',
                flexShrink: 0
              }}
            >
              <span>
                {allowThreatInteraction
                  ? 'Threat protection disabled — use with caution'
                  : 'This email was flagged as a potential threat. Links and attachments have been disabled.'}
              </span>
              {!allowThreatInteraction && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setAllowThreatInteraction(true)}
                  style={{ color: '#ff7875', padding: 0, height: 'auto' }}
                >
                  Open Anyway
                </Button>
              )}
            </div>
          )}

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
              isThreat={isThreat && !allowThreatInteraction}
            />
          ) : null}

          {/* Attachments */}
          {bodyData && bodyData.attachments.length > 0 && selectedId && (
            <AttachmentList
              attachments={bodyData.attachments}
              messageId={selectedId}
              disabled={isThreat && !allowThreatInteraction}
            />
          )}

          {/* AI Summary */}
          {aiEnabled && selectedId && showSummary && (
            <div ref={summaryRef}>
              <MessageSummary messageId={selectedId} />
            </div>
          )}
        </div>
      )}

      <ComposeModal
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false)
          setReplyMessage(undefined)
        }}
        replyTo={replyMessage}
      />
    </div>
  )
}
