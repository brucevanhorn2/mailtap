import React, { useState, useRef } from 'react'
import { Modal, Input, Button, Spin, Alert, Tag } from 'antd'
import { SendOutlined, RobotOutlined } from '@ant-design/icons'
import type { SearchResult } from '@shared/types'
import { useMailStore } from '../../store/mailStore'
import { formatDate } from '../../utils/dateFormat'

interface AskMailboxProps {
  open: boolean
  onClose: () => void
}

interface RagAnswer {
  answer: string
  sources: SearchResult[]
}

export function AskMailbox({ open, onClose }: AskMailboxProps) {
  const { setSelectedId } = useMailStore()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RagAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<any>(null)

  const handleAsk = async () => {
    const q = question.trim()
    if (!q) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await window.mailtap.invoke('ai:ask', q, 5)
      if (res.success && res.data) {
        setResult(res.data as RagAnswer)
      } else {
        setError(res.error ?? 'Failed to get answer')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const handleClose = () => {
    setQuestion('')
    setResult(null)
    setError(null)
    onClose()
  }

  const handleSourceClick = (msg: SearchResult['message']) => {
    setSelectedId(msg.id)
    handleClose()
  }

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ color: '#4f9eff' }} />
          Ask about your mail
        </span>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={680}
      afterOpenChange={(v) => { if (v) setTimeout(() => inputRef.current?.focus(), 50) }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Input area */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. What invoices are due this month? Who sent me the project brief?"
            disabled={loading}
            size="large"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleAsk}
            loading={loading}
            disabled={!question.trim()}
            size="large"
          >
            Ask
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#a0a0a8' }}>
            <Spin size="default" />
            <div style={{ marginTop: 12, fontSize: 13 }}>Reading your mail…</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert
            type="error"
            message={error}
            description="Make sure an LLM model is downloaded and initialized in AI Settings."
            showIcon
          />
        )}

        {/* Answer */}
        {result && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Answer text */}
            <div
              style={{
                backgroundColor: '#1a1a2e',
                border: '1px solid #2a2a4e',
                borderRadius: 8,
                padding: 16,
                fontSize: 14,
                lineHeight: 1.7,
                color: '#e2e2e2',
                whiteSpace: 'pre-wrap'
              }}
            >
              {result.answer}
            </div>

            {/* Sources */}
            {result.sources.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: '#a0a0a8', marginBottom: 8, fontWeight: 600 }}>
                  SOURCES ({result.sources.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.sources.map((src, i) => (
                    <div
                      key={src.message.id}
                      onClick={() => handleSourceClick(src.message)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        backgroundColor: '#141414',
                        border: '1px solid #2a2a2e',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13
                      }}
                    >
                      <Tag
                        style={{
                          backgroundColor: '#1a1a2e',
                          borderColor: '#4f9eff44',
                          color: '#4f9eff',
                          minWidth: 20,
                          textAlign: 'center'
                        }}
                      >
                        {i + 1}
                      </Tag>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e2e2e2', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {src.message.subject || '(no subject)'}
                        </div>
                        <div style={{ color: '#a0a0a8', fontSize: 12, marginTop: 2 }}>
                          {src.message.fromName || src.message.fromEmail} · {formatDate(src.message.receivedAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help text */}
        {!result && !loading && !error && (
          <div style={{ color: '#6a6a72', fontSize: 12, lineHeight: 1.6 }}>
            <strong style={{ color: '#a0a0a8' }}>Tips:</strong>{' '}
            Ask in plain English. Searches your indexed messages using semantic + keyword matching.
            Requires an LLM model to be initialized in AI Settings → AI Models.
          </div>
        )}
      </div>
    </Modal>
  )
}
