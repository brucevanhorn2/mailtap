import React from 'react'
import { Spin } from 'antd'
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useSyncStore } from '../../store/syncStore'

export function SyncStatusIndicator() {
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
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: '#a0a0a8',
        flexShrink: 1,
        minWidth: 100,
        overflow: 'hidden'
      }}
    >
      {isAnySyncing ? (
        <>
          <Spin size="small" />
          <span style={{ color: '#e2e2e2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {syncingStatus?.mailboxName
              ? `Syncing ${syncingStatus.mailboxName}`
              : 'Syncing'}
            {syncingStatus?.current !== undefined &&
            syncingStatus?.total !== undefined &&
            syncingStatus.total > 0
              ? ` (${syncingStatus.current}/${syncingStatus.total})`
              : '…'}
          </span>
        </>
      ) : hasErrors ? (
        <>
          <ExclamationCircleOutlined style={{ color: '#ff5f5f', fontSize: 13 }} />
          <span style={{ color: '#ff5f5f', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {errors[0]?.error ?? 'Sync error'}
          </span>
        </>
      ) : (
        <>
          <CheckCircleOutlined style={{ color: '#52e05c', fontSize: 13 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>All caught up</span>
        </>
      )}
    </div>
  )
}
