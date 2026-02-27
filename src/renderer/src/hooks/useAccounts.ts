import { useEffect, useCallback } from 'react'
import { useAccountStore } from '../store/accountStore'
import type { Account, AddAccountPayload, ConnectionTestResult, IpcResult } from '@shared/types'

export function useAccounts() {
  const { accounts, loading, error, setAccounts, addAccount, removeAccount, setLoading, setError } =
    useAccountStore()

  const loadAccounts = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.mailtap.invoke('account:list')
      setAccounts(result)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [setAccounts, setLoading, setError])

  const addAccountFn = useCallback(
    async (payload: AddAccountPayload): Promise<IpcResult<Account>> => {
      const result = await window.mailtap.invoke('account:add', payload)
      if (result.success && result.data) {
        addAccount(result.data)
      }
      return result
    },
    [addAccount]
  )

  const removeAccountFn = useCallback(
    async (id: string): Promise<void> => {
      const result = await window.mailtap.invoke('account:remove', id)
      if (result.success) {
        removeAccount(id)
      }
    },
    [removeAccount]
  )

  const testConnection = useCallback(
    async (payload: AddAccountPayload): Promise<ConnectionTestResult> => {
      return window.mailtap.invoke('account:test-connection', payload)
    },
    []
  )

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return {
    accounts,
    loading,
    error,
    loadAccounts,
    addAccount: addAccountFn,
    removeAccount: removeAccountFn,
    testConnection
  }
}
