import { createHmac, randomBytes } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

export class AuthManager {
  #tokens: Set<string>
  #rotationInterval: ReturnType<typeof setInterval> | null = null

  constructor(tokens: string[]) {
    this.#tokens = new Set(tokens.filter(Boolean))
  }

  authenticate(req: IncomingMessage): boolean {
    const auth = req.headers['authorization']
    if (!auth) return false
    return this.#tokens.has(auth)
  }

  addToken(token: string) { this.#tokens.add(token) }
  removeToken(token: string) { this.#tokens.delete(token) }
  count() { return this.#tokens.size }

  hmac(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex')
  }

  generateToken(length = 32): string {
    return randomBytes(length).toString('hex')
  }

  startRotation(intervalMs = 86_400_000) {
    this.#rotationInterval = setInterval(() => {
      const oldTokens = new Set(this.#tokens)
      this.#tokens.clear()
      for (const t of oldTokens) {
        this.#tokens.add(this.generateToken())
      }
    }, intervalMs)
  }

  stopRotation() {
    if (this.#rotationInterval) {
      clearInterval(this.#rotationInterval)
      this.#rotationInterval = null
    }
  }
}
