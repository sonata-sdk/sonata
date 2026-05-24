import { IncomingMessage, ServerResponse } from 'node:http'

interface Bucket {
  tokens: number
  lastRefill: number
}

export class RateLimiter {
  #buckets = new Map<string, Bucket>()
  #maxTokens: number
  #refillRate: number
  #refillInterval: number

  constructor(maxTokens = 50, refillInterval = 1000) {
    this.#maxTokens = maxTokens
    this.#refillRate = maxTokens
    this.#refillInterval = refillInterval
  }

  check(req: IncomingMessage, res: ServerResponse): boolean {
    const key = req.headers['authorization'] ?? req.socket.remoteAddress ?? 'unknown'
    const now = Date.now()
    let bucket = this.#buckets.get(key)

    if (!bucket) {
      bucket = { tokens: this.#maxTokens, lastRefill: now }
      this.#buckets.set(key, bucket)
    }

    const elapsed = now - bucket.lastRefill
    bucket.tokens = Math.min(this.#maxTokens, bucket.tokens + (elapsed / this.#refillInterval) * this.#refillRate)
    bucket.lastRefill = now

    if (bucket.tokens < 1) {
      res.statusCode = 429
      res.setHeader('Retry-After', Math.ceil(this.#refillInterval / this.#maxTokens).toString())
      res.end(JSON.stringify({ error: 'Too many requests' }))
      return false
    }

    bucket.tokens--
    return true
  }

  reset() { this.#buckets.clear() }
}
