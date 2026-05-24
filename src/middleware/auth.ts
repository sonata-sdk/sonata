import type { IncomingMessage } from 'node:http'

export class AuthManager {
  #tokens: Set<string>

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
}
