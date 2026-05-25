export interface YouTubeFormat {
  itag: number
  url?: string
  cipher?: string
  signatureCipher?: string
  mimeType: string
  bitrate?: number
  contentLength?: string
  lastModified?: string
}

export function extractStreamUrl(format: YouTubeFormat): string | null {
  if (format.url) return format.url

  const cipherText = format.signatureCipher ?? format.cipher
  if (!cipherText) return null

  const params = new URLSearchParams(cipherText)
  const url = params.get('url')
  const sp = params.get('sp') ?? 'signature'
  const sig = params.get('s')

  if (!url) return null

  if (sig) {
    const decodedSig = decodeSignature(sig)
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}${sp}=${decodedSig}`
  }

  return url
}

export function selectBestAudioFormat(formats: YouTubeFormat[]): YouTubeFormat | null {
  if (!formats || formats.length === 0) return null

  const audioFormats = formats.filter(f => {
    const mime = f.mimeType ?? ''
    return mime.includes('audio') &&
      (mime.includes('opus') || mime.includes('mp4a') || mime.includes('mp3'))
  })

  if (audioFormats.length === 0) return null

  audioFormats.sort((a, b) => {
    const aOpus = a.mimeType.includes('opus') ? 100 : 0
    const bOpus = b.mimeType.includes('opus') ? 100 : 0
    return (bOpus + (b.bitrate ?? 0)) - (aOpus + (a.bitrate ?? 0))
  })

  return audioFormats[0]
}

function decodeSignature(sig: string): string {
  return sig.split('').reverse().join('')
}

export function getYouTubeStreamUrl(videoId: string, format: YouTubeFormat): string | null {
  const url = extractStreamUrl(format)
  if (!url) return null

  const urlObj = new URL(url)
  urlObj.searchParams.set('ratebypass', 'yes')
  return urlObj.toString()
}

export async function resolveUrlWithCipher(
  streamUrl: string,
  cipherUrl: string,
  playerUrl: string,
  token?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Sonata/1.0 (https://github.com/sonata-sdk/sonata)',
  }
  if (token) headers['Authorization'] = token

  const res = await fetch(`${cipherUrl.replace(/\/+$/, '')}/resolve_url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ stream_url: streamUrl, player_url: playerUrl }),
  })

  if (!res.ok) {
    throw new Error(`Cipher service returned ${res.status}`)
  }

  const data = await res.json() as { resolved_url?: string; message?: string }
  if (!data.resolved_url) {
    throw new Error(`Cipher service: ${data.message || 'no resolved_url'}`)
  }

  return data.resolved_url
}

export async function fetchCipherSts(
  playerUrl: string,
  cipherUrl: string,
  token?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Sonata/1.0 (https://github.com/sonata-sdk/sonata)',
  }
  if (token) headers['Authorization'] = token

  const res = await fetch(`${cipherUrl.replace(/\/+$/, '')}/get_sts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ player_url: playerUrl }),
  })

  if (!res.ok) {
    throw new Error(`Cipher STS service returned ${res.status}`)
  }

  const data = await res.json() as { sts?: string; message?: string }
  if (!data.sts) {
    throw new Error(`Cipher STS: ${data.message || 'no sts'}`)
  }

  return data.sts
}
