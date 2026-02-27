import React from 'react'
import { Spin } from 'antd'
import type { SearchResult, Message } from '@shared/types'
import { AccountBadge } from '../common/AccountBadge'
import { formatDate } from '../../utils/dateFormat'

interface SearchResultsProps {
  results: SearchResult[]
  onSelect: (message: Message) => void
  loading: boolean
}

const MAX_SNIPPET_LENGTH = 120

function truncateSnippet(snippet: string): string {
  // Truncate while being mindful of HTML tags — truncate the text representation
  const stripped = snippet.replace(/<\/?b>/g, '')
  if (stripped.length <= MAX_SNIPPET_LENGTH) return snippet

  // Simple truncation: cut at MAX_SNIPPET_LENGTH chars of visible text
  let visibleCount = 0
  let result = ''
  let i = 0
  while (i < snippet.length && visibleCount < MAX_SNIPPET_LENGTH) {
    if (snippet[i] === '<') {
      // Copy tag as-is
      const end = snippet.indexOf('>', i)
      if (end !== -1) {
        result += snippet.slice(i, end + 1)
        i = end + 1
      } else {
        break
      }
    } else {
      result += snippet[i]
      visibleCount++
      i++
    }
  }
  return result + (visibleCount >= MAX_SNIPPET_LENGTH ? '…' : '')
}

export function SearchResults({ results, onSelect, loading }: SearchResultsProps) {
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px'
        }}
      >
        <Spin size="small" />
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
      {results.map((result) => {
        const { message, snippet } = result
        const displaySnippet = snippet ? truncateSnippet(snippet) : ''

        return (
          <div
            key={message.id}
            onClick={() => onSelect(message)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid #1e1e22',
              transition: 'background-color 0.1s ease'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = '#1a1a1e'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
            }}
          >
            {/* Account badge */}
            <div style={{ flexShrink: 0, paddingTop: 2 }}>
              <AccountBadge
                email={message.fromEmail}
                name={message.fromName || message.fromEmail}
                size={28}
              />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Subject + date row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                  marginBottom: 2
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#e2e2e2',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                >
                  {message.subject || '(No subject)'}
                </span>
                <span style={{ fontSize: 11, color: '#a0a0a8', flexShrink: 0 }}>
                  {formatDate(message.date)}
                </span>
              </div>

              {/* From name/email */}
              <div
                style={{
                  fontSize: 12,
                  color: '#a0a0a8',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 3
                }}
              >
                {message.fromName ? (
                  <>
                    <span style={{ color: '#c0c0c8' }}>{message.fromName}</span>
                    <span style={{ marginLeft: 4 }}>&lt;{message.fromEmail}&gt;</span>
                  </>
                ) : (
                  message.fromEmail
                )}
              </div>

              {/* Snippet with FTS5 bold markers rendered */}
              {displaySnippet && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#6a6a72',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  // Safe: FTS5 snippet() only outputs <b> tags which we control
                  dangerouslySetInnerHTML={{ __html: displaySnippet }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
