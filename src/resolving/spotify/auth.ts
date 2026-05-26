import crypto from 'node:crypto'

interface EncodedSecretEntry {
  secret: string
  version: number
}

interface LocalTokenResponse {
  accessToken?: string
  accessTokenExpirationTimestampMs?: number
}

const ENCODED_SECRETS: EncodedSecretEntry[] = [
  { secret: ',7/*F("rLJ2oxaKL^f+E1xvP@N', version: 61 },
  { secret: 'OmE{ZA.J^":0FG\\Uz?[@WW', version: 60 },
  { secret: '{iOFn;4}<1PFYKPV?5{%u14]M>/V0hDH', version: 59 },
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'

function decodeSecret(encoded: string): Buffer {
  const t = 33
  const n = 9
  const byteValues = encoded.split('').map((char, index) =>
    char.charCodeAt(0) ^ ((index % t) + n),
  )
  const joined = byteValues.join('')
  const asciiBuffer = Buffer.from(joined, 'utf8')
  const hexString = asciiBuffer.toString('hex')
  return Buffer.from(hexString, 'hex')
}

function generateTOTP(
  secretHex: string,
  timestampMs: number,
  step = 30,
): string {
  const counter = Math.floor(timestampMs / 1000 / step)
  const buf = Buffer.alloc(8)
  buf.writeBigInt64BE(BigInt(counter))

  const hmac = crypto.createHmac('sha1', Buffer.from(secretHex, 'hex'))
  hmac.update(buf)
  const digest = hmac.digest()

  const offset = (digest[digest.length - 1] ?? 0) & 0xf
  const code =
    ((((digest[offset] ?? 0) & 0x7f) << 24) |
      (((digest[offset + 1] ?? 0) & 0xff) << 16) |
      (((digest[offset + 2] ?? 0) & 0xff) << 8) |
      ((digest[offset + 3] ?? 0) & 0xff)) %
    1000000

  return code.toString().padStart(6, '0')
}

async function performTokenRequest(
  secret: string,
  version: string,
  spDc: string | null | undefined,
  productType: string,
): Promise<LocalTokenResponse> {
  const isWebPlayer = productType === 'web-player'
  const serverTimeMs = isWebPlayer ? Date.now() : await getServerTime(spDc)
  const localTimeMs = Date.now()

  const totpLocal = generateTOTP(secret, localTimeMs, 30)
  const totpServer = generateTOTP(secret, serverTimeMs, 900)

  const params = new URLSearchParams({
    reason: 'init',
    productType,
    totp: totpLocal,
    totpServer,
    totpVer: version,
  })
  if (!isWebPlayer) params.set('platform', 'web')

  const url = `https://open.spotify.com/api/token?${params}`

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Origin: 'https://open.spotify.com/',
    Referer: 'https://open.spotify.com/',
    Accept: 'application/json',
  }
  if (spDc && !isWebPlayer) headers.Cookie = `sp_dc=${spDc}`

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Spotify Auth Error: ${res.status}`)
  return res.json() as Promise<LocalTokenResponse>
}

async function getServerTime(spDc?: string | null): Promise<number> {
  try {
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT }
    if (spDc) headers.Cookie = `sp_dc=${spDc}`

    const res = await fetch('https://open.spotify.com/api/server-time', {
      headers,
    })
    if (!res.ok) throw new Error('Failed to get server time')

    const data = (await res.json()) as { serverTime?: number }
    return typeof data.serverTime === 'number' ? data.serverTime : Date.now()
  } catch {
    return Date.now()
  }
}

export async function getLocalToken(
  spDc?: string | null,
  productType = 'mobile-web-player',
): Promise<LocalTokenResponse> {
  const primary = ENCODED_SECRETS[0]
  if (!primary) throw new Error('Missing primary encoded secret')

  const nativeSecret = decodeSecret(primary.secret).toString('hex')
  const nativeVersion = String(primary.version)

  return performTokenRequest(nativeSecret, nativeVersion, spDc, productType)
}
