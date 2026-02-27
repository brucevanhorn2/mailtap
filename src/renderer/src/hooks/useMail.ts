import { useCallback } from 'react'
import { useMailStore } from '../store/mailStore'

export function useMail() {
  const store = useMailStore()

  const deleteMail = useCallback(
    async (id: string) => {
      await window.mailtap.invoke('mail:delete', id)
      store.removeMessage(id)
    },
    [store.removeMessage]
  )

  const markRead = useCallback(
    async (id: string, isRead: boolean) => {
      await window.mailtap.invoke('mail:mark-read', id, isRead)
      store.markRead(id, isRead)
    },
    [store.markRead]
  )

  const markStarred = useCallback(
    async (id: string, isStarred: boolean) => {
      // No star IPC yet — just update local store
      store.markStarred(id, isStarred)
    },
    [store.markStarred]
  )

  return { ...store, deleteMail, markRead, markStarred }
}
