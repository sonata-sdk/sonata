import { AudioSourceManager } from './manager.js'
import { YouTubeSource } from './youtube/index.js'
import { SoundCloudSource } from './soundcloud/index.js'
import { SpotifySource } from './spotify/index.js'
import { MirrorResolver } from './mirror.js'
import type { Track, LoadTracksResult } from '../types/index.js'

export class Resolver {
  #sourceManager = new AudioSourceManager()
  #mirror: MirrorResolver
  #spotifyClientId: string
  #spotifyClientSecret: string

  constructor(spotifyClientId = '', spotifyClientSecret = '') {
    this.#spotifyClientId = spotifyClientId
    this.#spotifyClientSecret = spotifyClientSecret
    this.#mirror = new MirrorResolver(this.#sourceManager)
    this.#registerDefaultSources()
  }

  get sourceManager() { return this.#sourceManager }
  get mirror() { return this.#mirror }

  async resolveAsync(query: string): Promise<LoadTracksResult> {
    const result = await this.#sourceManager.resolve(query)

    if (!result) {
      return { loadType: 'empty', tracks: [] }
    }

    const { tracks } = result
    let loadType: LoadTracksResult['loadType'] = 'search'

    if (tracks.length === 1) loadType = 'track'
    else if (tracks.length > 1) loadType = 'search'
    else loadType = 'empty'

    // Check if any tracks need mirroring (Spotify)
    const needsMirror = tracks.some(t => (t as any).needsResolve)
    if (needsMirror && tracks.length === 1) {
      // Try to resolve immediately for single track
      const resolved = await this.#mirror.resolve(tracks[0])
      if (resolved) return { loadType: 'track', tracks: [resolved] }
    }

    return { loadType, tracks }
  }

  async resolveTrackAsync(encoded: string): Promise<Track | null> {
    const track = await this.#sourceManager.resolveTrack(encoded)

    if (track && (track as any).needsResolve) {
      return this.#mirror.resolve(track)
    }

    return track
  }

  #registerDefaultSources() {
    this.#sourceManager.register(new YouTubeSource())
    this.#sourceManager.register(new SoundCloudSource())

    if (this.#spotifyClientId && this.#spotifyClientSecret) {
      this.#sourceManager.register(new SpotifySource(this.#spotifyClientId, this.#spotifyClientSecret))
    }
  }
}
