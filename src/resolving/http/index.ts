import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const HTTP_REGEX = /^https?:\/\/.+\.(mp3|ogg|wav|flac|m4a|aac|wma|opus)(\?.*)?$/i

export class HTTPSource implements AudioSource {
  name = 'http'

  matches(url: string): boolean {
    return HTTP_REGEX.test(url)
  }

  async resolve(query: string): Promise<Track[]> {
    if (!this.matches(query)) return []
    return [{
      encoded: Buffer.from(query).toString('base64url'),
      info: {
        identifier: query,
        title: query.split('/').pop()?.split('?')[0] ?? 'Unknown',
        author: 'Unknown',
        duration: 0,
        uri: query,
        artworkUrl: '',
        sourceName: 'http',
        isStream: true,
        position: 0,
      },
      source: 'http',
    }]
  }

  async resolveTrack(identifier: string): Promise<Track | null> {
    const url = Buffer.from(identifier, 'base64url').toString()
    if (!HTTP_REGEX.test(url)) return null
    return (await this.resolve(url))[0] ?? null
  }
}
