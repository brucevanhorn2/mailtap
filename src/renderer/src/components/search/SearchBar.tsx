import React, { useEffect, useRef, useCallback } from 'react'
import { Spin } from 'antd'
import { SearchOutlined, CloseOutlined } from '@ant-design/icons'
import type { SearchQuery } from '@shared/types'
import { useSearchStore } from '../../store/searchStore'
import { useMailStore } from '../../store/mailStore'
import { formatDate } from '../../utils/dateFormat'

export function SearchBar() {
  const { isOpen, query, results, loading, closeSearch, setQuery, setResults, setLoading } =
    useSearchStore()
  const setSelectedId = useMailStore((s) => s.setSelectedId)
  const setActiveMailbox = useMailStore((s) => s.setActiveMailbox)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard handler: Escape to close
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeSearch])

  const runSearch = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const q: SearchQuery = { text, limit: 30, offset: 0 }
        const res = await window.mailtap.invoke('search:query', q)
        setResults(res)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [setResults, setLoading]
  )

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value), 300)
  }

  function handleResultClick(messageId: string, accountId: string) {
    setActiveMailbox(accountId, null)
    setSelectedId(messageId)
    closeSearch()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 80
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSearch()
      }}
    >
      <div
        style={{
          width: 580,
          backgroundColor: '#1c1c1e',
          borderRadius: 10,
          border: '1px solid #2a2a2e',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            borderBottom: results.length > 0 || loading ? '1px solid #2a2a2e' : undefined
          }}
        >
          <SearchOutlined style={{ color: '#a0a0a8', fontSize: 16, marginRight: 10 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search emails..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: '#e2e2e2',
              fontSize: 15,
              fontFamily: 'inherit'
            }}
          />
          {loading && <Spin size="small" style={{ marginRight: 8 }} />}
          <span
            onClick={closeSearch}
            style={{
              color: '#a0a0a8',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <CloseOutlined style={{ fontSize: 13 }} />
          </span>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {results.map((r) => (
              <div
                key={r.message.id}
                onClick={() => handleResultClick(r.message.id, r.message.accountId)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #1e1e22'
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor = '#1a1a1e'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 3
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#e2e2e2',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}
                  >
                    {r.message.subject || '(No subject)'}
                  </span>
                  <span style={{ fontSize: 11, color: '#a0a0a8', flexShrink: 0, marginLeft: 12 }}>
                    {formatDate(r.message.date)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#a0a0a8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 2
                  }}
                >
                  {r.message.fromName || r.message.fromEmail}
                </div>
                {r.snippet && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6a6a72',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {r.snippet}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <div
            style={{
              padding: '20px 16px',
              color: '#a0a0a8',
              fontSize: 13,
              textAlign: 'center'
            }}
          >
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}
