import type { BrowserWindow } from 'electron'
import type { SyncStatus } from '@shared/types'
import { accountService } from './AccountService'
import { ImapWorker } from './ImapWorker'
import { logger } from '../utils/logger'

class ImapSyncService {
  private workers = new Map<string, ImapWorker>()
  private win: BrowserWindow | null = null

  setWindow(win: BrowserWindow): void {
    this.win = win
  }

  async startAll(): Promise<void> {
    const accounts = accountService.listAccounts()
    const enabled = accounts.filter((a) => a.enabled)
    logger.info(`ImapSyncService: starting ${enabled.length} account(s)`)
    await Promise.all(enabled.map((a) => this.start(a.id)))
  }

  async start(accountId: string): Promise<void> {
    if (!this.win) {
      throw new Error('ImapSyncService: window not set, call setWindow() first')
    }

    // Stop any existing worker for this account
    await this.stop(accountId)

    const account = accountService.getAccount(accountId)
    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    if (!account.enabled) {
      logger.info(`ImapSyncService: skipping disabled account ${accountId}`)
      return
    }

    const worker = new ImapWorker(account, this.win)
    this.workers.set(accountId, worker)
    worker.start()
    logger.info(`ImapSyncService: started worker for account ${accountId}`)
  }

  async stop(accountId: string): Promise<void> {
    const worker = this.workers.get(accountId)
    if (worker) {
      logger.info(`ImapSyncService: stopping worker for account ${accountId}`)
      await worker.stop()
      this.workers.delete(accountId)
    }
  }

  async stopAll(): Promise<void> {
    logger.info(`ImapSyncService: stopping all workers (${this.workers.size})`)
    await Promise.all(Array.from(this.workers.keys()).map((id) => this.stop(id)))
  }

  getStatus(): SyncStatus[] {
    // Status is pushed via IPC events (sync:progress / sync:error)
    return []
  }
}

export const imapSyncService = new ImapSyncService()
