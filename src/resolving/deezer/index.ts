import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const DEEZER_REGEX = /^https?:\/\/(?:www\.)?deezer\.com\//
const API_BASE = 'https://api.deezer.com'

interface DeezerTrack {
  id: number
  title: string
  link: string
  duration: number
  artist: { name: string }
  album: { title: string; cover_big: string }
}

interface DeezerAlbum {
  id: number
  title: string
  link: string
  artist: { name: string }
  cover_big: string
  tracks: { data: DeezerTrack[] }
}

interface DeezerPlaylist {
  id: number
  title: string
  link: string
  creator: { name: string }
  picture_big: string
  tracks: { data: DeezerTrack[] }
}

export class DeezerSource implements AudioSource {
  name = 'deezer'

  matches(url: string): boolean {
    return DEEZER_REGEX.test(url)
  }

  async resolve(query: string): Promise<Track[]> {
    if (!this.matches(query)) return this.#search(query)
    try {
      const parts = new URL(query).pathname.split('/').filter(Boolean)
      if (parts.length < 2) return []

      const type = parts[0]
      const id = parts[1]

      if (type === 'track') {
        const res = await fetch(`${API_BASE}/track/${id}`)
        if (!res.ok) return []
        const data: DeezerTrack = await res.json()
        return [this.#make(data)]
      }

      if (type === 'album') {
        const res = await fetch(`${API_BASE}/album/${id}`)
        if (!res.ok) return []
        const data: DeezerAlbum = await res.json()
        return (data.tracks?.data ?? []).slice(0, 50).map((t) => this.#make(t))
      }

      if (type === 'playlist') {
        const res = await fetch(`${API_BASE}/playlist/${id}`)
        if (!res.ok) return []
        const data: DeezerPlaylist = await res.json()
        return (data.tracks?.data ?? []).slice(0, 50).map((t) => this.#make(t))
      }

      return []
    } catch {
      return []
    }
  }

  async resolveTrack(identifier: string): Promise<Track | null> {
    try {
      const id = parseInt(identifier, 10)
      if (isNaN(id)) return null
      const res = await fetch(`${API_BASE}/track/${id}`)
      if (!res.ok) return null
      const data: DeezerTrack = await res.json()
      return this.#make(data)
    } catch {
      return null
    }
  }

  async #search(q: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.data ?? []).slice(0, 10).map((t: DeezerTrack) => this.#make(t))
    } catch {
      return []
    }
  }

  #make(t: DeezerTrack): Track {
    return {
      encoded: Buffer.from(String(t.id)).toString('base64url'),
      info: {
        identifier: String(t.id),
        title: t.title ?? 'Unknown',
        author: t.artist?.name ?? 'Unknown',
        duration: t.duration * 1000,
        uri: t.link ?? '',
        artworkUrl: t.album?.cover_big ?? '',
        sourceName: 'deezer',
        isStream: false,
        position: 0,
      },
      source: 'deezer',
    }
  }
}
