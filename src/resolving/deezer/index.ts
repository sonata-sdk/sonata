import https from 'node:https'
import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const DEEZER_REGEX = /^https?:\/\/(?:www\.)?deezer\.com\//
const API_BASE = 'https://api.deezer.com'
const GW_URL = 'https://www.deezer.com/ajax/gw-light.php'

interface DeezerTrack {
  id: number
  title: string
  link: string
  duration: number
  preview: string
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

interface DeezerTrackData {
  sng_id: number
  md5_origin: string
  media_version: number
  filesize: number
  track_token: string
}

export class DeezerSource implements AudioSource {
  name = 'deezer'
  #arl: string
  #sid: string | null = null
  #sidExpires = 0
  #proxy: string | null = null
  #agent: any = null

  constructor(config?: { arl?: string; decryptionKey?: string; proxy?: string }) {
    this.#arl = config?.arl ?? ''
    this.#proxy = config?.proxy ?? null
    if (this.#proxy) {
      import('socks-proxy-agent').then(mod => {
        this.#agent = new mod.SocksProxyAgent(this.#proxy!)
      }).catch(() => {})
    }
  }

  matches(url: string): boolean {
    return DEEZER_REGEX.test(url)
  }

  async resolve(query: string): Promise<Track[]> {
    if (query.startsWith('deezersearch:')) query = query.slice(13).trim()
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
        return [await this.#make(data)]
      }

      if (type === 'album') {
        const res = await fetch(`${API_BASE}/album/${id}`)
        if (!res.ok) return []
        const data: DeezerAlbum = await res.json()
        return await Promise.all((data.tracks?.data ?? []).slice(0, 50).map(t => this.#make(t)))
      }

      if (type === 'playlist') {
        const res = await fetch(`${API_BASE}/playlist/${id}`)
        if (!res.ok) return []
        const data: DeezerPlaylist = await res.json()
        return await Promise.all((data.tracks?.data ?? []).slice(0, 50).map(t => this.#make(t)))
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
      return await this.#make(data)
    } catch {
      return null
    }
  }

  #fetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.#agent) return fetch(url, options)
    const urlObj = new URL(url)
    const headers = (options.headers as Record<string, string>) ?? {}
    const body = options.body as string | undefined
    const isPost = options.method === 'POST' || (!options.method && body)
    return new Promise((resolve, reject) => {
      const reqOpts: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: isPost ? 'POST' : 'GET',
        headers,
        agent: this.#agent!,
      }
      const req = https.request(reqOpts, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          resolve(new Response(Buffer.concat(chunks), {
            status: res.statusCode ?? 200,
            statusText: res.statusMessage ?? '',
            headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v ?? ''])),
          }))
        })
      })
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    })
  }

  async #getSID(): Promise<string | null> {
    if (this.#sid && Date.now() < this.#sidExpires) return this.#sid
    if (!this.#arl) return null

    try {
      const res = await this.#fetch(`${GW_URL}?method=deezer.getUserData&api_version=1.0&api_token=`, {
        method: 'POST',
        headers: {
          Cookie: `arl=${this.#arl}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        redirect: 'manual',
      })

      const setCookie = res.headers.get('set-cookie') ?? ''
      const match = setCookie.match(/sid=([^;]+)/)
      if (match) {
        this.#sid = match[1]
        this.#sidExpires = Date.now() + 3600_000 // 1h
        return this.#sid
      }

      const text = await res.text()
      try {
        const json = JSON.parse(text)
        if (json.results?.SESSION) {
          this.#sid = json.results.SESSION
          this.#sidExpires = Date.now() + 3600_000
          return this.#sid
        }
      } catch {}

      return null
    } catch {
      return null
    }
  }

  async #getTrackData(trackId: number): Promise<DeezerTrackData | null> {
    const sid = await this.#getSID()
    if (!sid) return null

    try {
      const res = await this.#fetch(`${GW_URL}?method=song.getData&api_version=1.0&api_token=`, {
        method: 'POST',
        headers: {
          Cookie: `sid=${sid}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sng_id: trackId }),
      })

      const json: any = await res.json()
      const data = json?.results?.DATA
      if (!data?.md5_origin) return null

      return {
        sng_id: data.sng_id,
        md5_origin: data.md5_origin,
        media_version: data.media_version,
        filesize: data.filesize,
        track_token: data.track_token,
      }
    } catch {
      return null
    }
  }

  #buildStreamUrl(data: DeezerTrackData): string | null {
    const { sng_id, md5_origin, media_version, filesize, track_token } = data
    if (!md5_origin) return null

    const cdn = (sng_id % 10) + 1
    const params = new URLSearchParams({
      track_id: String(sng_id),
      media_version: String(media_version),
      filesize: String(filesize),
      track_token,
    })

    return `https://e-cdns-proxy-${cdn}.dzcdn.net/mobile/1/${md5_origin}?${params}`
  }

  async #make(t: DeezerTrack): Promise<Track> {
    const id = t.id
    let audioUrl: string | undefined = t.preview || undefined

    if (this.#arl) {
      const trackData = await this.#getTrackData(id)
      if (trackData) {
        const streamUrl = this.#buildStreamUrl(trackData)
        if (streamUrl) audioUrl = streamUrl
      }
    }

    return {
      encoded: Buffer.from(String(id)).toString('base64url'),
      info: {
        identifier: String(id),
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
      userData: audioUrl ? { audioUrl } : undefined,
    }
  }

  async #search(q: string): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) return []
      const data = await res.json()
      return await Promise.all((data.data ?? []).slice(0, 10).map((t: DeezerTrack) => this.#make(t)))
    } catch {
      return []
    }
  }
}
