interface LyricLine {
  time: number
  text: string
}

interface LyricResult {
  lyrics: string
  source: string
  synced: boolean
  lines: LyricLine[]
}

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/
  for (const line of lrc.split('\n')) {
    const match = line.match(regex)
    if (match) {
      const min = parseInt(match[1])
      const sec = parseInt(match[2])
      let ms = parseInt(match[3])
      if (match[3].length === 2) ms *= 10
      const time = min * 60000 + sec * 1000 + ms
      lines.push({ time, text: match[4].trim() })
    }
  }
  return lines
}

async function fetchLRCLib(artist: string, title: string): Promise<LyricResult | null> {
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Sonata/4.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const syncedLrc = data.syncedLyrics || ''
    const plainLrc = data.plainLyrics || ''
    const lines = syncedLrc ? parseLRC(syncedLrc) : []
    return {
      lyrics: syncedLrc || plainLrc,
      source: 'lrclib',
      synced: !!syncedLrc,
      lines,
    }
  } catch {
    return null
  }
}

async function fetchGenius(artist: string, title: string): Promise<LyricResult | null> {
  try {
    const slug = `${artist.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}-${title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    const url = `https://genius.com/${slug}-lyrics`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Sonata/4.0)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/<div class="lyrics">\s*<!--.*?-->\s*<p>(.*?)<\/p>\s*<\/div>/s)
    if (!match) return null
    const lyrics = match[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
    if (!lyrics) return null
    return {
      lyrics,
      source: 'genius',
      synced: false,
      lines: lyrics.split('\n').map(line => ({ time: 0, text: line })),
    }
  } catch {
    return null
  }
}

export async function getLyrics(artist: string, title: string): Promise<LyricResult | null> {
  let result = await fetchLRCLib(artist, title)
  if (result) return result
  result = await fetchGenius(artist, title)
  return result
}
