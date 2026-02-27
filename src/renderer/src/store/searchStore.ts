import { create } from 'zustand'
import type { SearchResult, SuggestResult } from '@shared/types'

interface SearchState {
  isOpen: boolean
  query: string
  results: SearchResult[]
  total: number
  loading: boolean
  suggestions: SuggestResult[]
  suggestionsLoading: boolean

  openSearch: () => void
  closeSearch: () => void
  setQuery: (query: string) => void
  setResults: (results: SearchResult[], total: number) => void
  setLoading: (loading: boolean) => void
  setSuggestions: (suggestions: SuggestResult[]) => void
  setSuggestionsLoading: (loading: boolean) => void
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  query: '',
  results: [],
  total: 0,
  loading: false,
  suggestions: [],
  suggestionsLoading: false,

  openSearch: () => set({ isOpen: true }),
  closeSearch: () =>
    set({ isOpen: false, query: '', results: [], total: 0, suggestions: [] }),
  setQuery: (query) => set({ query }),
  setResults: (results, total) => set({ results, total }),
  setLoading: (loading) => set({ loading }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setSuggestionsLoading: (suggestionsLoading) => set({ suggestionsLoading })
}))
