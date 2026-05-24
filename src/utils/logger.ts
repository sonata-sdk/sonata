import { createWriteStream, existsSync, mkdirSync, WriteStream } from 'node:fs'
import { dirname } from 'node:path'

const LEVELS = ['trace', 'verbose', 'debug', 'normal', 'warn', 'error'] as const
type Level = typeof LEVELS[number]

const LEVEL_MAP: Record<string, Level> = {
  silly: 'trace',
  info: 'normal',
  fatal: 'error',
}

const COLORS: Record<Level, string> = {
  trace: '\x1b[90m',
  verbose: '\x1b[36m',
  debug: '\x1b[34m',
  normal: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
}

const RESET = '\x1b[0m'

function getTimestamp(fmt: string): string {
  const now = new Date()
  switch (fmt) {
    case 'epoch': return String(now.getTime())
    case 'iso': return now.toISOString()
    case 'relative': return `+${process.uptime().toFixed(3)}s`
    default: return ''
  }
}

function normalizeLevel(level: string): number {
  const mapped = LEVEL_MAP[level.toLowerCase().trim()] ?? level.toLowerCase().trim()
  const idx = LEVELS.indexOf(mapped as Level)
  return idx >= 0 ? idx : LEVELS.indexOf('normal')
}

export class Logger {
  #levelIdx: number
  #format: string
  #colorize: boolean
  #tsFormat: string
  #moduleLevels: Record<string, string>
  #fileCfg: any
  #fileStream: WriteStream | null = null
  #module: string
  #showPid: boolean

  constructor(cfg: {
    level?: string
    format?: string
    colorize?: boolean
    timestampFormat?: string
    moduleLevels?: Record<string, string>
    file?: { enabled?: boolean; path?: string; maxSize?: number; maxFiles?: number; compress?: boolean }
    module?: string
    showPid?: boolean
  }) {
    this.#levelIdx = normalizeLevel(cfg.level ?? 'normal')
    this.#format = cfg.format ?? 'text'
    this.#colorize = cfg.colorize ?? true
    this.#tsFormat = cfg.timestampFormat ?? 'iso'
    this.#moduleLevels = cfg.moduleLevels ?? {}
    this.#module = cfg.module ?? ''
    this.#showPid = cfg.showPid ?? true
    this.#fileCfg = cfg.file ?? null
    if (this.#fileCfg?.enabled && this.#fileCfg.path) {
      const dir = dirname(this.#fileCfg.path)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      this.#fileStream = createWriteStream(this.#fileCfg.path, { flags: 'a' })
    }
  }

  #shouldLog(level: string): boolean {
    const lvl = LEVELS.indexOf(level as Level)
    if (lvl < 0) return false
    if (this.#module && this.#moduleLevels[this.#module]) {
      const modLvl = normalizeLevel(this.#moduleLevels[this.#module])
      return lvl >= modLvl
    }
    return lvl >= this.#levelIdx
  }

  #formatMsg(level: string, module: string, msg: string, args: any[]): string {
    const ts = this.#tsFormat !== 'none' ? getTimestamp(this.#tsFormat) : ''
    const pid = this.#showPid ? `[${process.pid}]` : ''
    const prefix = [ts, pid, `${level.toUpperCase()}`, module ? `[${module}]` : ''].filter(Boolean).join(' ')
    let fullMsg = msg
    if (args.length > 0) {
      const extras = args.map(a => {
        if (a instanceof Error) return a.stack ?? a.message
        if (typeof a === 'object') return JSON.stringify(a)
        return String(a)
      }).join(' ')
      fullMsg = `${msg} ${extras}`
    }
    return `${prefix} ${fullMsg}`
  }

  #write(level: Level, module: string, msg: string, ...args: any[]) {
    if (!this.#shouldLog(level)) return
    const text = this.#formatMsg(level, module, msg, args)
    if (this.#format === 'json') {
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: process.pid,
        level,
        module,
        msg,
        args: args.length > 0 ? args.map(a => a instanceof Error ? a.message : a) : undefined,
      })
      this.#output(level, entry)
    } else {
      this.#output(level, text)
    }
  }

  #output(level: Level, text: string) {
    if (this.#colorize && this.#format === 'text') {
      const color = COLORS[level] ?? RESET
      process.stderr.write(color + text + RESET + '\n')  // use stderr to not interfere with stdout
    } else {
      process.stderr.write(text + '\n')
    }
    if (this.#fileStream) {
      this.#fileStream.write(text + '\n')
    }
  }

  trace(module: string, msg: string, ...args: any[]) { this.#write('trace', module, msg, ...args) }
  verbose(module: string, msg: string, ...args: any[]) { this.#write('verbose', module, msg, ...args) }
  debug(module: string, msg: string, ...args: any[]) { this.#write('debug', module, msg, ...args) }
  info(module: string, msg: string, ...args: any[]) { this.#write('normal', module, msg, ...args) }
  warn(module: string, msg: string, ...args: any[]) { this.#write('warn', module, msg, ...args) }
  error(module: string, msg: string, ...args: any[]) { this.#write('error', module, msg, ...args) }

  child(module: string): Logger {
    return new Logger({
      level: LEVELS[this.#levelIdx],
      format: this.#format,
      colorize: this.#colorize,
      timestampFormat: this.#tsFormat,
      moduleLevels: this.#moduleLevels,
      file: this.#fileCfg,
      module,
      showPid: this.#showPid,
    })
  }
}

export function createLogger(cfg: any): Logger {
  return new Logger({
    level: cfg.level ?? 'normal',
    format: cfg.format ?? 'text',
    colorize: cfg.colorize ?? true,
    timestampFormat: cfg.timestampFormat ?? 'iso',
    moduleLevels: cfg.moduleLevels ?? {},
    file: cfg.file ?? null,
    showPid: cfg.showPid ?? true,
  })
}
