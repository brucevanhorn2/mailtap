import type { SearchQuery, SuggestField } from '@shared/types'

// ─── Public types ─────────────────────────────────────────────────────────────

/** A resolved filter chip shown below the search input */
export interface FilterChip {
  tag: string    // canonical tag: from, to, subject, body, before, after, is, has
  value: string  // resolved value (quotes stripped)
  raw: string    // original text span in the input string (for removal)
  start: number  // char index in the original input string
}

/** What the user is currently typing — drives autocomplete suggestions */
export interface AutocompleteContext {
  tag: string | null  // canonical tag whose value is being typed; null = typing a tag name
  prefix: string      // partial value or partial tag name
  tokenStart: number  // char index in the input where the active token starts
}

export interface ParseResult {
  query: SearchQuery
  chips: FilterChip[]           // completed filter chips (not the active token)
  autocomplete: AutocompleteContext | null
}

// ─── Tag aliases ──────────────────────────────────────────────────────────────

const TAG_CANONICAL: Record<string, string> = {
  from: 'from',
  sender: 'from',
  to: 'to',
  cc: 'cc',
  // bcc — deferred until classification feature (BCC stripped by SMTP on delivery)
  subject: 'subject',
  body: 'body',
  text: 'body',
  before: 'before',
  after: 'after',
  since: 'after',
  is: 'is',
  has: 'has',
  attachment: 'attachment',
  'sent before': 'before',
  'sent after': 'after'
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parseDate(value: string): number | undefined {
  const lower = value.toLowerCase().trim()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (lower) {
    case 'today':
      return today.getTime()
    case 'yesterday':
      return today.getTime() - 86400000
    case 'this week': {
      const d = new Date(today)
      d.setDate(d.getDate() - d.getDay())
      return d.getTime()
    }
    case 'last week': {
      const d = new Date(today)
      d.setDate(d.getDate() - d.getDay() - 7)
      return d.getTime()
    }
    case 'this month':
      return new Date(today.getFullYear(), today.getMonth(), 1).getTime()
    case 'last month':
      return new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime()
  }

  const ts = Date.parse(value)
  return isNaN(ts) ? undefined : ts
}

// ─── Core parser ──────────────────────────────────────────────────────────────

/**
 * Regex that matches filter tags in the input.
 * Groups: [1] tag name (possibly two words), [2] value (quoted or bare word)
 *
 * We use the `gi` flags and call `.exec()` in a loop.
 */
const TAG_RE =
  /(sent\s+(?:before|after)|from|sender|to|cc|subject|body|text|before|after|since|is|has|attachment):(\"[^\"]*\"|\S+)/gi

function applyChipToQuery(chip: FilterChip, q: Partial<SearchQuery>): void {
  switch (chip.tag) {
    case 'from':
      q.from = chip.value
      break
    case 'to':
      q.to = chip.value
      break
    case 'cc':
      // 'cc:me' is a special keyword meaning "I am in the CC field"
      if (chip.value.toLowerCase() === 'me') {
        q.isCcMe = true
      } else {
        q.cc = chip.value
      }
      break
    case 'subject':
      q.subject = chip.value
      break
    case 'body':
      q.body = chip.value
      break
    case 'before': {
      const ts = parseDate(chip.value)
      if (ts != null) q.before = ts
      break
    }
    case 'after': {
      const ts = parseDate(chip.value)
      if (ts != null) q.after = ts
      break
    }
    case 'is':
      if (chip.value === 'unread') q.isUnread = true
      else if (chip.value === 'read') q.isUnread = false
      else if (chip.value === 'starred') q.isStarred = true
      else if (chip.value === 'ccme' || chip.value === 'cc-me') q.isCcMe = true
      else if (chip.value === 'forwarded') q.isForwarded = true
      break
    case 'has':
      if (chip.value === 'attachment' || chip.value === 'attachments') q.hasAttachment = true
      break
    case 'attachment':
      q.attachment = chip.value
      break
  }
}

export function parseQuery(input: string): ParseResult {
  const chips: FilterChip[] = []
  const freeTextParts: string[] = []
  const partialQuery: Partial<SearchQuery> = { limit: 30, offset: 0 }

  TAG_RE.lastIndex = 0
  let match: RegExpExecArray | null
  let lastEnd = 0

  while ((match = TAG_RE.exec(input)) !== null) {
    // Free text before this match
    const before = input.slice(lastEnd, match.index).trim()
    if (before) freeTextParts.push(before)

    const rawTag = match[1].replace(/\s+/g, ' ').toLowerCase()
    const rawValue = match[2]
    const isQuoted = rawValue.startsWith('"')
    const value = isQuoted ? rawValue.slice(1, -1) : rawValue
    const canonical = TAG_CANONICAL[rawTag]

    const matchEnd = match.index + match[0].length
    const isAtEnd = matchEnd === input.length

    if (canonical) {
      const chip: FilterChip = { tag: canonical, value, raw: match[0], start: match.index }
      applyChipToQuery(chip, partialQuery)

      if (isAtEnd) {
        // Active token (user still editing) — contribute to query but not chips list
        // autocomplete will be computed below from the tail
      } else {
        chips.push(chip)
      }
    } else {
      freeTextParts.push(match[0])
    }

    lastEnd = TAG_RE.lastIndex
  }

  // Remaining text after last match
  const tail = input.slice(lastEnd)
  const tailTrimmed = tail.trim()
  if (tailTrimmed) freeTextParts.push(tailTrimmed)

  const textQuery = freeTextParts.join(' ').trim()
  if (textQuery) partialQuery.text = textQuery

  // ── Determine autocomplete context ───────────────────────────────────────
  const autocomplete = getAutocompleteContext(input, lastEnd, tailTrimmed)

  return { query: partialQuery as SearchQuery, chips, autocomplete }
}

/**
 * Find what the user is currently typing at the end of `input`, to drive suggestions.
 *
 * @param input       Full input string
 * @param lastEnd     Index where the last completed regex match ended
 * @param tailTrimmed Trimmed text after the last matched chip
 */
function getAutocompleteContext(
  input: string,
  lastEnd: number,
  _tailTrimmed: string
): AutocompleteContext | null {
  if (!input) return null

  // The "tail" is the portion after all fully-matched chips.
  // The active token is the last whitespace-separated segment of the tail
  // (we don't handle quoted spaces for autocomplete to keep it simple).
  const tail = input.slice(lastEnd)

  if (!tail.trim()) {
    // Input ends with a completed chip and whitespace — no active token
    return null
  }

  // Find the last space in the tail to locate the start of the active token
  const lastSpaceInTail = tail.lastIndexOf(' ')
  const activeToken = tail.slice(lastSpaceInTail + 1)
  const tokenStart = lastEnd + lastSpaceInTail + 1

  if (!activeToken) return null

  const colonIdx = activeToken.indexOf(':')

  if (colonIdx === -1) {
    // Bare word — could be a partial tag name (e.g. "fro") or free text
    // We always surface tag suggestions here so the user can discover filters
    return { tag: null, prefix: activeToken, tokenStart }
  }

  // Has a colon: tag:prefix or tag: (empty prefix)
  const rawTag = activeToken.slice(0, colonIdx).replace(/\s+/g, ' ').toLowerCase()
  const canonical = TAG_CANONICAL[rawTag] ?? null
  const prefix = activeToken.slice(colonIdx + 1)

  return { tag: canonical, prefix, tokenStart }
}

// ─── Suggestion insertion ─────────────────────────────────────────────────────

/**
 * Insert an accepted suggestion into the input string, replacing the active token.
 *
 * @param input       Current input string
 * @param value       The suggestion value (e.g. "john@example.com" or "from:")
 * @param tokenStart  Where the active token starts in `input`
 * @param tag         Canonical tag being valued, or null if completing a tag name
 */
export function insertSuggestion(
  input: string,
  value: string,
  tokenStart: number,
  tag: string | null
): string {
  const before = input.slice(0, tokenStart)

  if (tag) {
    // Completing a tag value: replace `tag:prefix` with `tag:value `
    const needsQuotes = value.includes(' ')
    const formatted = needsQuotes ? `"${value}"` : value
    return `${before}${tag}:${formatted} `
  } else {
    // Completing a tag name: the suggestion already ends with ':'
    // e.g. "fro" → "from:"
    return `${before}${value}`
  }
}

// ─── Field mapping ────────────────────────────────────────────────────────────

/** Map a canonical tag name to the SuggestField the backend expects */
export function tagToSuggestField(tag: string | null): SuggestField {
  switch (tag) {
    case 'from':
      return 'from'
    case 'to':
      return 'to'
    case 'cc':
      return 'cc'
    case 'subject':
      return 'subject'
    case 'before':
    case 'after':
      return 'date'
    case 'is':
      return 'is'
    case 'has':
      return 'has'
    default:
      return 'tag'
  }
}
