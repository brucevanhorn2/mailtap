import React from 'react'
import {
  InboxOutlined,
  SendOutlined,
  DeleteOutlined,
  FileOutlined,
  StarOutlined,
  WarningOutlined,
  FolderOutlined
} from '@ant-design/icons'
import type { Mailbox } from '@shared/types'

interface FolderItemProps {
  mailbox: Mailbox
  isSelected: boolean
  onSelect: () => void
}

function getFolderIcon(path: string, attributes: string[]): React.ReactElement {
  const lowerPath = path.toLowerCase()
  const lowerAttrs = attributes.map((a) => a.toLowerCase())

  if (lowerPath === 'inbox' || lowerAttrs.includes('\\inbox')) {
    return <InboxOutlined />
  }
  if (lowerPath.includes('sent') || lowerAttrs.includes('\\sent')) {
    return <SendOutlined />
  }
  if (lowerPath.includes('trash') || lowerPath.includes('deleted') || lowerAttrs.includes('\\trash')) {
    return <DeleteOutlined />
  }
  if (lowerPath.includes('draft') || lowerAttrs.includes('\\drafts')) {
    return <FileOutlined />
  }
  if (lowerPath.includes('star') || lowerPath.includes('flagged') || lowerAttrs.includes('\\flagged')) {
    return <StarOutlined />
  }
  if (lowerPath.includes('spam') || lowerPath.includes('junk') || lowerAttrs.includes('\\junk')) {
    return <WarningOutlined />
  }
  return <FolderOutlined />
}

export function FolderItem({ mailbox, isSelected, onSelect }: FolderItemProps) {
  const icon = getFolderIcon(mailbox.path, mailbox.attributes)
  const hasUnread = mailbox.unreadCount > 0

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 14px 5px 36px',
        cursor: 'pointer',
        borderRadius: 4,
        backgroundColor: isSelected ? '#1a2a3e' : 'transparent',
        color: isSelected ? '#4f9eff' : '#a0a0a8',
        fontSize: 13,
        transition: 'background-color 0.15s ease',
        userSelect: 'none'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          ;(e.currentTarget as HTMLDivElement).style.backgroundColor = '#1a1a1e'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
        }
      }}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: hasUnread ? 600 : 400,
          color: isSelected ? '#4f9eff' : hasUnread ? '#e2e2e2' : '#a0a0a8'
        }}
      >
        {mailbox.name}
      </span>
      {hasUnread && (
        <span
          style={{
            backgroundColor: '#4f9eff',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 10,
            padding: '1px 6px',
            minWidth: 18,
            textAlign: 'center',
            flexShrink: 0
          }}
        >
          {mailbox.unreadCount > 999 ? '999+' : mailbox.unreadCount}
        </span>
      )}
    </div>
  )
}
