import { join } from "path"

export type LogLevel = "debug" | "info" | "warn" | "error"

interface LoggerOptions {
  level?: LogLevel
  logFile?: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Internal logger for DevProc (writes to file, not stdout)
 * This avoids interfering with the TUI
 */
class Logger {
  private level: LogLevel
  private logFile: string | null
  private fileHandle: Bun.FileSink | null = null

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info"
    this.logFile = options.logFile ?? null
  }

  async init(): Promise<void> {
    if (this.logFile) {
      const file = Bun.file(this.logFile)
      this.fileHandle = file.writer()
    }
  }

  async close(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.end()
      this.fileHandle = null
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }

  private formatMessage(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ""
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`
  }

  private async write(level: LogLevel, message: string, meta?: object): Promise<void> {
    if (!this.shouldLog(level)) return

    const formatted = this.formatMessage(level, message, meta)

    if (this.fileHandle) {
      this.fileHandle.write(formatted)
      await this.fileHandle.flush()
    }
  }

  debug(message: string, meta?: object): void {
    this.write("debug", message, meta)
  }

  info(message: string, meta?: object): void {
    this.write("info", message, meta)
  }

  warn(message: string, meta?: object): void {
    this.write("warn", message, meta)
  }

  error(message: string, meta?: object): void {
    this.write("error", message, meta)
  }
}

// Global logger instance
export const logger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) || "info",
  logFile: process.env.LOG_FILE || undefined,
})

export default logger
