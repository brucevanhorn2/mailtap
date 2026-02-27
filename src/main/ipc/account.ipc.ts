import { ipcMain } from 'electron'
import { accountService } from '../services/AccountService'
import { imapSyncService } from '../services/ImapSyncService'
import { createImapClient } from '../services/ImapConnection'
import type { AddAccountPayload, UpdateAccountPayload } from '@shared/types'

export function registerAccountIpc(): void {
  ipcMain.handle('account:list', async () => {
    return accountService.listAccounts()
  })

  ipcMain.handle('account:add', async (_event, payload: AddAccountPayload) => {
    try {
      const account = accountService.addAccount(payload)
      // Auto-start sync for the new account
      await imapSyncService.start(account.id)
      return { success: true, data: account }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('account:remove', async (_event, id: string) => {
    try {
      await imapSyncService.stop(id)
      accountService.removeAccount(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('account:update', async (_event, payload: UpdateAccountPayload) => {
    try {
      const account = accountService.updateAccount(payload)
      return { success: true, data: account }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('account:test-connection', async (_event, payload: AddAccountPayload) => {
    // Create a temporary ImapFlow client with the provided credentials
    // Connect, list mailboxes, disconnect
    // Return { success, mailboxCount } or { success: false, error }
    const tempCreds = {
      ...payload,
      id: 'test',
      enabled: true,
      createdAt: Date.now()
    }
    const client = createImapClient(tempCreds as any)
    try {
      await client.connect()
      const mailboxes = await client.list()
      await client.logout()
      return { success: true, mailboxCount: mailboxes.length }
    } catch (err) {
      try { await client.logout() } catch {}
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('account:oauth-start', async (_event, provider: string) => {
    return { success: false, error: `OAuth not yet implemented for ${provider}` }
  })
}
