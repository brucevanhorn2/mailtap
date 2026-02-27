import { registerSettingsIpc } from './settings.ipc'
import { registerAccountIpc } from './account.ipc'
import { registerSyncIpc } from './sync.ipc'
import { registerMailIpc } from './mail.ipc'
import { registerSearchIpc } from './search.ipc'
import { registerMailboxIpc } from './mailbox.ipc'
import { registerRebuildIpc } from './rebuild.ipc'

export function registerAllIpc(): void {
  registerSettingsIpc()
  registerAccountIpc()
  registerSyncIpc()
  registerMailIpc()
  registerSearchIpc()
  registerMailboxIpc()
  registerRebuildIpc()
}
