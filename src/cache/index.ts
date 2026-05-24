import type { Track } from '../types/index.js'

interface CacheEntry {
  tracks: Track[]
  expiresAt: number
}

export class TrackCache {
  #store = new Map<string, CacheEntry>()
  #ttl: number
  #maxSize: number

  constructor(ttl = 300_000, maxSize = 500) {
    this.#ttl = ttl
    this.#maxSize = maxSize
  }

  get(key: string): Track[] | null {
    const entry = this.#store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.#store.delete(key)
      return null
    }
    return entry.tracks
  }

  set(key: string, tracks: Track[]) {
    if (this.#store.size >= this.#maxSize) {
      const first = this.#store.keys().next().value
      if (first) this.#store.delete(first)
    }
    this.#store.set(key, { tracks, expiresAt: Date.now() + this.#ttl })
  }

  invalidate(key: string) { this.#store.delete(key) }
  clear() { this.#store.clear() }
  get size() { return this.#store.size }
}
