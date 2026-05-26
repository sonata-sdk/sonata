import { createWriteStream, existsSync, mkdirSync, WriteStream } from 'node:fs'
import { dirname } from 'node:path'
import { inspect } from 'node:util'

const LEVELS = ['trace', 'verbose', 'debug', 'normal', 'warn', 'error'] as const
type Level = typeof LEVELS[number]

const LEVEL_MAP: Record<string, Level> = {
  silly: 'trace',
  info: 'normal',
  fatal: 'error',
}

const RESET = '\x1b[0m'

const LEVEL_STYLES: Record<Level, string> = {
  trace:   '\x1b[100m \x1b[30mTRACE\x1b[0m',
  verbose: '\x1b[46m \x1b[30mVERBOSE\x1b[0m',
  debug:   '\x1b[44m \x1b[97mDEBUG\x1b[0m',
  normal:  '\x1b[42m \x1b[30mINFO\x1b[0m',
  warn:    '\x1b[43m \x1b[30mWARN\x1b[0m',
  error:   '\x1b[41m \x1b[97mERROR\x1b[0m',
}

function timestamp(): string {
  const d = new Date()
  return `[${[
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join(':')}.${String(d.getMilliseconds()).padStart(3, '0')}]`
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

  #formatMsg(level: Level, module: string, msg: string, args: any[]): string {
    let fullMsg = msg
    if (args.length > 0) {
      const extras = args.map(a => {
        if (a instanceof Error) return a.stack ?? a.message
        if (typeof a === 'object') return inspect(a, { depth: 2, colors: false })
        return String(a)
      }).join(' ')
      fullMsg = `${msg} ${extras}`
    }
    const levelStyle = LEVEL_STYLES[level]
    const modPart = module ? `\x1b[1m${module}\x1b[22m >` : ''
    return `${timestamp()} ${levelStyle} >:${modPart} ${fullMsg}`
  }

  #fileLine(level: Level, module: string, msg: string, args: any[]): string {
    const ts = new Date().toISOString()
    let fullMsg = msg
    if (args.length > 0) {
      const extras = args.map(a => {
        if (a instanceof Error) return a.stack ?? a.message
        if (typeof a === 'object') return JSON.stringify(a)
        return String(a)
      }).join(' ')
      fullMsg = `${msg} ${extras}`
    }
    const label = level === 'normal' ? 'INFO' : level.toUpperCase()
    const modPart = module ? ` ${module} >` : ''
    return `[${ts}] [${label}] >:${modPart} ${fullMsg}`
  }

  #write(level: Level, module: string, msg: string, ...args: any[]) {
    if (!this.#shouldLog(level)) return
    if (this.#format === 'json') {
      const entry = {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        level: level === 'normal' ? 'info' : level,
        module,
        msg,
        args: args.length > 0 ? args.map(a => a instanceof Error ? a.message : a) : undefined,
      }
      if (this.#colorize) {
        process.stderr.write(JSON.stringify(entry) + '\n')
      } else {
        process.stderr.write(JSON.stringify(entry) + '\n')
      }
    } else {
      const text = this.#formatMsg(level, module, msg, args)
      if (this.#colorize) {
        process.stderr.write(text + '\n')
      } else {
        process.stderr.write(this.#stripAnsi(text) + '\n')
      }
    }
    if (this.#fileStream) {
      this.#fileStream.write(this.#fileLine(level, module, msg, args) + '\n')
    }
  }

  #stripAnsi(s: string): string {
    return s.replace(/\x1b\[[\d;]+m/g, '')
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
      timestampFormat: 'none',
      moduleLevels: this.#moduleLevels,
      file: this.#fileCfg,
      module,
      showPid: false,
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
