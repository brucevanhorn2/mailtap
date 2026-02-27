import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { Spin } from 'antd'
import { SearchOutlined, CloseOutlined } from '@ant-design/icons'
import type { SuggestResult } from '@shared/types'
import { useSearchStore } from '../../store/searchStore'
import { useMailStore } from '../../store/mailStore'
import { formatDate } from '../../utils/dateFormat'
import {
  parseQuery,
  insertSuggestion,
  tagToSuggestField,
  type FilterChip
} from '../../utils/searchParser'

// ─── Chip pill ────────────────────────────────────────────────────────────────

function Chip({ chip, onRemove }: { chip: FilterChip; onRemove: () => void }) {
  const labels: Record<string, string> = {
    from: 'from',
    to: 'to',
    subject: 'subj',
    body: 'body',
    before: 'before',
    after: 'after',
    is: 'is',
    has: 'has'
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#2a2a3e',
        border: '1px solid #4f9eff44',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 12,
        color: '#c0c0d0',
        flexShrink: 0
      }}
    >
      <span style={{ color: '#4f9eff', fontWeight: 600 }}>{labels[chip.tag] ?? chip.tag}:</span>
      <span>{chip.value}</span>
      <span
        onClick={onRemove}
        style={{ cursor: 'pointer', color: '#6a6a72', marginLeft: 2 }}
        title="Remove filter"
      >
        ×
      </span>
    </span>
  )
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

