import winston from 'winston'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const isDev = process.env.NODE_ENV === 'development'

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, meta }) => {
    const metaStr = meta && (meta as unknown[]).length ? ' ' + JSON.stringify(meta) : ''
    return `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}${metaStr}`
  })
)

const winstonLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  transports: isDev
    ? [
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
      ]
    : []
})

let fileTransport: InstanceType<typeof winston.transports.File> | null = null

export function initLogger(enableLogging: boolean): void {
  const logDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logDir, { recursive: true })
  fileTransport = new winston.transports.File({
    filename: join(logDir, 'mailtap.log'),
    maxsize: 5 * 1024 * 1024,
    maxFiles: 3,
    silent: !enableLogging
  })
  winstonLogger.add(fileTransport)
}

export function setFileLogging(enabled: boolean): void {
  if (fileTransport) fileTransport.silent = !enabled
}

export const logger = {
  debug: (message: string, ...meta: unknown[]) => winstonLogger.debug(message, { meta }),
  info: (message: string, ...meta: unknown[]) => winstonLogger.info(message, { meta }),
  warn: (message: string, ...meta: unknown[]) => winstonLogger.warn(message, { meta }),
  error: (message: string, ...meta: unknown[]) => winstonLogger.error(message, { meta })
}
