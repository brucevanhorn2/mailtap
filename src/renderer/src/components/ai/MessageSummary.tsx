import React, { useState } from 'react'
import { Button, Spin, Alert, Collapse } from 'antd'
import { RobotOutlined, FileTextOutlined } from '@ant-design/icons'

interface MessageSummaryProps {
  messageId: string
}

export function MessageSummary({ messageId }: MessageSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await window.mailtap.invoke('ai:summarize-message', messageId)
      if (res.success && res.data) {
        setSummary((res.data as { summary: string }).summary)
        setExpanded(true)
      } else {
        setError(res.error ?? 'Failed to generate summary')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  // Reset when message changes
  React.useEffect(() => {
    setSummary(null)
    setError(null)
    setExpanded(false)
  }, [messageId])

  if (!summary && !loading && !error) {
    return (
      <div
        style={{
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderTop: '1px solid #2a2a2e',
          backgroundColor: '#0f0f10'
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<RobotOutlined style={{ color: '#4f9eff' }} />}
          onClick={handleGenerate}
          style={{ color: '#a0a0a8', fontSize: 12 }}
        >
          Summarize with AI
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderTop: '1px solid #2a2a2e',
          backgroundColor: '#0f0f10',
          color: '#a0a0a8',
          fontSize: 13
        }}
      >
        <Spin size="small" />
        <span>Generating summary…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '8px 20px', borderTop: '1px solid #2a2a2e' }}>
        <Alert
          type="warning"
          message="Summary unavailable"
          description={error}
          showIcon
          style={{ fontSize: 12 }}
          action={
            <Button size="small" onClick={handleGenerate}>Retry</Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #2a2a2e', backgroundColor: '#0f0f10' }}>
      <Collapse
        activeKey={expanded ? ['summary'] : []}
        onChange={(keys) => setExpanded(keys.includes('summary'))}
        ghost
        items={[
          {
            key: 'summary',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a0a0a8' }}>
                <FileTextOutlined style={{ color: '#4f9eff' }} />
                AI Summary
              </span>
            ),
            children: (
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: '#c0c0c8',
                  padding: '0 4px 8px',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {summary}
              </div>
            )
          }
        ]}
      />
    </div>
  )
}
