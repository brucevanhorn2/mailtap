import React, { useEffect, useRef, useCallback } from 'react'
import { Spin, Empty, Progress } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { MailListQuery } from '@shared/types'
import { useMailStore } from '../../store/mailStore'
import { useSyncStore } from '../../store/syncStore'
import { MailListItem } from '../mail/MailListItem'
import { ErrorBanner } from '../common/ErrorBanner'

const PAGE_SIZE = 50

export function MailListPane() {
  const {
    messages,
    total,
    selectedId,
    activeMailboxId,
    activeAccountId,
    loading,
    offset,
    setMessages,
    appendMessages,
    setSelectedId,
    markRead,
    markStarred,
    setLoading,
    refreshCounter
  } = useMailStore()

  const syncStatuses = useSyncStore((s) => s.statuses)
  const syncStatus = activeAccountId
    ? syncStatuses[activeAccountId]
    : Object.values(syncStatuses).find(
        (s) => s.phase === 'fetching' || s.phase === 'connecting' || s.phase === 'listing'
      )

  const [error, setError] = React.useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  const loadMessages = useCallback(
    async (reset = true) => {
      if (loading && !reset) return
      setLoading(true)
      setError(null)
      try {
        const query: MailListQuery = {
          accountId: activeAccountId ?? undefined,
          mailboxId: activeMailboxId ?? undefined,
          limit: PAGE_SIZE,
          offset: reset ? 0 : offset
        }
        const result = await window.mailtap.invoke('mail:list', query)
        if (reset) {
          setMessages(result.messages, result.total)
        } else {
          appendMessages(result.messages, result.total)
        }
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
        loadingMoreRef.current = false
      }
    },
    [activeAccountId, activeMailboxId, offset, loading, setMessages, appendMessages, setLoading]
  )

  // Reload when active mailbox changes
  useEffect(() => {
    loadMessages(true)
    // Scroll to top when mailbox changes
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, activeMailboxId])

  // Reload when new messages arrive during sync
  useEffect(() => {
    if (refreshCounter > 0) loadMessages(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCounter])

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (loadingMoreRef.current) return
    if (messages.length >= total) return

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 120) {
      loadingMoreRef.current = true
      loadMessages(false)
    }
  }, [messages.length, total, loadMessages])

  async function handleSelect(id: string) {
    setSelectedId(id)
    const msg = messages.find((m) => m.id === id)
    if (msg && !msg.isRead) {
      try {
        await window.mailtap.invoke('mail:mark-read', id, true)
        markRead(id, true)
      } catch {
        // non-critical
      }
    }
  }

  async function handleStarToggle(id: string) {
    const msg = messages.find((m) => m.id === id)
    if (!msg) return
    const newStarred = !msg.isStarred
    markStarred(id, newStarred)
    // Optimistic — no IPC for star in current API, so just update local state
  }

  const getFolderTitle = () => {
    if (!activeAccountId && !activeMailboxId) return 'All Mail'
    if (activeAccountId && !activeMailboxId) return 'Account Inbox'
    return 'Inbox'
  }

  const unreadCount = messages.filter((m) => !m.isRead).length

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRight: '1px solid #2a2a2e',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#141414'
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #2a2a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          minHeight: 44
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e2e2' }}>
          {getFolderTitle()}
        </span>
        {unreadCount > 0 && (
          <span
            style={{
              fontSize: 12,
              color: '#a0a0a8',
              backgroundColor: '#1c1c1e',
              borderRadius: 10,
              padding: '1px 8px'
            }}
          >
            {unreadCount} unread
          </span>
        )}
      </div>

      {/* Inline sync progress strip */}
      {syncStatus && (syncStatus.phase === 'connecting' || syncStatus.phase === 'listing' || syncStatus.phase === 'fetching') && (
        <div
          style={{
            height: 22,
            borderBottom: '1px solid #2a2a2e',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 6,
            flexShrink: 0,
            backgroundColor: '#0f0f0f'
          }}
        >
          {syncStatus.phase === 'connecting' && (
            <>
              <Spin size="small" />
              <span style={{ fontSize: 11, color: '#a0a0a8' }}>Connecting…</span>
            </>
          )}
          {syncStatus.phase === 'listing' && (
            <>
              <Spin size="small" />
              <span style={{ fontSize: 11, color: '#a0a0a8' }}>Loading mailboxes…</span>
            </>
          )}
          {syncStatus.phase === 'fetching' && !syncStatus.total && (
            <>
              <Spin size="small" />
              <span style={{ fontSize: 11, color: '#a0a0a8' }}>Fetching messages…</span>
            </>
          )}
          {syncStatus.phase === 'fetching' && syncStatus.total && (
            <Progress
              percent={Math.round(((syncStatus.current ?? 0) / syncStatus.total) * 100)}
              size="small"
              status="active"
              format={() => `${syncStatus.current ?? 0} of ${syncStatus.total}`}
              style={{ flex: 1, margin: 0 }}
            />
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 12px' }}>
          <ErrorBanner message={error} onRetry={() => loadMessages(true)} />
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {loading && messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 200
            }}
          >
            <Spin size="default" />
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 200
            }}
          >
            <Empty
              image={<InboxOutlined style={{ fontSize: 40, color: '#2a2a2e' }} />}
              description={
                <span style={{ color: '#a0a0a8', fontSize: 13 }}>No messages</span>
              }
            />
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MailListItem
                key={message.id}
                message={message}
                isSelected={selectedId === message.id}
                onSelect={() => handleSelect(message.id)}
                onStarToggle={() => handleStarToggle(message.id)}
              />
            ))}

            {/* Load more indicator */}
            {loading && messages.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: 16
                }}
              >
                <Spin size="small" />
              </div>
            )}

            {messages.length >= total && total > 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 0',
                  color: '#a0a0a8',
                  fontSize: 12
                }}
              >
                {total} message{total !== 1 ? 's' : ''} total
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