export function SearchBar() {
  const {
    isOpen,
    query,
    results,
    total,
    loading,
    suggestions,
    suggestionsLoading,
    closeSearch,
    setQuery,
    setResults,
    setLoading,
    setSuggestions,
    setSuggestionsLoading
  } = useSearchStore()

  const setSelectedId = useMailStore((s) => s.setSelectedId)
  const setActiveMailbox = useMailStore((s) => s.setActiveMailbox)

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [activeIndex, setActiveIndex] = useState(-1)

  // Parse the query on every render (cheap computation)
  const { chips, autocomplete } = useMemo(() => parseQuery(query), [query])

  const totalItems = suggestions.length + results.length

  // ── Focus on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // ── Escape key ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeSearch])

  // ── Scroll active item into view ───────────────────────────────────────────
  useEffect(() => {
    if (activeIndex < 0 || !resultsRef.current) return
    const items = resultsRef.current.querySelectorAll('[data-nav-item]')
    const el = items[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // ── Search ─────────────────────────────────────────────────────────────────
  const runSearch = useCallback(
    async (q: ReturnType<typeof parseQuery>['query']) => {
      const hasFilter =
        q.text ||
        q.subject ||
        q.body ||
        q.from ||
        q.to ||
        q.before != null ||
        q.after != null ||
        q.hasAttachment ||
        q.isUnread ||
        q.isStarred
      if (!hasFilter) {
        setResults([], 0)
        return
      }
      setLoading(true)
      try {
        const page = await window.mailtap.invoke('search:query', q)
        setResults(page.results, page.total)
      } catch {
        setResults([], 0)
      } finally {
        setLoading(false)
      }
    },
    [setResults, setLoading]
  )

  // ── Suggest ────────────────────────────────────────────────────────────────
  const runSuggest = useCallback(
    async (ctx: ReturnType<typeof parseQuery>['autocomplete']) => {
      if (!ctx) {
        setSuggestions([])
        return
      }
      // Don't suggest for body (no useful completions)
      if (ctx.tag === 'body') {
        setSuggestions([])
        return
      }
      setSuggestionsLoading(true)
      try {
        const field = tagToSuggestField(ctx.tag)
        const suggs = await window.mailtap.invoke('search:suggest', {
          field,
          prefix: ctx.prefix,
          limit: 8
        })
        setSuggestions(suggs)
      } catch {
        setSuggestions([])
      } finally {
        setSuggestionsLoading(false)
      }
    },
    [setSuggestions, setSuggestionsLoading]
  )

  // ── Input change ───────────────────────────────────────────────────────────
  function handleQueryChange(value: string) {
    setQuery(value)
    setActiveIndex(-1)

    const parsed = parseQuery(value)

    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => runSearch(parsed.query), 300)

    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    suggestTimer.current = setTimeout(() => runSuggest(parsed.autocomplete), 150)
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Tab' && activeIndex >= 0 && activeIndex < suggestions.length) {
      e.preventDefault()
      acceptSuggestion(suggestions[activeIndex])
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault()
        acceptSuggestion(suggestions[activeIndex])
      } else if (activeIndex >= suggestions.length && activeIndex < totalItems) {
        const r = results[activeIndex - suggestions.length]
        if (r) handleResultClick(r.message.id, r.message.accountId)
      }
    }
  }

  // ── Accept suggestion ──────────────────────────────────────────────────────
  function acceptSuggestion(suggestion: SuggestResult) {
    if (!autocomplete) return

    const newQuery = insertSuggestion(
      query,
      suggestion.value,
      autocomplete.tokenStart,
      autocomplete.tag
    )
    setQuery(newQuery)
    setSuggestions([])
    setActiveIndex(-1)

    const parsed = parseQuery(newQuery)

    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => runSearch(parsed.query), 300)

    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    suggestTimer.current = setTimeout(() => runSuggest(parsed.autocomplete), 150)

    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // ── Remove chip ────────────────────────────────────────────────────────────
  function removeChip(chip: FilterChip) {
    const newQuery = (query.slice(0, chip.start) + query.slice(chip.start + chip.raw.length))
      .replace(/\s{2,}/g, ' ')
      .trim()
    handleQueryChange(newQuery)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // ── Result click ───────────────────────────────────────────────────────────
  function handleResultClick(messageId: string, accountId: string) {
    setActiveMailbox(accountId, null)
    setSelectedId(messageId)
    closeSearch()
  }

  if (!isOpen) return null

  const hasResults = results.length > 0
  const hasSuggestions = suggestions.length > 0
  const showEmpty = query.trim() && !loading && !hasResults && !suggestionsLoading

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 72
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSearch()
      }}
    >
      <div
        style={{
          width: 640,
          backgroundColor: '#1c1c1e',
          borderRadius: 10,
          border: '1px solid #2a2a2e',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Search input row ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            gap: 10,
            borderBottom: hasSuggestions || hasResults || loading ? '1px solid #2a2a2e' : undefined,
            flexShrink: 0
          }}
        >
          <SearchOutlined style={{ color: '#a0a0a8', fontSize: 16, flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search — try  from:alice  is:unread  has:attachment…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: '#e2e2e2',
              fontSize: 14,
              fontFamily: 'inherit',
              minWidth: 0
            }}
          />
          {(loading || suggestionsLoading) && (
            <Spin size="small" style={{ flexShrink: 0 }} />
          )}
          <span
            onClick={closeSearch}
            style={{
              color: '#a0a0a8',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <CloseOutlined style={{ fontSize: 13 }} />
          </span>
        </div>

        {/* ── Filter chips row ─────────────────────────────────────────── */}
        {chips.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: '6px 14px',
              borderBottom: '1px solid #2a2a2e',
              flexShrink: 0
            }}
          >
            {chips.map((chip, i) => (
              <Chip key={i} chip={chip} onRemove={() => removeChip(chip)} />
            ))}
          </div>
        )}

        {/* ── Scrollable results area ──────────────────────────────────── */}
        <div ref={resultsRef} style={{ overflowY: 'auto', flex: 1 }}>
          {/* Autocomplete suggestions */}
          {hasSuggestions && (
            <div>
              <div
                style={{
                  padding: '6px 14px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#6a6a72',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                Suggestions
              </div>
              {suggestions.map((s, i) => {
                const isActive = activeIndex === i
                return (
                  <SuggestionItem
                    key={i}
                    suggestion={s}
                    isActive={isActive}
                    hasTag={autocomplete?.tag !== null}
                    onClick={() => acceptSuggestion(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                  />
                )
              })}
              {hasResults && <div style={{ height: 1, backgroundColor: '#2a2a2e', margin: '4px 0' }} />}
            </div>
          )}

          {/* Search results */}
          {hasResults && (
            <div>
              <div
                style={{
                  padding: '6px 14px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#6a6a72',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>Results</span>
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  {total} message{total !== 1 ? 's' : ''}
                </span>
              </div>
              {results.map((r, i) => {
                const itemIndex = suggestions.length + i
                const isActive = activeIndex === itemIndex
                return (
                  <ResultItem
                    key={r.message.id}
                    result={r}
                    isActive={isActive}
                    onClick={() => handleResultClick(r.message.id, r.message.accountId)}
                    onMouseEnter={() => setActiveIndex(itemIndex)}
                  />
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div
              style={{
                padding: '24px 16px',
                color: '#6a6a72',
                fontSize: 13,
                textAlign: 'center'
              }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* ── Footer hint ──────────────────────────────────────────────── */}
        <div
          style={{
            padding: '6px 14px',
            borderTop: '1px solid #1e1e22',
            fontSize: 11,
            color: '#4a4a52',
            display: 'flex',
            gap: 16,
            flexShrink: 0
          }}
        >
          <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>Tab</kbd> accept suggestion</span>
          <span><kbd style={kbdStyle}>Enter</kbd> open</span>
          <span><kbd style={kbdStyle}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 4px',
  borderRadius: 3,
  border: '1px solid #3a3a42',
  backgroundColor: '#252528',
  fontFamily: 'inherit',
  fontSize: 10,
  color: '#6a6a72'
}

interface SuggestionItemProps {
  suggestion: SuggestResult
  isActive: boolean
  hasTag: boolean
  onClick: () => void
  onMouseEnter: () => void
}

function SuggestionItem({ suggestion, isActive, hasTag, onClick, onMouseEnter }: SuggestionItemProps) {
  return (
    <div
      data-nav-item
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        padding: '7px 14px',
        cursor: 'pointer',
        backgroundColor: isActive ? '#252530' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      {/* Tag suggestions get a special prefix glyph */}
      {!hasTag && (
        <span style={{ fontSize: 12, color: '#4f9eff', fontFamily: 'monospace', flexShrink: 0 }}>
          {suggestion.value}
        </span>
      )}
      <span style={{ fontSize: 13, color: isActive ? '#e2e2e2' : '#c0c0d0', flex: 1, minWidth: 0 }}>
        {hasTag ? suggestion.label : suggestion.label.split('—')[1]?.trim()}
      </span>
      {suggestion.count != null && (
        <span style={{ fontSize: 11, color: '#6a6a72', flexShrink: 0 }}>
          {suggestion.count}
        </span>
      )}
    </div>
  )
}

interface ResultItemProps {
  result: { message: import('@shared/types').Message; snippet: string }
  isActive: boolean
  onClick: () => void
  onMouseEnter: () => void
}

function ResultItem({ result, isActive, onClick, onMouseEnter }: ResultItemProps) {
  const { message, snippet } = result
  return (
    <div
      data-nav-item
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        padding: '9px 14px',
        cursor: 'pointer',
        backgroundColor: isActive ? '#252530' : 'transparent',
        borderBottom: '1px solid #1e1e22'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 2
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: message.isRead ? 400 : 600,
            color: '#e2e2e2',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1
          }}
        >
          {message.subject || '(No subject)'}
        </span>
        <span style={{ fontSize: 11, color: '#6a6a72', flexShrink: 0, marginLeft: 12 }}>
          {formatDate(message.date)}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: '#8a8a92',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: snippet ? 2 : 0
        }}
      >
        {message.fromName || message.fromEmail}
      </div>
      {snippet && (
        <div
          style={{ fontSize: 12, color: '#5a5a62', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          dangerouslySetInnerHTML={{ __html: snippet }}
        />
      )}
    </div>
  )
}
