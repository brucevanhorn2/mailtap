import { useEffect, useCallback } from 'react'
import { useSyncStore } from '../store/syncStore'
import { useAccountStore } from '../store/accountStore'
import { useMailStore } from '../store/mailStore'

export function useSync() {
  const { statuses, updateStatus, setComplete, setError } = useSyncStore()
  const accounts = useAccountStore((s) => s.accounts)

  const syncAll = useCallback(async (): Promise<void> => {
    for (const account of accounts) {
      try {
        await window.mailtap.invoke('sync:start', account.id)
      } catch (err) {
        console.error(`Failed to start sync for account ${account.id}:`, err)
      }
    }
  }, [accounts])

  const stopAll = useCallback(async (): Promise<void> => {
    for (const account of accounts) {
      try {
        await window.mailtap.invoke('sync:stop', account.id)
      } catch (err) {
        console.error(`Failed to stop sync for account ${account.id}:`, err)
      }
    }
  }, [accounts])

  const isAnySyncing = Object.values(statuses).some(
    (s) => s.phase === 'connecting' || s.phase === 'listing' || s.phase === 'fetching'
  )

  useEffect(() => {
    const unsubProgress = window.mailtap.on('sync:progress', (event) => {
      updateStatus({
        accountId: event.accountId,
        phase: event.phase,
        mailboxName: event.mailboxName,
        current: event.current,
        total: event.total
      })
    })

    const unsubComplete = window.mailtap.on('sync:complete', (accountId) => {
      setComplete(accountId)
    })

    const unsubError = window.mailtap.on('sync:error', (event) => {
      setError(event.accountId, event.error, event.recoverable)
    })

    const unsubNewMessages = window.mailtap.on('mail:new-messages', (event) => {
      const { activeAccountId, triggerRefresh } = useMailStore.getState()
      if (!activeAccountId || activeAccountId === event.accountId) {
        triggerRefresh()
      }
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
      unsubNewMessages()
    }
  }, [updateStatus, setComplete, setError])

  return {
    statuses,
    syncAll,
    stopAll,
    isAnySyncing
  }
}
