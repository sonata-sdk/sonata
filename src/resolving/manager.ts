import type { Track } from '../types/index.js'

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

  register(source: AudioSource) {
    // Remove existing source with same name (allows overriding)
    this.#sources = this.#sources.filter(s => s.name !== source.name)
    this.#sources.push(source)
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
    // First try exact match by URL
    for (const source of this.#sources) {
      if (source.matches(query)) {
        const tracks = await source.resolve(query)
        if (tracks.length > 0) return { source, tracks }
      }
    }

    // Then try all sources as search
    for (const source of this.#sources) {
      try {
        const tracks = await source.resolve(query)
        if (tracks.length > 0) return { source, tracks }
      } catch { continue }
    }

    return null
  }

  async resolveTrack(encoded: string): Promise<Track | null> {
    for (const source of this.#sources) {
      try {
        const track = await source.resolveTrack(encoded)
        if (track) return track
      } catch { continue }
    }
    return null
  }
}
