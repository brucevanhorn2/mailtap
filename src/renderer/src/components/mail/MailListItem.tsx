import React from 'react'
import { Tooltip } from 'antd'
import { PaperClipOutlined, StarFilled, StarOutlined, WarningOutlined, SmileOutlined, FrownOutlined, MehOutlined } from '@ant-design/icons'
import type { Message } from '@shared/types'
import { formatDate } from '../../utils/dateFormat'
import { AccountBadge } from '../common/AccountBadge'

interface MailListItemProps {
  message: Message
  isSelected: boolean
  isBulkSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onStarToggle: () => void
}

export function MailListItem({
  message,
  isSelected,
  isBulkSelected,
  onSelect,
  onStarToggle
}: MailListItemProps) {
  const [hovered, setHovered] = React.useState(false)

  let bg = 'transparent'
  if (isSelected) bg = '#1a2a3e'
  else if (isBulkSelected) bg = '#1c2030'
  else if (hovered) bg = '#1a1a1e'

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 14px',
        paddingLeft: 11,
        borderBottom: '1px solid #1e1e22',
        borderLeft: (!message.isRead || isBulkSelected) ? '3px solid #4f9eff' : '3px solid transparent',
        cursor: 'pointer',
        backgroundColor: bg,
        transition: 'background-color 0.1s ease',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start'
      }}
    >

      <AccountBadge email={message.fromEmail} name={message.fromName} size={34} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: name + date */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 3,
            gap: 8
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: message.isRead ? 400 : 700,
              color: '#e2e2e2',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0
            }}
          >
            {message.fromName || message.fromEmail}
          </span>
          <span
            style={{
              fontSize: 11,
              color: '#a0a0a8',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
          >
            {formatDate(message.date)}
          </span>
        </div>

        {/* Subject */}
        <div
          style={{
            fontSize: 12,
            fontWeight: message.isRead ? 400 : 600,
            color: message.isRead ? '#a0a0a8' : '#e2e2e2',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 3
          }}
        >
          {message.subject || '(No subject)'}
        </div>

        {/* Bottom row: icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {message.hasAttachments && (
            <PaperClipOutlined style={{ fontSize: 11, color: '#a0a0a8' }} />
          )}
          {(message.aiThreatScore ?? 0) > 0.5 && (
            <Tooltip title={`Threat: ${Math.round((message.aiThreatScore ?? 0) * 100)}%`}>
              <WarningOutlined style={{ fontSize: 11, color: '#ff4d4f' }} />
            </Tooltip>
          )}
          {message.aiLabels && (() => {
            const top = Object.entries(message.aiLabels).sort((a, b) => b[1] - a[1])[0]
            if (!top) return null
            const THREAT_LABELS = new Set(['spam', 'phishing', 'security alert'])
            const color = THREAT_LABELS.has(top[0]) ? '#ff4d4f' : '#4f9eff'
            return (
              <span style={{
                fontSize: 10,
                padding: '0 4px',
                borderRadius: 3,
                backgroundColor: `${color}22`,
                color,
                lineHeight: '16px',
                whiteSpace: 'nowrap',
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {top[0]}
              </span>
            )
          })()}
          {message.aiSentiment && (
            message.aiSentiment === 'POSITIVE' ? (
              <Tooltip title="Sentiment: Positive">
                <SmileOutlined style={{ fontSize: 12, color: '#52c41a', flexShrink: 0 }} />
              </Tooltip>
            ) : message.aiSentiment === 'NEGATIVE' ? (
              <Tooltip title="Sentiment: Negative">
                <FrownOutlined style={{ fontSize: 12, color: '#ff4d4f', flexShrink: 0 }} />
              </Tooltip>
            ) : (
              <Tooltip title="Sentiment: Neutral">
                <MehOutlined style={{ fontSize: 12, color: '#a0a0a8', flexShrink: 0 }} />
              </Tooltip>
            )
          )}
          <span
            onClick={(e) => {
              e.stopPropagation()
              onStarToggle()
            }}
            style={{ cursor: 'pointer', marginLeft: 'auto' }}
          >
            {message.isStarred ? (
              <StarFilled style={{ fontSize: 12, color: '#f5a623' }} />
            ) : (
              <StarOutlined
                style={{
                  fontSize: 12,
                  color: '#a0a0a8',
                  opacity: hovered ? 1 : 0,
                  transition: 'opacity 0.15s'
                }}
              />
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
