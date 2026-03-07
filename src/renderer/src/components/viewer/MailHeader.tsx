import React, { useState } from 'react'
import { Tooltip, Button, Tag } from 'antd'
import {
  StarOutlined,
  StarFilled,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  FileTextOutlined,
  RollbackOutlined
} from '@ant-design/icons'
import type { Message, EmailAddress } from '@shared/types'
import { AccountBadge } from '../common/AccountBadge'
import { formatDateFull } from '../../utils/dateFormat'
import { LabelScoreBreakdown } from '../ai/LabelScoreBreakdown'
import { useAiStore } from '../../store/aiStore'

interface MailHeaderProps {
  message: Message
  onMarkRead?: (isRead: boolean) => void
  onStarToggle?: () => void
  onDelete?: () => void
  onSummarize?: () => void
  onReply?: () => void
}

const MAX_VISIBLE_RECIPIENTS = 3

function RecipientList({ addresses, label }: { addresses: EmailAddress[]; label: string }) {
  const [expanded, setExpanded] = useState(false)

  if (addresses.length === 0) return null

  const visible = expanded ? addresses : addresses.slice(0, MAX_VISIBLE_RECIPIENTS)
  const hiddenCount = addresses.length - MAX_VISIBLE_RECIPIENTS

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
      <span style={{ color: '#a0a0a8', fontSize: 13, flexShrink: 0, lineHeight: '20px' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: '#e2e2e2', lineHeight: '20px' }}>
        {visible.map((addr, i) => (
          <span key={`${addr.email}-${i}`}>
            {addr.name ? (
              <Tooltip title={addr.email}>
                <span>{addr.name}</span>
              </Tooltip>
            ) : (
              <span>{addr.email}</span>
            )}
            {i < visible.length - 1 && <span style={{ color: '#a0a0a8' }}>, </span>}
          </span>
        ))}
        {!expanded && hiddenCount > 0 && (
          <>
            <span style={{ color: '#a0a0a8' }}>, </span>
            <span
              onClick={() => setExpanded(true)}
              style={{
                color: '#4f9eff',
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              and {hiddenCount} more
            </span>
          </>
        )}
      </span>
    </div>
  )
}

export function MailHeader({ message, onMarkRead, onStarToggle, onDelete, onSummarize, onReply }: MailHeaderProps) {
  const { settings } = useAiStore()
  const threatThreshold = settings?.threatThreshold ?? 0.5

  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid #2a2a2e',
        flexShrink: 0,
        backgroundColor: '#141414'
      }}
    >
      {/* Subject */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#e2e2e2',
          marginBottom: 12,
          lineHeight: 1.3,
          wordBreak: 'break-word'
        }}
      >
        {message.subject || '(No subject)'}
      </div>

      {/* Sender row: avatar + from info on left, actions + date on right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <AccountBadge email={message.fromEmail} name={message.fromName || message.fromEmail} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, color: '#e2e2e2', fontWeight: 500, lineHeight: '20px' }}>
              {message.fromName || message.fromEmail}
            </div>
            {message.fromName && (
              <div
                style={{
                  fontSize: 12,
                  color: '#a0a0a8',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                &lt;{message.fromEmail}&gt;
              </div>
            )}
          </div>
        </div>

        {/* Action buttons + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {onReply && (
            <Tooltip title="Reply">
              <Button
                type="text"
                size="small"
                icon={<RollbackOutlined style={{ color: '#4f9eff' }} />}
                onClick={onReply}
              />
            </Tooltip>
          )}
          {onStarToggle && (
            <Tooltip title={message.isStarred ? 'Unstar' : 'Star'}>
              <Button
                type="text"
                size="small"
                icon={message.isStarred
                  ? <StarFilled style={{ color: '#f5a623' }} />
                  : <StarOutlined style={{ color: '#a0a0a8' }} />
                }
                onClick={onStarToggle}
              />
            </Tooltip>
          )}
          {onMarkRead && (
            <Tooltip title={message.isRead ? 'Mark as unread' : 'Mark as read'}>
              <Button
                type="text"
                size="small"
                icon={message.isRead
                  ? <EyeOutlined style={{ color: '#a0a0a8' }} />
                  : <EyeInvisibleOutlined style={{ color: '#4f9eff' }} />
                }
                onClick={() => onMarkRead(!message.isRead)}
              />
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined style={{ color: '#a0a0a8' }} />}
                onClick={onDelete}
              />
            </Tooltip>
          )}
          {onSummarize && (
            <Tooltip title="Summarize with AI">
              <Button
                type="text"
                size="small"
                icon={<FileTextOutlined style={{ color: '#4f9eff' }} />}
                onClick={onSummarize}
              />
            </Tooltip>
          )}
          <span style={{ fontSize: 12, color: '#a0a0a8', marginLeft: 8, whiteSpace: 'nowrap' }}>
            {formatDateFull(message.date)}
          </span>
        </div>
      </div>

      {/* Recipients */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 42 }}>
        {message.toAddresses.length > 0 && (
          <RecipientList addresses={message.toAddresses} label="To:" />
        )}
        {message.ccAddresses.length > 0 && (
          <RecipientList addresses={message.ccAddresses} label="Cc:" />
        )}
      </div>

      {/* AI Classification detail */}
      {message.aiLabels && Object.keys(message.aiLabels).length > 0 && (
        <div style={{ marginTop: 12, paddingLeft: 42 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {message.aiThreatScore != null && message.aiThreatScore > threatThreshold && (
              <Tag color={message.aiThreatScore > threatThreshold * 1.5 ? 'red' : 'orange'} style={{ fontSize: 11 }}>
                Threat: {Math.round(message.aiThreatScore * 100)}%
              </Tag>
            )}
            {message.aiSentiment && (
              <Tag
                color={message.aiSentiment === 'POSITIVE' ? 'green' : message.aiSentiment === 'NEGATIVE' ? 'red' : 'default'}
                style={{ fontSize: 11 }}
              >
                {message.aiSentiment}
              </Tag>
            )}
          </div>
          <LabelScoreBreakdown labels={message.aiLabels} sentiment={message.aiSentiment} />
        </div>
      )}
    </div>
  )
}
