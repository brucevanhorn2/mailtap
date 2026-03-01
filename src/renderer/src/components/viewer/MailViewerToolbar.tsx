import React from 'react'
import { Button, Tooltip, Divider } from 'antd'
import {
  StarOutlined,
  StarFilled,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { useAiStore } from '../../store/aiStore'

interface MailViewerToolbarProps {
  messageId: string
  isRead: boolean
  isStarred: boolean
  onMarkRead: (isRead: boolean) => void
  onStarToggle: () => void
  onDelete: () => void
  onSummarize?: () => void
}

export function MailViewerToolbar({
  isRead,
  isStarred,
  onMarkRead,
  onStarToggle,
  onDelete,
  onSummarize
}: MailViewerToolbarProps) {
  const aiEnabled = useAiStore((s) => s.enabled)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 16px',
        backgroundColor: '#0f0f10',
        borderBottom: '1px solid #2a2a2e',
        flexShrink: 0
      }}
    >
      {/* Star / Unstar */}
      <Tooltip title={isStarred ? 'Unstar' : 'Star'}>
        <Button
          type="text"
          size="small"
          icon={
            isStarred ? (
              <StarFilled style={{ color: '#f5a623' }} />
            ) : (
              <StarOutlined style={{ color: '#a0a0a8' }} />
            )
          }
          onClick={onStarToggle}
          style={{ color: '#a0a0a8' }}
        />
      </Tooltip>

      {/* Mark as read / unread */}
      <Tooltip title={isRead ? 'Mark as unread' : 'Mark as read'}>
        <Button
          type="text"
          size="small"
          icon={
            isRead ? (
              <EyeOutlined style={{ color: '#a0a0a8' }} />
            ) : (
              <EyeInvisibleOutlined style={{ color: '#4f9eff' }} />
            )
          }
          onClick={() => onMarkRead(!isRead)}
          style={{ color: '#a0a0a8' }}
        />
      </Tooltip>

      {/* Delete */}
      <Tooltip title="Delete">
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined style={{ color: '#a0a0a8' }} />}
          onClick={onDelete}
          style={{ color: '#a0a0a8' }}
          danger
        />
      </Tooltip>

      <Divider type="vertical" style={{ borderColor: '#2a2a2e', margin: '0 4px' }} />

      {/* AI Summarize */}
      {aiEnabled && onSummarize && (
        <Tooltip title="Summarize with AI">
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined style={{ color: '#4f9eff' }} />}
            onClick={onSummarize}
            style={{ color: '#a0a0a8' }}
          />
        </Tooltip>
      )}

      <Divider type="vertical" style={{ borderColor: '#2a2a2e', margin: '0 4px' }} />

      {/* Reply — v2 placeholder */}
      <Tooltip title="Coming in v2">
        <Button
          type="text"
          size="small"
          disabled
          style={{ color: '#a0a0a8', opacity: 0.4 }}
        >
          Reply
        </Button>
      </Tooltip>

      {/* Forward — v2 placeholder */}
      <Tooltip title="Coming in v2">
        <Button
          type="text"
          size="small"
          disabled
          style={{ color: '#a0a0a8', opacity: 0.4 }}
        >
          Forward
        </Button>
      </Tooltip>
    </div>
  )
}
