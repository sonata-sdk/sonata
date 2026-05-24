import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const JIOSAAVN_REGEX = /^https?:\/\/(?:www\.)?jiosaavn\.com\//
const API_BASE = 'https://www.jiosaavn.com/api.php'

interface JioSaavnSong {
  id: string
  title: string
  subtitle?: string
  perma_url: string
  image: string
  more_info?: {
    duration?: string
    music?: string
    album?: string
    artistMap?: {
      primary_artists?: { name: string; id: string }[]
    }
  }
  album?: string
  year?: string
  language?: string
}

interface JioSaavnAlbum {
  albumid: string
  title: string
  perma_url: string
  image: string
  more_info?: { artistMap?: { artists?: { name: string }[] } }
  songs?: JioSaavnSong[]
  list?: string
}

interface JioSaavnPlaylist {
  listid: string
  title: string
  perma_url: string
  image: string
  more_info?: { artistMap?: { artists?: { name: string }[] } }
  songs?: JioSaavnSong[]
  list?: string
}

interface JioSaavnAutocomplete {
  songs?: { results?: JioSaavnSong[] }
  albums?: { results?: JioSaavnAlbum[] }
  playlists?: { results?: JioSaavnPlaylist[] }
}

async function apiCall(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ __call: '', _format: 'json', _marker: '0', ...params })
  const res = await fetch(`${API_BASE}?${qs}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) return null
  const text = await res.text()
  if (!text || text === 'null') return null
  try { return JSON.parse(text) } catch { return null }
}

export class JioSaavnSource implements AudioSource {
  name = 'jiosaavn'

  matches(url: string): boolean {
    return JIOSAAVN_REGEX.test(url)
  }

  async resolve(query: string): Promise<Track[]> {
    if (!this.matches(query)) return this.#search(query)
    try {
      const parts = new URL(query).pathname.split('/').filter(Boolean)
      if (parts.length < 2) return []
      const type = parts[0]
      const id = parts[parts.length - 1].split('?')[0].split('#')[0]

      if (type === 'song') {
        const res = await apiCall({ __call: 'song.getDetails', pids: id })
        if (!res) return []
        const song: JioSaavnSong = res[id] || res
        return song?.id ? [this.#make(song)] : []
      }

      if (type === 'album') {
        const res = await apiCall({ __call: 'album.getDetails', albumid: id })
        if (!res) return []
        const songs: JioSaavnSong[] = res.songs ?? res.list ?? []
        return songs.slice(0, 50).map((t) => this.#make(t))
      }

      if (type === 'playlist') {
        const res = await apiCall({ __call: 'playlist.getDetails', listid: id })
        if (!res) return []
        const songs: JioSaavnSong[] = res.songs ?? res.list ?? []
        return songs.slice(0, 50).map((t) => this.#make(t))
      }

      return []
    } catch {
      return []
    }
  }

  async resolveTrack(identifier: string): Promise<Track | null> {
    try {
      const res = await apiCall({ __call: 'song.getDetails', pids: identifier })
      if (!res) return null
      const song: JioSaavnSong = res[identifier] || res
      if (!song?.id) return null
      return this.#make(song)
    } catch {
      return null
    }
  }

  async #search(q: string): Promise<Track[]> {
    try {
      const res = await apiCall({ __call: 'autocomplete.get', query: q })
      if (!res) return []
      const data = res as JioSaavnAutocomplete
      const songs = data.songs?.results ?? []
      return songs.slice(0, 10).map((t) => this.#make(t))
    } catch {
      return []
    }
  }

  #make(t: JioSaavnSong): Track {
    const duration = t.more_info?.duration ? parseFloat(t.more_info.duration) * 1000 : 0
    const author = t.more_info?.music
      ?? t.more_info?.artistMap?.primary_artists?.[0]?.name
      ?? t.subtitle
      ?? 'Unknown'
    return {
      encoded: Buffer.from(t.id).toString('base64url'),
      info: {
        identifier: t.id,
        title: t.title ?? 'Unknown',
        author,
        duration,
        uri: t.perma_url ?? '',
        artworkUrl: t.image?.replace('-150x150', '-500x500') ?? '',
        sourceName: 'jiosaavn',
        isStream: false,
        position: 0,
      },
      source: 'jiosaavn',
    }
  }
}
