import React from 'react'
import { PaperClipOutlined, StarFilled, StarOutlined } from '@ant-design/icons'
import type { Message } from '@shared/types'
import { formatDate } from '../../utils/dateFormat'
import { AccountBadge } from '../common/AccountBadge'

interface MailListItemProps {
  message: Message
  isSelected: boolean
  onSelect: () => void
  onStarToggle: () => void
}

export function MailListItem({ message, isSelected, onSelect, onStarToggle }: MailListItemProps) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid #1e1e22',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#1a2a3e' : hovered ? '#1a1a1e' : 'transparent',
        transition: 'background-color 0.1s ease',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        position: 'relative'
      }}
    >
      {/* Unread indicator */}
      {!message.isRead && (
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: '#4f9eff',
            flexShrink: 0
          }}
        />
      )}

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
