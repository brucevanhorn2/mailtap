import { useCallback } from 'react'
import { useSearchStore } from '../store/searchStore'

export function useSearch() {
  const { isOpen, query, results, loading, openSearch, closeSearch, setQuery, setResults, setLoading } =
    useSearchStore()

  const search = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const searchResults = await window.mailtap.invoke('search:query', {
          text: text.trim(),
          limit: 20,
          offset: 0
        })
        setResults(searchResults)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [setResults, setLoading]
  )

  return { isOpen, query, results, loading, openSearch, closeSearch, setQuery, search }
}
