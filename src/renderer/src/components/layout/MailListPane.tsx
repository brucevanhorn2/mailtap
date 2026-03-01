import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { Spin, Empty, Progress, Button, Tooltip, Checkbox } from 'antd'
import {
  InboxOutlined,
  SearchOutlined,
  CloseOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import type { MailListQuery, Message } from '@shared/types'
import { useMailStore } from '../../store/mailStore'
import { useSyncStore } from '../../store/syncStore'
import { MailListItem } from '../mail/MailListItem'
import { ErrorBanner } from '../common/ErrorBanner'
import { parseQuery } from '../../utils/searchParser'

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
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Search state ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMessages, setSearchMessages] = useState<Message[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSearching = searchQuery.trim().length > 0
  const displayMessages = isSearching ? searchMessages : messages

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const allVisibleChecked =
    displayMessages.length > 0 && displayMessages.every((m) => selectedIds.has(m.id))
  const someChecked = selectedIds.size > 0

  // ── Load mail list ────────────────────────────────────────────────────────
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

  // Reload when active mailbox changes; clear search + selection
  useEffect(() => {
    setSearchQuery('')
    setSearchMessages([])
    setSelectedIds(new Set())
    loadMessages(true)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, activeMailboxId])

  // Reload when new messages arrive
  useEffect(() => {
    if (refreshCounter > 0) loadMessages(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCounter])

  // ── Focus search on Ctrl+K ───────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    window.addEventListener('mailtap:focus-search', handler)
    return () => window.removeEventListener('mailtap:focus-search', handler)
  }, [])

  // ── Run search ───────────────────────────────────────────────────────────
  const runSearch = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) {
        setSearchMessages([])
        setSearchTotal(0)
        return
      }
      setSearchLoading(true)
      try {
        const parsed = parseQuery(trimmed)
        const q = {
          ...parsed.query,
          accountId: activeAccountId ?? undefined,
          limit: 100,
          offset: 0
        }
        const page = await window.mailtap.invoke('search:query', q)
        setSearchMessages(page.results.map((r) => r.message))
        setSearchTotal(page.total)
      } catch {
        setSearchMessages([])
        setSearchTotal(0)
      } finally {
        setSearchLoading(false)
      }
    },
    [activeAccountId]
  )

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    setSelectedIds(new Set())
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => runSearch(value), 300)
  }

  function clearSearch() {
    setSearchQuery('')
    setSearchMessages([])
    setSearchTotal(0)
    setSelectedIds(new Set())
    searchInputRef.current?.focus()
  }

  // ── Infinite scroll (regular list only) ─────────────────────────────────
  const handleScroll = useCallback(() => {
    if (isSearching) return
    const el = scrollRef.current
    if (!el) return
    if (loadingMoreRef.current) return
    if (messages.length >= total) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 120) {
      loadingMoreRef.current = true
      loadMessages(false)
    }
  }, [isSearching, messages.length, total, loadMessages])

  // ── Message selection ────────────────────────────────────────────────────
  async function handleSelect(id: string) {
    setSelectedId(id)
    const msg = displayMessages.find((m) => m.id === id)
    if (msg && !msg.isRead) {
      try {
        await window.mailtap.invoke('mail:mark-read', id, true)
        markRead(id, true)
      } catch {
        // non-critical
      }
    }
  }

  function handleCheck(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleAll() {
    if (allVisibleChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayMessages.map((m) => m.id)))
    }
  }

  async function handleStarToggle(id: string) {
    const msg = messages.find((m) => m.id === id)
    if (!msg) return
    markStarred(id, !msg.isStarred)
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────
  async function bulkMarkRead(isRead: boolean) {
    if (bulkLoading) return
    setBulkLoading(true)
    try {
      for (const id of selectedIds) {
        await window.mailtap.invoke('mail:mark-read', id, isRead)
        markRead(id, isRead)
      }
    } finally {
      setBulkLoading(false)
      setSelectedIds(new Set())
    }
  }

  async function bulkDelete() {
    if (bulkLoading) return
    setBulkLoading(true)
    try {
      const toDelete = Array.from(selectedIds)
      for (const id of toDelete) {
        await window.mailtap.invoke('mail:delete', id)
      }
      // Reload the list to reflect deletions
      if (isSearching) {
        runSearch(searchQuery)
      } else {
        loadMessages(true)
      }
      if (toDelete.includes(selectedId ?? '')) setSelectedId(null)
    } finally {
      setBulkLoading(false)
      setSelectedIds(new Set())
    }
  }

  // ── Folder title ─────────────────────────────────────────────────────────
  const folderTitle = useMemo(() => {
    if (isSearching) return `${searchTotal} result${searchTotal !== 1 ? 's' : ''}`
    if (!activeAccountId && !activeMailboxId) return 'All Mail'
    if (activeAccountId && !activeMailboxId) return 'Account Inbox'
    return 'Inbox'
  }, [isSearching, searchTotal, activeAccountId, activeMailboxId])

  const unreadCount = useMemo(
    () => (isSearching ? 0 : messages.filter((m) => !m.isRead).length),
    [isSearching, messages]
  )

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
      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid #2a2a2e',
          flexShrink: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#1c1c1e',
            border: `1px solid ${isSearching ? '#4f9eff55' : '#2a2a2e'}`,
            borderRadius: 6,
            padding: '5px 10px',
            transition: 'border-color 0.15s'
          }}
        >
          {searchLoading ? (
            <Spin size="small" style={{ flexShrink: 0 }} />
          ) : (
            <SearchOutlined style={{ color: '#6a6a72', fontSize: 13, flexShrink: 0 }} />
          )}
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && clearSearch()}
            placeholder="Search mail — try  from:alice  is:unread  has:attachment…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: '#e2e2e2',
              fontSize: 12,
              fontFamily: 'inherit',
              minWidth: 0
            }}
          />
          {isSearching && (
            <span
              onClick={clearSearch}
              style={{ cursor: 'pointer', color: '#6a6a72', display: 'flex', alignItems: 'center' }}
            >
              <CloseOutlined style={{ fontSize: 11 }} />
            </span>
          )}
        </div>
      </div>

      {/* ── Toolbar: folder title / bulk actions ───────────────────────── */}
      <div
        style={{
          padding: '6px 14px',
          borderBottom: '1px solid #2a2a2e',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          minHeight: 36
        }}
      >
        {/* Select-all checkbox */}
        <Checkbox
          checked={allVisibleChecked}
          indeterminate={someChecked && !allVisibleChecked}
          onChange={handleToggleAll}
          style={{ flexShrink: 0 }}
        />

        {someChecked ? (
          <>
            <span style={{ fontSize: 12, color: '#a0a0a8', flex: 1 }}>
              {selectedIds.size} selected
            </span>
            <Tooltip title="Mark as read">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ color: '#a0a0a8' }} />}
                loading={bulkLoading}
                onClick={() => bulkMarkRead(true)}
              />
            </Tooltip>
            <Tooltip title="Mark as unread">
              <Button
                type="text"
                size="small"
                icon={<EyeInvisibleOutlined style={{ color: '#a0a0a8' }} />}
                loading={bulkLoading}
                onClick={() => bulkMarkRead(false)}
              />
            </Tooltip>
            <Tooltip title="Delete selected">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={bulkLoading}
                onClick={bulkDelete}
              />
            </Tooltip>
            <Button
              type="text"
              size="small"
              style={{ color: '#6a6a72', fontSize: 11 }}
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e2e2', flex: 1 }}>
              {folderTitle}
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
          </>
        )}
      </div>

      {/* ── Inline sync progress strip ──────────────────────────────────── */}
      {syncStatus &&
        (syncStatus.phase === 'connecting' ||
          syncStatus.phase === 'listing' ||
          syncStatus.phase === 'fetching') && (
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

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '8px 12px' }}>
          <ErrorBanner message={error} onRetry={() => loadMessages(true)} />
        </div>
      )}

      {/* ── Message list ────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {(loading || searchLoading) && displayMessages.length === 0 ? (
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
        ) : displayMessages.length === 0 ? (
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
                <span style={{ color: '#a0a0a8', fontSize: 13 }}>
                  {isSearching ? 'No results' : 'No messages'}
                </span>
              }
            />
          </div>
        ) : (
          <>
            {displayMessages.map((message) => (
              <MailListItem
                key={message.id}
                message={message}
                isSelected={selectedId === message.id}
                isChecked={selectedIds.has(message.id)}
                showCheckboxes={someChecked}
                onSelect={() => handleSelect(message.id)}
                onCheck={() => handleCheck(message.id)}
                onStarToggle={() => handleStarToggle(message.id)}
              />
            ))}

            {/* Load-more indicator (regular list only) */}
            {!isSearching && loading && messages.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                <Spin size="small" />
              </div>
            )}

            {!isSearching && messages.length >= total && total > 0 && (
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
