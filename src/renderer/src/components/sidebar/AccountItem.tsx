import React from 'react'
import { Dropdown, Modal } from 'antd'
import type { Account } from '@shared/types'
import { useSyncStore } from '../../store/syncStore'
import { AccountBadge } from '../common/AccountBadge'

interface AccountItemProps {
  account: Account
  isSelected: boolean
  unreadCount: number
  onSelect: () => void
  onRemove: () => void
}

function SyncDot({ accountId }: { accountId: string }) {
  const status = useSyncStore((s) => s.statuses[accountId])
  const phase = status?.phase

  let color = '#52e05c' // idle/default = green
  if (phase === 'connecting' || phase === 'listing' || phase === 'fetching') {
    color = '#f5a623' // syncing = yellow
  } else if (phase === 'error') {
    color = '#ff5f5f' // error = red
  }

  const isAnimating = phase === 'connecting' || phase === 'listing' || phase === 'fetching'

  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
        display: 'inline-block',
        animation: isAnimating ? 'pulse 1.5s ease-in-out infinite' : 'none'
      }}
      title={phase ?? 'idle'}
    />
  )
}

export function AccountItem({
  account,
  isSelected,
  unreadCount,
  onSelect,
  onRemove
}: AccountItemProps) {
  const menuItems = [
    {
      key: 'remove',
      label: 'Remove Account',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: 'Remove Account',
          content: `Remove "${account.name}" (${account.email})? All locally synced messages will be deleted.`,
          okText: 'Remove',
          okButtonProps: { danger: true },
          onOk: onRemove
        })
      }
    }
  ]

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
      <div
        onClick={onSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 10px 7px 12px',
          cursor: 'pointer',
          borderRadius: 6,
          backgroundColor: isSelected ? '#1a2a3e' : 'transparent',
          transition: 'background-color 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#1a1a1e'
        }}
        onMouseLeave={(e) => {
          if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
        }}
      >
        <AccountBadge email={account.email} name={account.name} size={30} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isSelected ? '#4f9eff' : '#e2e2e2',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.4
            }}
          >
            {account.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#a0a0a8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.4
            }}
          >
            {account.email}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {unreadCount > 0 && (
            <span
              style={{
                backgroundColor: '#4f9eff',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 10,
                padding: '1px 6px',
                minWidth: 18,
                textAlign: 'center'
              }}
            >
              {unreadCount > 999 ? '999+' : unreadCount}
            </span>
          )}
          <SyncDot accountId={account.id} />
        </div>
      </div>
    </Dropdown>
  )
}
