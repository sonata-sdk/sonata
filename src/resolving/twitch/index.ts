import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const TWITCH_REGEX = /^https?:\/\/(?:www\.)?twitch\.tv\//

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

export class TwitchSource implements AudioSource {
  name = 'twitch'

  matches(url: string): boolean {
    return TWITCH_REGEX.test(url)
  }

  async resolve(query: string): Promise<Track[]> {
    if (!this.matches(query)) return []
    try {
      const res = await fetch(query, { headers: { 'User-Agent': UA } })
      const html = await res.text()
      const title =
        html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ??
        html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ??
        'Unknown'
      const author =
        html.match(/"channel":{"name":"([^"]+)"/)?.[1] ??
        html.match(/"displayName":"([^"]+)"/)?.[1] ??
        'Unknown'
      return [this.#make(query, title, author)]
    } catch {
      return []
    }
  }

  async resolveTrack(_id: string): Promise<Track | null> {
    return null
  }

  #make(uri: string, title: string, author: string): Track {
    return {
      encoded: Buffer.from(uri).toString('base64url'),
      info: {
        identifier: uri,
        title,
        author,
        duration: 0,
        uri,
        artworkUrl: '',
        sourceName: 'twitch',
        isStream: true,
        position: 0,
      },
      source: 'twitch',
    }
  }
}
