import { create } from 'zustand'
import type { Account } from '@shared/types'

interface AccountState {
  accounts: Account[]
  loading: boolean
  error: string | null

  setAccounts: (accounts: Account[]) => void
  addAccount: (account: Account) => void
  removeAccount: (id: string) => void
  updateAccount: (account: Account) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  loading: false,
  error: null,

  setAccounts: (accounts) => set({ accounts }),
  addAccount: (account) => set((s) => ({ accounts: [...s.accounts, account] })),
  removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
  updateAccount: (account) =>
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === account.id ? account : a))
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}))
