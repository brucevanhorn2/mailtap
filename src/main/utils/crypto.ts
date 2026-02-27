import { safeStorage } from 'electron'
import { logger } from './logger'

export function encryptString(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    logger.warn('safeStorage encryption not available — storing plaintext')
    return value
  }
  return safeStorage.encryptString(value).toString('base64')
}

export function decryptString(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return encrypted
  }
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch (err) {
    logger.error('Failed to decrypt string:', err)
    throw new Error('Failed to decrypt credential')
  }
}
