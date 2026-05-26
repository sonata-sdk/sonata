import type { IncomingMessage, ServerResponse } from 'node:http'

export interface MaintenanceConfig {
  enabled: boolean
  message?: string
  allowAdmins?: boolean
  drainPlayers?: boolean
}

export class MaintenanceMode {
  #enabled: boolean
  #message: string
  #adminTokens: Set<string>
  #bypassPaths: Set<string>

  constructor(cfg: MaintenanceConfig, adminTokens: string[] = [], bypassPaths: string[] = []) {
    this.#enabled = cfg.enabled
    this.#message = cfg.message ?? 'Server is under maintenance'
    this.#adminTokens = new Set(adminTokens)
    this.#bypassPaths = new Set(bypassPaths)
  }

  get enabled() { return this.#enabled }

  enable(msg?: string) {
    this.#enabled = true
    if (msg) this.#message = msg
  }

  disable() { this.#enabled = false }

  handler(req: IncomingMessage, res: ServerResponse): boolean {
    if (!this.#enabled) return false
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    if (this.#bypassPaths.has(url.pathname)) return false
    if (this.#adminTokens.size > 0) {
      const auth = req.headers['authorization'] ?? ''
      if (this.#adminTokens.has(auth)) return false
    }
    res.statusCode = 503
    res.end(JSON.stringify({ error: this.#message }))
    return true
  }
}
