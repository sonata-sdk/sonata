import type { Track } from '../types/index.js'
import type { Logger } from '../utils/logger.js'

export interface AudioSource {
  name: string
  matches(url: string): boolean
  resolve(query: string): Promise<Track[]>
  resolveTrack(identifier: string): Promise<Track | null>
}

export interface AudioPlayerManagerConfiguration {
  configure(manager: AudioSourceManager): void
}

export class AudioSourceManager {
  #sources: AudioSource[] = []
  #logger: Logger | null = null

  setLogger(logger: Logger) { this.#logger = logger }

  register(source: AudioSource) {
    this.#sources = this.#sources.filter(s => s.name !== source.name)
    this.#sources.push(source)
    this.#logger?.info('Sources', `Registered source: ${source.name}`)
  }

  configure(config: AudioPlayerManagerConfiguration) {
    config.configure(this)
  }

  get(name: string): AudioSource | undefined {
    return this.#sources.find(s => s.name === name)
  }

  getAll(): AudioSource[] {
    return [...this.#sources]
  }

  async resolve(query: string): Promise<{ source: AudioSource; tracks: Track[] } | null> {
    this.#logger?.debug('Resolve', `"${query.substring(0, 80)}"`)

    const start = Date.now()

    for (const source of this.#sources) {
      if (source.matches(query)) {
        this.#logger?.debug('Resolve', `Trying ${source.name} (URL match)`)
        const tracks = await source.resolve(query)
        if (tracks.length > 0) {
          const elapsed = Date.now() - start
          this.#logger?.info('Resolve', `"${query.substring(0, 40)}" via ${source.name} (${tracks.length} tracks, ${elapsed}ms)`)
          return { source, tracks }
        }
      }
    }

    for (const source of this.#sources) {
      try {
        this.#logger?.debug('Resolve', `Trying ${source.name} (search)`)
        const startSearch = Date.now()
        const tracks = await source.resolve(query)
        if (tracks.length > 0) {
          const elapsed = Date.now() - start
          this.#logger?.info('Resolve', `"${query.substring(0, 40)}" via ${source.name} (${tracks.length} tracks, ${elapsed}ms)`)
          return { source, tracks }
        }
      } catch { continue }
    }

    this.#logger?.warn('Resolve', `No results for "${query.substring(0, 80)}"`)
    return null
  }

  async resolveTrack(encoded: string): Promise<Track | null> {
    for (const source of this.#sources) {
      try {
        const track = await source.resolveTrack(encoded)
        if (track) {
          this.#logger?.debug('resolve', `Resolved track via ${source.name}: "${track.info.title}"`)
          return track
        }
      } catch { continue }
    }
    return null
  }
}
