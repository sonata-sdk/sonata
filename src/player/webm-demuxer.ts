import { Transform, type TransformCallback } from 'node:stream'

const TOO_SHORT = Symbol('TOO_SHORT')
const INVALID_VINT = Symbol('INVALID_VINT')

const OPUS_HEAD = Buffer.from([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64])

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

// EBML IDs we care about
const EBML = 0x1a45dfa3n
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
const TIMECODE = 0xe7n

const A_OPUS = 'A_OPUS'

function readEbmlId(buf: Buffer, offset: number): { id: bigint; len: number } | typeof TOO_SHORT | typeof INVALID_VINT {
  const len = readVintLength(buf, offset)
  if (len === TOO_SHORT || len === INVALID_VINT) return len
  const val = readVint(buf, offset, offset + len)
  if (val === TOO_SHORT) return TOO_SHORT
  return { id: val, len }
}

function readEbmlSize(buf: Buffer, offset: number): { size: bigint; totalLen: number } | typeof TOO_SHORT | typeof INVALID_VINT {
  const len = readVintLength(buf, offset)
  if (len === TOO_SHORT || len === INVALID_VINT) return len
  const size = readVint(buf, offset, offset + len)
  if (size === TOO_SHORT) return TOO_SHORT
  return { size, totalLen: len }
}

function isMasterElement(id: bigint): boolean {
  return id === SEGMENT || id === CLUSTER || id === TRACKS || id === TRACK_ENTRY || id === BLOCK_GROUP
}

export class WebmOpusDemuxer extends Transform {
  #buffer: Buffer[] = []
  #bufferLen = 0
  #segmentSize: bigint | null = null
  #segmentRead = 0n
  #clusterSize: bigint | null = null
  #clusterRead = 0n
  #audioTrackNum: number | null = null
  #foundOpus = false
  #inCluster = false
  #inSegment = false

  constructor() {
    super({ readableObjectMode: true })
  }

