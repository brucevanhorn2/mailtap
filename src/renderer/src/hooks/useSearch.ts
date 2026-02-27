import { useCallback } from 'react'
import { useSearchStore } from '../store/searchStore'
import { parseQuery } from '../utils/searchParser'

export function useSearch() {
  const { isOpen, query, results, total, loading, openSearch, closeSearch, setQuery, setResults, setLoading } =
    useSearchStore()

  const search = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setResults([], 0)
        return
      }
      setLoading(true)
      try {
        const { query: parsedQuery } = parseQuery(text)
        const page = await window.mailtap.invoke('search:query', parsedQuery)
        setResults(page.results, page.total)
      } catch {
        setResults([], 0)
      } finally {
        setLoading(false)
      }
    },
    [setResults, setLoading]
  )

  return { isOpen, query, results, total, loading, openSearch, closeSearch, setQuery, search }
}
