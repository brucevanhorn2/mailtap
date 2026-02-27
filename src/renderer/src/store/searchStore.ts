import { create } from 'zustand'
import type { SearchResult } from '@shared/types'

interface SearchState {
  isOpen: boolean
  query: string
  results: SearchResult[]
  loading: boolean

  openSearch: () => void
  closeSearch: () => void
  setQuery: (query: string) => void
  setResults: (results: SearchResult[]) => void
  setLoading: (loading: boolean) => void
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  query: '',
  results: [],
  loading: false,

  openSearch: () => set({ isOpen: true }),
  closeSearch: () => set({ isOpen: false, query: '', results: [] }),
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setLoading: (loading) => set({ loading })
}))
