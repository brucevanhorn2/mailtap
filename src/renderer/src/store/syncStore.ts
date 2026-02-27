import { create } from 'zustand'
import type { SyncStatus } from '@shared/types'

interface SyncState {
  statuses: Record<string, SyncStatus>

  updateStatus: (status: SyncStatus) => void
  setComplete: (accountId: string) => void
  setError: (accountId: string, error: string, recoverable: boolean) => void
  clearStatus: (accountId: string) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  statuses: {},

  updateStatus: (status) =>
    set((s) => ({
      statuses: { ...s.statuses, [status.accountId]: status }
    })),
  setComplete: (accountId) =>
    set((s) => ({
      statuses: {
        ...s.statuses,
        [accountId]: { accountId, phase: 'idle' }
      }
    })),
  setError: (accountId, error, _recoverable) =>
    set((s) => ({
      statuses: {
        ...s.statuses,
        [accountId]: { accountId, phase: 'error', error }
      }
    })),
  clearStatus: (accountId) =>
    set((s) => {
      const next = { ...s.statuses }
      delete next[accountId]
      return { statuses: next }
    })
}))
