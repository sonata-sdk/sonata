import { createWriteStream, existsSync, mkdirSync, WriteStream } from 'node:fs'
import { dirname } from 'node:path'

export interface AuditConfig {
  enabled: boolean
  events?: string[]
  file?: string
}

export class AuditLogger {
  #enabled: boolean
  #events: Set<string>
  #stream: WriteStream | null = null

  constructor(cfg: AuditConfig) {
    this.#enabled = cfg.enabled
    this.#events = new Set(cfg.events ?? [])
    if (this.#enabled && cfg.file) {
      const dir = dirname(cfg.file)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      this.#stream = createWriteStream(cfg.file, { flags: 'a' })
    }
  }

  log(event: string, detail: Record<string, unknown>) {
    if (!this.#enabled) return
    if (this.#events.size > 0 && !this.#events.has(event)) return
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...detail,
    })
    if (this.#stream) {
      this.#stream.write(entry + '\n')
    }
  }

  close() { this.#stream?.end() }
}
