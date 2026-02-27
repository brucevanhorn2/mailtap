import React from 'react'
import { Spin } from 'antd'
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useSyncStore } from '../../store/syncStore'

export function SyncStatusBar() {
  const statuses = useSyncStore((s) => s.statuses)

  const statusList = Object.values(statuses)
  const syncing = statusList.filter(
    (s) => s.phase === 'connecting' || s.phase === 'listing' || s.phase === 'fetching'
  )
  const errors = statusList.filter((s) => s.phase === 'error')
  const isAnySyncing = syncing.length > 0
  const hasErrors = errors.length > 0

  const syncingStatus = syncing[0]

  return (
    <div
      style={{
        padding: '8px 14px',
        borderTop: '1px solid #2a2a2e',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 36,
        fontSize: 12,
        color: '#a0a0a8'
      }}
    >
      {isAnySyncing ? (
        <>
          <Spin size="small" />
          <span style={{ color: '#e2e2e2', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {syncingStatus?.mailboxName
              ? `Syncing ${syncingStatus.mailboxName}...`
              : 'Syncing...'}
            {syncingStatus?.current !== undefined && syncingStatus?.total !== undefined && syncingStatus.total > 0
              ? ` (${syncingStatus.current}/${syncingStatus.total})`
              : ''}
          </span>
        </>
      ) : hasErrors ? (
        <>
          <ExclamationCircleOutlined style={{ color: '#ff5f5f', fontSize: 13 }} />
          <span style={{ color: '#ff5f5f', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {errors[0]?.error ?? 'Sync error'}
          </span>
        </>
      ) : (
        <>
          <CheckCircleOutlined style={{ color: '#52e05c', fontSize: 13 }} />
          <span style={{ flex: 1 }}>All caught up</span>
        </>
      )}
    </div>
  )
}
