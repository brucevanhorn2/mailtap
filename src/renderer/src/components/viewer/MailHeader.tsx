import React, { useState } from 'react'
import { Tooltip } from 'antd'
import type { Message, EmailAddress } from '@shared/types'
import { AccountBadge } from '../common/AccountBadge'
import { formatDateFull } from '../../utils/dateFormat'

interface MailHeaderProps {
  message: Message
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

export function MailHeader({ message }: MailHeaderProps) {
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

      {/* Sender row: avatar + from info on left, date on right */}
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

        {/* Date on right */}
        <div
          style={{
            fontSize: 12,
            color: '#a0a0a8',
            flexShrink: 0,
            lineHeight: '20px',
            paddingTop: 2
          }}
        >
          {formatDateFull(message.date)}
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

      {/* Reply/Forward actions placeholder */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 12,
          paddingLeft: 42
        }}
      >
        <Tooltip title="Coming in v2">
          <button
            disabled
            style={{
              padding: '4px 12px',
              fontSize: 12,
              color: '#a0a0a8',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a2e',
              borderRadius: 6,
              cursor: 'not-allowed',
              opacity: 0.5
            }}
          >
            Reply
          </button>
        </Tooltip>
        <Tooltip title="Coming in v2">
          <button
            disabled
            style={{
              padding: '4px 12px',
              fontSize: 12,
              color: '#a0a0a8',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a2e',
              borderRadius: 6,
              cursor: 'not-allowed',
              opacity: 0.5
            }}
          >
            Forward
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
