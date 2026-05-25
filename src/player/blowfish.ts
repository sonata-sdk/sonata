import crypto from 'node:crypto'

const SECRET = 'g4el58wc0zvf9na1'
const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])
const CHUNK_SIZE = 2048

export function deriveBlowfishKey(trackId: string | number): Buffer {
  const md5 = crypto.createHash('md5').update(String(trackId), 'ascii').digest('hex')
  const key = Buffer.alloc(16)
  for (let i = 0; i < 16; i++) {
    key[i] = md5.charCodeAt(i) ^ md5.charCodeAt(i + 16) ^ SECRET.charCodeAt(i)
  }
  return key
}

export function decryptBlowfishChunk(encrypted: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('bf-cbc', key, IV)
  decipher.setAutoPadding(false)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

export function decryptDeezerBuffer(data: Buffer, trackId: string | number): Buffer {
  const key = deriveBlowfishKey(trackId)
  const result = Buffer.alloc(data.length)
  let pos = 0
  let chunkIdx = 0

  while (pos < data.length) {
    const size = Math.min(CHUNK_SIZE, data.length - pos)
    const chunk = data.subarray(pos, pos + size)
    if (chunkIdx % 3 === 0 && size === CHUNK_SIZE) {
      result.set(decryptBlowfishChunk(chunk, key), pos)
    } else {
      result.set(chunk, pos)
    }
    pos += size
    chunkIdx++
  }

  return result
}
