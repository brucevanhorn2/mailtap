import Store from 'electron-store'
import { encryptString, decryptString } from '../utils/crypto'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger'
import type { Account, AccountWithCredentials, AddAccountPayload, UpdateAccountPayload } from '@shared/types'

// ─── Store schemas ────────────────────────────────────────────────────────────

interface AccountsStore {
  accounts: Account[]
}

interface CredentialsStore {
  [accountId: string]: {
    encryptedPassword: string
    encryptedSmtpPassword?: string
    encryptedRefreshToken?: string
  }
}

// ─── AccountService ───────────────────────────────────────────────────────────

class AccountService {
  private readonly accountsStore: Store<AccountsStore>
  private readonly credentialsStore: Store<CredentialsStore>

  constructor() {
    this.accountsStore = new Store<AccountsStore>({
      name: 'mailtap-accounts',
      defaults: { accounts: [] }
    })
    this.credentialsStore = new Store<CredentialsStore>({
      name: 'mailtap-credentials',
      defaults: {}
    })
  }

  listAccounts(): Account[] {
    return this.accountsStore.get('accounts', [])
  }

  getAccount(id: string): Account | null {
    const accounts = this.listAccounts()
    return accounts.find((a) => a.id === id) ?? null
  }

  addAccount(payload: AddAccountPayload): Account {
    const id = uuidv4()
    const now = Date.now()

    const account: Account = {
      id,
      name: payload.name,
      email: payload.email,
      provider: payload.provider,
      authMethod: payload.authMethod,
      imapHost: payload.imapHost,
      imapPort: payload.imapPort,
      imapTls: payload.imapTls,
      smtpHost: payload.smtpHost ?? '',
      smtpPort: payload.smtpPort ?? 587,
      smtpTls: payload.smtpTls ?? false,
      smtpUser: payload.smtpUser ?? payload.email,
      syncIntervalMinutes: payload.syncIntervalMinutes,
      enabled: true,
      createdAt: now
    }

    const accounts = this.listAccounts()
    accounts.push(account)
    this.accountsStore.set('accounts', accounts)

    // Encrypt and store password(s) separately
    const encryptedPassword = encryptString(payload.password)
    const creds: CredentialsStore[string] = { encryptedPassword }
    if (payload.smtpPassword) {
      creds.encryptedSmtpPassword = encryptString(payload.smtpPassword)
    }
    this.credentialsStore.set(id, creds)

    logger.info('AccountService: added account', id, payload.email)
    return account
  }

  updateAccount(payload: UpdateAccountPayload): Account {
    const accounts = this.listAccounts()
    const idx = accounts.findIndex((a) => a.id === payload.id)
    if (idx === -1) {
      throw new Error(`Account not found: ${payload.id}`)
    }

    const existing = accounts[idx]
    const updated: Account = {
      ...existing,
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.syncIntervalMinutes !== undefined && {
        syncIntervalMinutes: payload.syncIntervalMinutes
      }),
      ...(payload.enabled !== undefined && { enabled: payload.enabled }),
      ...(payload.smtpHost !== undefined && { smtpHost: payload.smtpHost }),
      ...(payload.smtpPort !== undefined && { smtpPort: payload.smtpPort }),
      ...(payload.smtpTls !== undefined && { smtpTls: payload.smtpTls }),
      ...(payload.smtpUser !== undefined && { smtpUser: payload.smtpUser })
    }

    accounts[idx] = updated
    this.accountsStore.set('accounts', accounts)

    // Update password(s) if provided
    if (payload.password !== undefined || payload.smtpPassword !== undefined) {
      const existing = this.credentialsStore.get(payload.id) ?? { encryptedPassword: '' }
      const updatedCreds = { ...existing }
      if (payload.password !== undefined) {
        updatedCreds.encryptedPassword = encryptString(payload.password)
      }
      if (payload.smtpPassword !== undefined) {
        updatedCreds.encryptedSmtpPassword = encryptString(payload.smtpPassword)
      }
      this.credentialsStore.set(payload.id, updatedCreds)
      logger.info('AccountService: updated credentials for account', payload.id)
    }

    logger.info('AccountService: updated account', payload.id)
    return updated
  }

  removeAccount(id: string): void {
    const accounts = this.listAccounts()
    const filtered = accounts.filter((a) => a.id !== id)
    this.accountsStore.set('accounts', filtered)
    this.credentialsStore.delete(id)
    logger.info('AccountService: removed account', id)
  }

  getDecryptedSmtpPassword(id: string): string {
    const creds = this.credentialsStore.get(id)
    if (!creds) throw new Error(`No credentials stored for account: ${id}`)
    // Fall back to IMAP password if no dedicated SMTP password is set
    if (creds.encryptedSmtpPassword) {
      return decryptString(creds.encryptedSmtpPassword)
    }
    return decryptString(creds.encryptedPassword)
  }

  getCredentials(id: string): AccountWithCredentials {
    const account = this.getAccount(id)
    if (!account) {
      throw new Error(`Account not found: ${id}`)
    }

    const creds = this.credentialsStore.get(id)
    if (!creds) {
      throw new Error(`No credentials stored for account: ${id}`)
    }

    const password = decryptString(creds.encryptedPassword)

    const result: AccountWithCredentials = {
      ...account,
      password
    }

    if (creds.encryptedRefreshToken) {
      result.oauthRefreshToken = decryptString(creds.encryptedRefreshToken)
    }

    return result
  }
}

export const accountService = new AccountService()
