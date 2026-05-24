import type { Track } from '../types/index.js'

interface CacheEntry {
  tracks: Track[]
  expiresAt: number
}

let Redis: any = null

async function getRedis() {
  if (Redis !== null) return Redis
  try {
    // @ts-expect-error - ioredis is optional
    const mod = await import('ioredis')
    Redis = mod.default ?? mod
  } catch {
    Redis = false
  }
  return Redis
}

export class RedisTrackCache {
  #client: any
  #ttl: number
  #prefix: string

  constructor(url: string, ttl = 300_000, prefix = 'sonata:') {
    this.#ttl = ttl
    this.#prefix = prefix
    this.#client = null
    getRedis().then(r => {
      if (r) {
        this.#client = new r(url)
        this.#client.on('error', (err: Error) => console.error('[RedisCache]', err.message))
      } else {
        console.warn('[RedisCache] ioredis not installed, falling back to memory store')
      }
    })
  }

  async get(key: string): Promise<Track[] | null> {
    if (!this.#client) return null
    try {
      const raw = await this.#client.get(this.#prefix + key)
      if (!raw) return null
      const entry: CacheEntry = JSON.parse(raw)
      if (Date.now() > entry.expiresAt) {
        await this.#client.del(this.#prefix + key)
        return null
      }
      return entry.tracks
    } catch {
      return null
    }
  }

  async set(key: string, tracks: Track[]) {
    if (!this.#client) return
    const entry: CacheEntry = { tracks, expiresAt: Date.now() + this.#ttl }
    try {
      await this.#client.set(this.#prefix + key, JSON.stringify(entry), 'PX', this.#ttl)
    } catch {}
  }

  async invalidate(key: string) {
    if (!this.#client) return
    try { await this.#client.del(this.#prefix + key) } catch {}
  }

  async clear() {
    if (!this.#client) return
    try {
      const keys = await this.#client.keys(this.#prefix + '*')
      if (keys.length > 0) await this.#client.del(...keys)
    } catch {}
  }

  get size(): number {
    return 0
  }

  get client() { return this.#client }
}