  #ensureBuffer(minSize: number): Buffer {
    if (this.#bufferLen >= minSize) {
      const buf = this.#buffer.length === 1 ? this.#buffer[0] : Buffer.concat(this.#buffer, this.#bufferLen)
      return buf
    }
    return Buffer.alloc(0)
  }

  #consume(n: number): void {
    let remaining = n
    while (remaining > 0 && this.#buffer.length > 0) {
      const chunk = this.#buffer[0]
      if (chunk.length <= remaining) {
        remaining -= chunk.length
        this.#bufferLen -= chunk.length
        this.#buffer.shift()
      } else {
        this.#buffer[0] = chunk.subarray(remaining)
        this.#bufferLen -= remaining
        remaining = 0
      }
    }
  }

  #readTag(): { id: bigint; idLen: number; size: bigint; sizeLen: number; data: Buffer | null } | typeof TOO_SHORT | typeof INVALID_VINT | null {
    if (this.#bufferLen < 2) return TOO_SHORT

    const buf = this.#ensureBuffer(this.#bufferLen)

    let offset = 0
    const ebmlId = readEbmlId(buf, offset)
    if (ebmlId === TOO_SHORT) return TOO_SHORT
    if (ebmlId === INVALID_VINT) {
      this.#consume(1)
      return null
    }
    offset += ebmlId.len

    if (offset >= buf.length) return TOO_SHORT

    const sizeInfo = readEbmlSize(buf, offset)
    if (sizeInfo === TOO_SHORT) return TOO_SHORT
    if (sizeInfo === INVALID_VINT) {
      this.#consume(1)
      return null
    }
    offset += sizeInfo.totalLen

    const totalHeaderLen = offset
    const dataLen = Number(sizeInfo.size)

    // If data size is unknown (all 1s), read til end of parent
    const isUnknownSize = sizeInfo.size === (1n << BigInt(7 * sizeInfo.totalLen)) - 1n

    const totalLen = isUnknownSize ? buf.length : totalHeaderLen + dataLen
    if (buf.length < totalLen) return TOO_SHORT

    let data: Buffer | null = null
    if (!isMasterElement(ebmlId.id) && !isUnknownSize) {
      data = buf.subarray(totalHeaderLen, totalHeaderLen + dataLen)
    }

    const result = { id: ebmlId.id, idLen: ebmlId.len, size: sizeInfo.size, sizeLen: sizeInfo.totalLen, data }

    // Consume all bytes including the element data
    const consumeLen = isUnknownSize ? buf.length : totalHeaderLen + dataLen
    this.#consume(consumeLen)

    return result
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
    this.#buffer.push(chunk)
    this.#bufferLen += chunk.length

    while (true) {
      const tag = this.#readTag()
      if (tag === TOO_SHORT) break
      if (tag === INVALID_VINT) continue
      if (tag === null) continue

      const { id, size, data } = tag

      if (id === EBML) {
        // EBML header, skip
        continue
      }

      if (id === SEGMENT) {
        this.#inSegment = true
        this.#segmentSize = size
        this.#segmentRead = 0n
        continue
      }

      if (id === TRACKS && data) {
        // Parse tracks to find the Opus audio track
        this.#parseTracks(data)
        continue
      }

      if (id === CLUSTER) {
        this.#inCluster = true
        this.#clusterSize = size
        this.#clusterRead = 0n
        continue
      }

      if (id === SIMPLE_BLOCK && this.#audioTrackNum !== null && data && this.#inCluster) {
        this.#emitBlock(data)
        continue
      }

      if (id === BLOCK && this.#audioTrackNum !== null && data && this.#inCluster) {
        this.#emitBlock(data)
        continue
      }
    }

    done()
  }

  #emitBlock(data: Buffer): void {
    if (data.length < 4) return
    const trackNum = (data[0] & 0x0f)
    if (trackNum !== this.#audioTrackNum) return
    // Skip block header (track number + timestamp(2) + flags(1) = 4 bytes)
    const opusData = data.subarray(4)
    if (opusData.length > 0) {
      this.push(opusData)
    }
  }

  #parseTracks(data: Buffer): void {
    let offset = 0
    if (offset >= data.length) return
    const { idLen, sizeLen } = this.#readIdSize(data, offset)
    if (idLen === -1) return
    offset += idLen + sizeLen
    // This re-uses the same buffer, need to parse manually
    // Simpler: iterate through track entries
    let inTrack = false
    let trackNum = 0
    let trackType = 0
    let codec = ''

    while (offset < data.length) {
      if (data[offset] === undefined) break
      const tmp = readVintLength(data, offset)
      if (typeof tmp !== 'number') break
      const tid = readVint(data, offset, offset + tmp)
      offset += tmp
      if (tid === TOO_SHORT) break
      const tmp2 = readVintLength(data, offset)
      if (typeof tmp2 !== 'number') break
      const tsize = readVint(data, offset, offset + tmp2)
      offset += tmp2
      if (tsize === TOO_SHORT) break
      const tsizeN = Number(tsize)

      if (tid === TRACK_ENTRY) {
        if (inTrack && this.#foundOpus && trackType === 2 && codec === A_OPUS) {
          this.#audioTrackNum = trackNum
          return
        }
        inTrack = true
        trackNum = 0
        trackType = 0
        codec = ''
      } else if (inTrack) {
        if (tid === TRACK_NUMBER && data[offset] !== undefined) {
          trackNum = data[offset]
        } else if (tid === TRACK_TYPE && data[offset] !== undefined) {
          trackType = data[offset]
        } else if (tid === CODEC_ID) {
          const end = Math.min(offset + tsizeN, data.length)
          codec = data.subarray(offset, end).toString()
          if (codec === A_OPUS) this.#foundOpus = true
        }
      }
      offset += tsizeN
    }
  }

  #readIdSize(buf: Buffer, offset: number): { idLen: number; sizeLen: number } {
    const idLen = readVintLength(buf, offset)
    if (typeof idLen !== 'number') return { idLen: -1, sizeLen: -1 }
    const sizeLen = readVintLength(buf, offset + idLen)
    if (typeof sizeLen !== 'number') return { idLen: -1, sizeLen: -1 }
    return { idLen, sizeLen }
  }
}
