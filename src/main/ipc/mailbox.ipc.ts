import { ipcMain } from 'electron'
import { mailRepository } from '../services/MailRepository'

export function registerMailboxIpc(): void {
  ipcMain.handle('mailbox:list', async (_event, accountId?: string) => {
    return mailRepository.listMailboxes(accountId)
  })

  ipcMain.handle('mailbox:unread-counts', async () => {
    return mailRepository.getUnreadCounts()
  })
}
