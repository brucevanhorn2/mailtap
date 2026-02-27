import { app } from 'electron'
import { join } from 'path'

export function getUserDataPath(...segments: string[]): string {
  return join(app.getPath('userData'), ...segments)
}

export function getMailRoot(): string {
  return getUserDataPath('mail')
}

export function getDbPath(): string {
  return getUserDataPath('mailtap.db')
}
