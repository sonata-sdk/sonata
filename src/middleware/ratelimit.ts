import { IncomingMessage, ServerResponse } from 'node:http'

interface Bucket {
  tokens: number
  lastRefill: number
}

interface PerRouteConfig {
  maxRequests: number
  windowMs: number
}

export class RateLimiter {
  #buckets = new Map<string, Bucket>()
  #maxTokens: number
  #refillRate: number
  #refillInterval: number
  #perUser: boolean
  #perRoute: Map<string, PerRouteConfig> = new Map()
  #sendHeaders: boolean

  constructor(maxTokens = 50, refillInterval = 1000, perUser = false, perRoute: Record<string, PerRouteConfig> = {}, sendHeaders = true) {
    this.#maxTokens = maxTokens
    this.#refillRate = maxTokens
    this.#refillInterval = refillInterval
    this.#perUser = perUser
    this.#sendHeaders = sendHeaders
    for (const [route, cfg] of Object.entries(perRoute)) {
      this.#perRoute.set(route, cfg)
    }
  }

  check(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const pathname = url.pathname
    let key: string

    if (this.#perUser) {
      const auth = req.headers['authorization']
      const userId = url.searchParams.get('userId')
      key = userId || auth || (req.socket.remoteAddress ?? 'unknown')
    } else {
      key = req.headers['authorization'] ?? req.socket.remoteAddress ?? 'unknown'
    }

    // Per-route config takes priority
    let maxTokens = this.#maxTokens
    let refillInterval = this.#refillInterval
    for (const [route, cfg] of this.#perRoute) {
      if (pathname.startsWith(route)) {
        maxTokens = cfg.maxRequests
        refillInterval = cfg.windowMs
        break
      }
    }

    key = `${key}:${pathname}`

    const now = Date.now()
    let bucket = this.#buckets.get(key)

    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now }
      this.#buckets.set(key, bucket)
    }

    const elapsed = now - bucket.lastRefill
    bucket.tokens = Math.min(maxTokens, bucket.tokens + (elapsed / refillInterval) * maxTokens)
    bucket.lastRefill = now

    if (this.#sendHeaders) {
      res.setHeader('X-RateLimit-Limit', maxTokens.toString())
      res.setHeader('X-RateLimit-Remaining', Math.max(0, Math.floor(bucket.tokens)).toString())
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + refillInterval) / 1000).toString())
    }

    if (bucket.tokens < 1) {
      res.statusCode = 429
      res.setHeader('Retry-After', Math.ceil(refillInterval / maxTokens).toString())
      res.end(JSON.stringify({ error: 'Too many requests' }))
      return false
    }

    bucket.tokens--
    return true
  }

  reset() { this.#buckets.clear() }
}
