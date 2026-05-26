import type { Track } from '../types/index.js'
import type { Resolver } from '../resolving/index.js'
import type { Logger } from '../utils/logger.js'

export interface RadioConfig {
  enabled: boolean
  source?: string
  basedOn?: 'lastTrack' | 'history' | 'seed'
  seedTracks?: string[]
  refreshAfter?: number
}

export class RadioMode {
  #resolver: Resolver
  #logger: Logger | null
  #cfg: RadioConfig
  #playedInCycle = 0

  constructor(resolver: Resolver, cfg: RadioConfig, logger: Logger | null = null) {
    this.#resolver = resolver
    this.#cfg = cfg
    this.#logger = logger
  }

  resetCycle() { this.#playedInCycle = 0 }

  async generateTrack(history: Track[]): Promise<Track | null> {
    if (!this.#cfg.enabled) return null
    this.#playedInCycle++
    if (this.#cfg.refreshAfter && this.#playedInCycle >= this.#cfg.refreshAfter) {
      this.#playedInCycle = 0
    }
    const seed = this.#getSeed(history)
    if (!seed) return null
    const query = `${seed.info.author} - ${seed.info.title}`
    const source = this.#cfg.source ?? 'youtube'
    try {
      const result = await this.#resolver.resolveAsync(`${source}:${query}`)
      if (!result?.tracks?.length) return null
      const existing = new Set(history.map(t => t.encoded))
      for (const track of result.tracks) {
        if (track.encoded !== seed.encoded && !existing.has(track.encoded)) {
          return track as Track
        }
      }
      return result.tracks[0] as Track
    } catch {
      return null
    }
  }

  #getSeed(history: Track[]): Track | null {
    if (this.#cfg.basedOn === 'lastTrack' || this.#cfg.basedOn === 'history') {
      return history[history.length - 1] ?? null
    }
    return null
  }
}
