import { useState, useEffect, useCallback } from 'react'
import { useMailStore } from '../store/mailStore'
import type { Message } from '@shared/types'

export function useMailViewer() {
  const { selectedId, messages } = useMailStore()
  const [showExternalImages, setShowExternalImages] = useState(false)
  const [hasExternalImages, setHasExternalImages] = useState(false)
  const [directMessage, setDirectMessage] = useState<Message | null>(null)

  // selectedMessage: prefer the list version (always fresh); fall back to a
  // directly-fetched copy so the viewer doesn't go blank while the list reloads
  // (e.g. after clicking a search result that is not in the current page).
  const selectedMessage: Message | null =
    messages.find((m) => m.id === selectedId) ?? (directMessage?.id === selectedId ? directMessage : null)

  // When selectedId changes, fetch directly from IPC if the message is not
  // already in the current list.  We intentionally omit `messages` from the
  // dep array: we only need the IPC fallback on a *new* selection, not on
  // every list reload.
  useEffect(() => {
    setDirectMessage(null)
    if (!selectedId) return

    // If already in the list at the time this effect fires, no need to fetch.
    const found = messages.find((m) => m.id === selectedId)
    if (found) return

    let cancelled = false
    window.mailtap
      .invoke('mail:get', selectedId)
      .then((msg) => {
        if (!cancelled) setDirectMessage(msg)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const toggleExternalImages = useCallback(() => {
    setShowExternalImages((v) => !v)
  }, [])

  // Reset external image state when message changes
  useEffect(() => {
    setShowExternalImages(false)
    setHasExternalImages(false)
  }, [selectedId])

  return {
    selectedMessage,
    showExternalImages,
    hasExternalImages,
    setHasExternalImages,
    toggleExternalImages
  }
}
