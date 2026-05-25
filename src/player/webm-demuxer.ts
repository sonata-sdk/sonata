import { Transform, type TransformCallback } from 'node:stream'

const TOO_SHORT = Symbol('TOO_SHORT')
const INVALID_VINT = Symbol('INVALID_VINT')

function readVintLength(buf: Buffer, index: number): number | typeof TOO_SHORT | typeof INVALID_VINT {
  if (index < 0 || index >= buf.length) return TOO_SHORT
  const firstByte = buf[index]
  if (firstByte === undefined) return TOO_SHORT
  if (firstByte === 0) return INVALID_VINT
  let n = 0
  for (; n < 8; n++) if ((1 << (7 - n)) & firstByte) break
  n++
  return index + n > buf.length ? TOO_SHORT : n
}

function readVint(buf: Buffer, start: number, end: number): bigint | typeof TOO_SHORT {
  if (end > buf.length) return TOO_SHORT
  const len = readVintLength(buf, start)
  if (typeof len !== 'number') return TOO_SHORT
  const mask = (1 << (8 - len)) - 1
  const startByte = buf[start]
  if (startByte === undefined) return TOO_SHORT
  let value = BigInt(startByte & mask)
  for (let i = start + 1; i < end; i++) {
    const nextByte = buf[i]
    if (nextByte === undefined) return TOO_SHORT
    value = (value << 8n) | BigInt(nextByte)
  }
  return value
}

const SEGMENT = 0x18538067n
const CLUSTER = 0x1f43b675n
const TRACKS = 0x1654ae6bn
const TRACK_ENTRY = 0xaen
const TRACK_NUMBER = 0xd7n
const TRACK_TYPE = 0x83n
const CODEC_ID = 0x86n
const SIMPLE_BLOCK = 0xa3n
const BLOCK_GROUP = 0xa0n
const BLOCK = 0xa1n

const A_OPUS = 'A_OPUS'

function readEbmlId(buf: Buffer, offset: number): { id: bigint; len: number } | typeof TOO_SHORT | typeof INVALID_VINT {
  const len = readVintLength(buf, offset)
  if (len === TOO_SHORT || len === INVALID_VINT) return len
  let value = 0n
  for (let i = 0; i < len; i++) {
    const b = buf[offset + i]
    if (b === undefined) return TOO_SHORT
    value = (value << 8n) | BigInt(b)
  }
  return { id: value, len }
}

function readEbmlSize(buf: Buffer, offset: number): { size: bigint; totalLen: number } | typeof TOO_SHORT | typeof INVALID_VINT {
  const totalLen = readVintLength(buf, offset)
  if (totalLen === TOO_SHORT || totalLen === INVALID_VINT) return totalLen
  const value = readVint(buf, offset, offset + totalLen)
  if (value === TOO_SHORT) return value
  return { size: value, totalLen }
}

function isUnknownSizeValue(size: bigint, totalLen: number): boolean {
  const allOnes = (1n << BigInt(8 * totalLen - 1)) - 1n
  return size === allOnes
}

function isMasterElement(id: bigint): boolean {
  return id === SEGMENT || id === CLUSTER || id === TRACKS || id === TRACK_ENTRY || id === BLOCK_GROUP
}

export class WebmOpusDemuxer extends Transform {
  #buf: Buffer[] = []
  #bufLen = 0
  #foundOpus = false
  #audioTrackNum: number | null = null
  #inCluster = false

  constructor() {
    super({ readableObjectMode: true })
  }

  #compact(): Buffer {
    if (this.#buf.length <= 1) return this.#buf[0] || Buffer.alloc(0)
    const c = Buffer.concat(this.#buf, this.#bufLen)
    this.#buf = [c]
    return c
  }

  #skip(n: number): void {
    let r = n
    while (r > 0 && this.#buf.length > 0) {
      const c = this.#buf[0]
      if (c.length <= r) {
        r -= c.length
        this.#bufLen -= c.length
        this.#buf.shift()
      } else {
        this.#buf[0] = c.subarray(r)
        this.#bufLen -= r
        r = 0
      }
    }
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
    this.#buf.push(chunk)
    this.#bufLen += chunk.length

    while (this.#bufLen > 0) {
      const buf = this.#compact()
      if (buf.length < 2) break

      const ebmlId = readEbmlId(buf, 0)
      if (ebmlId === TOO_SHORT) break
      if (ebmlId === INVALID_VINT) { this.#skip(1); continue }

      const sizeInfo = readEbmlSize(buf, ebmlId.len)
      if (sizeInfo === TOO_SHORT) break
      if (sizeInfo === INVALID_VINT) { this.#skip(1); continue }

      const id = ebmlId.id
      const headerLen = ebmlId.len + sizeInfo.totalLen
      const isUnk = isUnknownSizeValue(sizeInfo.size, sizeInfo.totalLen)
      const dataLen = isUnk ? 0 : Number(sizeInfo.size)
      const totalLen = headerLen + dataLen
      const isMaster = isMasterElement(id)

      if (!isMaster && !isUnk && buf.length < totalLen) break

      if (isMaster) {
        this.#skip(headerLen)
        if (id === CLUSTER) this.#inCluster = true
        continue
      }

      this.#skip(totalLen)

      if (id === TRACK_NUMBER && this.#audioTrackNum === null) {
        let val = 0n
        for (let i = headerLen; i < headerLen + dataLen; i++) {
          val = (val << 8n) | BigInt(buf[i])
        }
        this.#audioTrackNum = Number(val)
      } else if (id === CODEC_ID) {
        const codec = buf.subarray(headerLen, headerLen + dataLen).toString()
        if (codec === A_OPUS) this.#foundOpus = true
      } else if ((id === SIMPLE_BLOCK || id === BLOCK) && this.#audioTrackNum !== null && this.#inCluster) {
        const block = buf.subarray(headerLen, headerLen + dataLen)
        if (block.length >= 4) {
          const vlen = readVintLength(block, 0)
          if (typeof vlen === 'number' && block.length > vlen + 3) {
            const dec = readVint(block, 0, vlen)
            const match = typeof dec !== 'symbol' && Number(dec) === this.#audioTrackNum
            if (match) {
              this.push(block.subarray(vlen + 3))
            }
          }
        }
      }
    }

    done()
  }
}
