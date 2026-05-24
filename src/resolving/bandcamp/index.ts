import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const BC_REGEX = /^https?:\/\/(?:.+\.)?bandcamp\.com\//

export class BandcampSource implements AudioSource {
  name = 'bandcamp'

  matches(url: string): boolean {
    return BC_REGEX.test(url)
  }

  async resolve(query: string): Promise<Track[]> {
    if (!this.matches(query)) return this.#search(query)
    try {
      const res = await fetch(query, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const html = await res.text()
      const m = html.match(/"title":"([^"]+)","author":"([^"]+)"/)
      if (m) return [this.#make(query, m[1], m[2], 0)]
      const title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? 'Unknown'
      const author = html.match(/<meta property="og:site_name" content="([^"]+)"/)?.[1] ?? 'Bandcamp'
      return [this.#make(query, title, author, 0)]
    } catch { return [] }
  }

  async resolveTrack(_id: string): Promise<Track | null> { return null }

  async #search(q: string): Promise<Track[]> {
    try {
      const res = await fetch(`https://bandcamp.com/search?q=${encodeURIComponent(q)}&page=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const html = await res.text()
      const items: Track[] = []
      const re = /href="(https:\/\/[^"]+\.bandcamp\.com\/track\/[^"]+)"[^]*?class="heading">([^<]+)<[^]*?class="subheading">([^<]+)</g
      let match
      while ((match = re.exec(html)) !== null && items.length < 10) {
        items.push(this.#make(match[1], match[2], match[3].trim(), 0))
      }
      return items
    } catch { return [] }
  }

  #make(uri: string, title: string, author: string, dur: number): Track {
    return {
      encoded: Buffer.from(uri).toString('base64url'),
      info: { identifier: uri, title, author, duration: dur, uri, artworkUrl: '', sourceName: 'bandcamp', isStream: true, position: 0 },
      source: 'bandcamp',
    }
  }
}
