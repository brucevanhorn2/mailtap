import { promises as fs } from 'fs'
import { join, resolve, sep } from 'path'
import { getMailRoot } from '../utils/paths'
import { logger } from '../utils/logger'

class EmlStore {
  private readonly mailRoot: string

  constructor(mailRoot: string) {
    this.mailRoot = mailRoot
  }

  /**
   * Build a safe filename for an EML file.
   * If messageId is provided: strip <>, replace forbidden chars with _, truncate to 200, append .eml
   * Otherwise: uid_{uid}_{mailboxId.slice(0,20)}.eml
   */
  buildFilename(messageId: string | null, uid: number, mailboxId: string): string {
    if (messageId) {
      // Strip surrounding angle brackets
      const stripped = messageId.replace(/^<|>$/g, '')
      // Replace filesystem-unsafe characters
      const safe = stripped.replace(/[/\\:*?"<>|]/g, '_')
      // Truncate to 200 characters (leaving room for .eml extension)
      const truncated = safe.slice(0, 200)
      return `${truncated}.eml`
    }
    return `uid_${uid}_${mailboxId.slice(0, 20)}.eml`
  }

  /**
   * Save an EML file to {mailRoot}/{accountId}/{year}/{MM}/{filename}.
   * Creates intermediate directories as needed.
   * Returns the absolute path of the saved file.
   */
  async save(
    accountId: string,
    year: number,
    month: number,
    filename: string,
    data: Buffer
  ): Promise<string> {
    const mm = String(month).padStart(2, '0')
    const dir = join(this.mailRoot, accountId, String(year), mm)
    await fs.mkdir(dir, { recursive: true })
    const filePath = join(dir, filename)
    await fs.writeFile(filePath, data)
    logger.info('Saved EML:', filePath)
    return filePath
  }

  /**
   * Read an EML file and return its contents as a Buffer.
   * Rejects paths that escape the mail root to prevent path traversal.
   */
  async read(emlPath: string): Promise<Buffer> {
    const resolved = resolve(emlPath)
    if (!resolved.startsWith(this.mailRoot + sep) && resolved !== this.mailRoot) {
      throw new Error(`Path traversal rejected: ${emlPath}`)
    }
    return fs.readFile(resolved)
  }

  /**
   * Check whether an EML file exists.
   */
  async exists(emlPath: string): Promise<boolean> {
    try {
      await fs.access(emlPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Recursively walk mailRoot and yield all .eml files with their accountId.
   * The accountId is the first path segment under mailRoot.
   */
  async *walkAllEml(
    mailRoot: string
  ): AsyncGenerator<{ emlPath: string; accountId: string }> {
    async function* walk(dir: string, accountId: string): AsyncGenerator<{ emlPath: string; accountId: string }> {
      let entries: import('fs').Dirent[]
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch (err) {
        logger.warn('walkAllEml: cannot read dir', dir, err)
        return
      }

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          yield* walk(fullPath, accountId)
        } else if (entry.isFile() && entry.name.endsWith('.eml')) {
          yield { emlPath: fullPath, accountId }
        }
      }
    }

    // Top-level entries under mailRoot are account directories
    let accountDirs: import('fs').Dirent[]
    try {
      accountDirs = await fs.readdir(mailRoot, { withFileTypes: true })
    } catch {
      logger.warn('walkAllEml: mail root does not exist or cannot be read:', mailRoot)
      return
    }

    for (const entry of accountDirs) {
      if (entry.isDirectory()) {
        const accountId = entry.name
        const accountDir = join(mailRoot, accountId)
        yield* walk(accountDir, accountId)
      }
    }
  }
}

export const emlStore = new EmlStore(getMailRoot())
