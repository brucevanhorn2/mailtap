import { create } from 'zustand'
import type { Message, MailListFilter } from '@shared/types'

interface MailState {
  messages: Message[]
  total: number
  selectedId: string | null
  activeMailboxId: string | null
  activeAccountId: string | null
  loading: boolean
  offset: number
  activeFilters: MailListFilter

  setMessages: (messages: Message[], total: number) => void
  appendMessages: (messages: Message[], total: number) => void
  setSelectedId: (id: string | null) => void
  setActiveMailbox: (accountId: string | null, mailboxId: string | null) => void
  markRead: (id: string, isRead: boolean) => void
  markStarred: (id: string, isStarred: boolean) => void
  removeMessage: (id: string) => void
  setLoading: (loading: boolean) => void
  setOffset: (offset: number) => void
  prependMessages: (messages: Message[]) => void
  refreshCounter: number
  triggerRefresh: () => void
  setActiveFilters: (filters: MailListFilter) => void
  clearFilters: () => void
  addFilter: (partial: Partial<MailListFilter>) => void
  removeFilter: (key: keyof MailListFilter) => void
}

export const useMailStore = create<MailState>((set) => ({
  messages: [],
  total: 0,
  selectedId: null,
  activeMailboxId: null,
  activeAccountId: null,
  loading: false,
  offset: 0,
  refreshCounter: 0,
  activeFilters: {},

  setMessages: (messages, total) => set({ messages, total, offset: messages.length }),
  appendMessages: (messages, total) =>
    set((s) => ({
      messages: [...s.messages, ...messages],
      total,
      offset: s.messages.length + messages.length
    })),
  setSelectedId: (id) => set({ selectedId: id }),
  setActiveMailbox: (accountId, mailboxId) =>
    set({
      activeAccountId: accountId,
      activeMailboxId: mailboxId,
      messages: [],
      total: 0,
      offset: 0,
      selectedId: null
    }),
  markRead: (id, isRead) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, isRead } : m))
    })),
  markStarred: (id, isStarred) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, isStarred } : m))
    })),
  removeMessage: (id) =>
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId
    })),
  setLoading: (loading) => set({ loading }),
  setOffset: (offset) => set({ offset }),
  prependMessages: (messages) =>
    set((s) => ({
      messages: [...messages, ...s.messages],
      total: s.total + messages.length
    })),
  triggerRefresh: () => set((s) => ({ refreshCounter: s.refreshCounter + 1 })),
  setActiveFilters: (filters) => set({ activeFilters: filters, messages: [], total: 0, offset: 0 }),
  clearFilters: () => set({ activeFilters: {}, messages: [], total: 0, offset: 0 }),
  addFilter: (partial) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, ...partial }, messages: [], total: 0, offset: 0 })),
  removeFilter: (key) =>
    set((s) => {
      const next = { ...s.activeFilters }
      delete next[key]
      return { activeFilters: next, messages: [], total: 0, offset: 0 }
    })
}))
