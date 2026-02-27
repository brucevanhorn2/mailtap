import { ImapFlow } from 'imapflow'
import type { AccountWithCredentials } from '@shared/types'

export function createImapClient(creds: AccountWithCredentials): ImapFlow {
  const authMethod = creds.authMethod

  const auth =
    authMethod === 'oauth2'
      ? { user: creds.email, accessToken: creds.password }
      : { user: creds.email, pass: creds.password }

  return new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapTls,
    auth,
    logger: false,
    emitLogs: false
  })
}
