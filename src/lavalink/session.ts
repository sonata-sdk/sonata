import { randomBytes } from 'node:crypto'
import type { SessionState } from '../types/index.js'

interface LavalinkConfig {
  resumeTimeout?: number
  resumeKey?: string
  sessionTimeout?: number
  apiVersion?: number
}

export class Session {
  readonly id: string
  resume: boolean
  resumeKey: string
  createdAt = Date.now()
  timeout: number

  constructor(resume: boolean, resumeKey: string, timeout = 300) {
    this.id = randomBytes(8).toString('hex')
    this.resume = resume
    this.resumeKey = resumeKey
    this.timeout = timeout
  }

  toState(): SessionState {
    return { id: this.id, resume: this.resume, resumeKey: this.resumeKey }
  }
}

export class SessionManager {
  #sessions = new Map<string, Session>()
  #config: LavalinkConfig

  constructor(config: LavalinkConfig = {}) {
    this.#config = config
    this.#startCleanup()
  }

  create(resume = false, resumeKey = ''): Session {
    const key = resumeKey || this.#config.resumeKey || ''
    const session = new Session(resume, key, this.#config.sessionTimeout)
    this.#sessions.set(session.id, session)
    return session
  }

  get(id: string): Session | undefined { return this.#sessions.get(id) }
  remove(id: string) { this.#sessions.delete(id) }
  count() { return this.#sessions.size }

  #startCleanup() {
    const timeout = (this.#config.sessionTimeout ?? 300) * 1000
    setInterval(() => {
      const now = Date.now()
      for (const [id, session] of this.#sessions) {
        if (now - session.createdAt > timeout) {
          this.remove(id)
        }
      }
    }, 60_000)
  }
}
