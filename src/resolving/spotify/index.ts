import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const SP_REGEX = /^https?:\/\/(?:open\.)?spotify\.com\//
const API_BASE = 'https://api.spotify.com/v1'

interface SpotifyCredentials {
  accessToken: string
  expiresAt: number
}

interface SpotifyTrackData {
  id: string
  name: string
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
  duration_ms: number
  external_urls: { spotify: string }
  external_ids: { isrc?: string }
}

interface SpotifyPlaylistData {
  items: { track: SpotifyTrackData }[]
}

export interface MirroredTrack extends Track {
  needsResolve: true
  resolveQuery: string
}

export class SpotifySource implements AudioSource {
  name = 'spotify'
  #clientId: string
  #clientSecret: string
  #credentials: SpotifyCredentials | null = null

  constructor(clientId: string, clientSecret: string) {
    this.#clientId = clientId
    this.#clientSecret = clientSecret
  }

  matches(url: string): boolean {
    return SP_REGEX.test(url)
  }

  async resolve(query: string): Promise<Track[]> {
    const token = await this.#getToken()
    if (!token) return []

    if (!this.matches(query)) return this.#search(query, token)

    const type = this.#detectType(query)
    const id = this.#extractId(query)

    if (!id) return []

    switch (type) {
      case 'track': {
        const track = await this.#getTrack(id, token)
        return track ? [track] : []
      }
      case 'playlist': return this.#getPlaylist(id, token)
      case 'album': return this.#getAlbum(id, token)
      default: return []
    }
  }

  async resolveTrack(identifier: string): Promise<Track | null> {
    const token = await this.#getToken()
    if (!token) return null
    return this.#getTrack(identifier, token)
  }

  async #getTrack(id: string, token: string): Promise<Track | null> {
    try {
      const res = await fetch(`${API_BASE}/tracks/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return null
      const data: SpotifyTrackData = await res.json()
      return this.#toMirroredTrack(data)
    } catch { return null }
  }

  async #getPlaylist(id: string, token: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/playlists/${id}/tracks?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return []
      const data: SpotifyPlaylistData = await res.json()
      return data.items.map(i => this.#toMirroredTrack(i.track)).filter(Boolean)
    } catch { return [] }
  }

  async #getAlbum(id: string, token: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/albums/${id}/tracks?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return []
      const data: any = await res.json()
      return data.items.map((t: any) => this.#toMirroredTrack(t)).filter(Boolean)
    } catch { return [] }
  }

  async #search(query: string, token: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return []
      const data: any = await res.json()
      return (data.tracks?.items ?? []).map((t: SpotifyTrackData) => this.#toMirroredTrack(t)).filter(Boolean)
    } catch { return [] }
  }

  async #getToken(): Promise<string | null> {
    if (this.#credentials && Date.now() < this.#credentials.expiresAt) {
      return this.#credentials.accessToken
    }

    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.#clientId}:${this.#clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
      })

      if (!res.ok) return null
      const data = await res.json()

      this.#credentials = {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000) - 60000,
      }

      return this.#credentials.accessToken
    } catch { return null }
  }

  #toMirroredTrack(t: SpotifyTrackData): MirroredTrack {
    const title = t.name
    const artist = t.artists?.map(a => a.name).join(', ') ?? 'Unknown'
    const isrc = t.external_ids?.isrc

    // Build search query for mirroring: ISRC first, then title + artist
    const queries: string[] = []
    if (isrc) queries.push(`ytsearch:${isrc}`)
    queries.push(`ytsearch:${title} ${artist}`)

    return {
      encoded: t.id,
      needsResolve: true,
      resolveQuery: queries.join(' || '),
      info: {
        identifier: t.id,
        title,
        author: artist,
        duration: t.duration_ms ?? 0,
        uri: t.external_urls?.spotify ?? '',
        artworkUrl: t.album?.images?.[0]?.url ?? '',
        sourceName: 'spotify',
        isStream: false,
        position: 0,
      },
      source: 'spotify',
    }
  }

  #detectType(url: string): string {
    if (url.includes('/track/')) return 'track'
    if (url.includes('/playlist/')) return 'playlist'
    if (url.includes('/album/')) return 'album'
    return 'track'
  }

  #extractId(url: string): string | null {
    const match = url.match(/\/(track|playlist|album)\/([a-zA-Z0-9]+)/)
    return match ? match[2] : null
  }
}
