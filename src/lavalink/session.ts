import { randomBytes } from 'node:crypto'
import type { SessionState } from '../types/index.js'

export class Session {
  readonly id: string
  resume: boolean
  resumeKey: string
  createdAt = Date.now()

  constructor(resume: boolean, resumeKey: string) {
    this.id = randomBytes(8).toString('hex')
    this.resume = resume
    this.resumeKey = resumeKey
  }

  toState(): SessionState {
    return { id: this.id, resume: this.resume, resumeKey: this.resumeKey }
  }
}

export class SessionManager {
  #sessions = new Map<string, Session>()

  create(resume = false, resumeKey = ''): Session {
    const session = new Session(resume, resumeKey)
    this.#sessions.set(session.id, session)
    return session
  }

  get(id: string): Session | undefined { return this.#sessions.get(id) }
  remove(id: string) { this.#sessions.delete(id) }
  count() { return this.#sessions.size }
}
