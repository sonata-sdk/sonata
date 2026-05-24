import { AudioSourceManager } from './manager.js'
import { YouTubeSource } from './youtube/index.js'
import { SoundCloudSource } from './soundcloud/index.js'
import { SpotifySource } from './spotify/index.js'
import { MirrorResolver } from './mirror.js'
import type { Track, LoadTracksResult } from '../types/index.js'

interface ResolverConfig {
  youtube: { enabled: boolean; clientProfiles?: string[]; proxy?: string; apiKey?: string; clientName?: string; timeout?: number; maxResults?: number; fetchPlayerJS?: boolean }
  soundcloud: { enabled: boolean; clientId?: string; apiUrl?: string; resolveRedirects?: boolean; timeout?: number }
  spotify: { enabled: boolean; clientId: string; clientSecret: string; market?: string; country?: string; maxPlaylistTracks?: number; resolverFlavor?: string; retryCount?: number }
  bandcamp?: boolean
  twitch?: boolean
  vimeo?: boolean
  deezer?: boolean
  apple?: boolean
  nico?: boolean
  mixcloud?: boolean
  podcast?: boolean
  http?: boolean
  local?: boolean
}

export class Resolver {
  #sourceManager = new AudioSourceManager()
  #mirror: MirrorResolver

  constructor(config: ResolverConfig) {
    this.#mirror = new MirrorResolver(this.#sourceManager)
    this.#registerSources(config)
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

    const needsMirror = tracks.some(t => (t as any).needsResolve)
    if (needsMirror && tracks.length === 1) {
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

  #registerSources(config: ResolverConfig) {
    if (config.youtube?.enabled) this.#sourceManager.register(new YouTubeSource(config.youtube))
    if (config.soundcloud?.enabled) this.#sourceManager.register(new SoundCloudSource(config.soundcloud))
    if (config.spotify?.enabled && config.spotify.clientId && config.spotify.clientSecret) {
      this.#sourceManager.register(new SpotifySource(config.spotify.clientId, config.spotify.clientSecret))
    }
    this.#registerOptional(config.http, './http/index.js', 'HTTPSource')
    this.#registerOptional(config.local, './local/index.js', 'LocalSource')
    this.#registerOptional(config.bandcamp, './bandcamp/index.js', 'BandcampSource')
    this.#registerOptional(config.twitch, './twitch/index.js', 'TwitchSource')
    this.#registerOptional(config.vimeo, './vimeo/index.js', 'VimeoSource')
    this.#registerOptional(config.deezer, './deezer/index.js', 'DeezerSource')
    this.#registerOptional(config.apple, './apple/index.js', 'AppleMusicSource')
    this.#registerOptional(config.nico, './nico/index.js', 'NicoNicoSource')
    this.#registerOptional(config.mixcloud, './mixcloud/index.js', 'MixcloudSource')
    this.#registerOptional(config.podcast, './podcast/index.js', 'PodcastSource')
  }

  async #registerOptional(enabled: boolean | undefined, path: string, className: string) {
    if (!enabled) return
    try {
      const mod = await import(path)
      const SourceClass = mod[className]
      if (SourceClass) this.#sourceManager.register(new SourceClass())
    } catch {}
  }
}
