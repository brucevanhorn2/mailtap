import { useState, useEffect, useCallback } from 'react'
import { useMailStore } from '../store/mailStore'
import type { Message } from '@shared/types'

export function useMailViewer() {
  const { selectedId, messages } = useMailStore()
  const [showExternalImages, setShowExternalImages] = useState(false)
  const [hasExternalImages, setHasExternalImages] = useState(false)

  const selectedMessage: Message | null = messages.find((m) => m.id === selectedId) ?? null

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
