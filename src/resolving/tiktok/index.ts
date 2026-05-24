import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const TIKTOK_REGEX = /tiktok\.com\//

export class TikTokSource implements AudioSource {
  name = 'tiktok'

  matches(url: string): boolean {
    return TIKTOK_REGEX.test(url)
  }

  async resolve(query: string): Promise<Track[]> {
    if (!this.matches(query)) return []
    try {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(query)}`)
      if (oembedRes.ok) {
        const data = await oembedRes.json() as any
        return [this.#make(query, data.author_name ?? 'Unknown', data.title ?? 'Unknown', data.thumbnail_url ?? '')]
      }
    } catch {}

    try {
      const tikwmRes = await fetch(`https://tikwm.com/api/?url=${encodeURIComponent(query)}`)
      if (tikwmRes.ok) {
        const data = await tikwmRes.json() as any
        if (data?.data) {
          return [this.#make(query, data.data.author?.nickname ?? 'Unknown', data.data.title ?? 'Unknown', data.data.cover ?? '')]
        }
      }
    } catch {}

    return []
  }

  async resolveTrack(_identifier: string): Promise<Track | null> {
    return null
  }

  #make(uri: string, author: string, title: string, artworkUrl: string): Track {
    return {
      encoded: Buffer.from(uri).toString('base64url'),
      info: {
        identifier: uri,
        title,
        author,
        duration: 0,
        uri,
        artworkUrl,
        sourceName: 'tiktok',
        isStream: true,
        position: 0,
      },
      source: 'tiktok',
    }
  }
}
