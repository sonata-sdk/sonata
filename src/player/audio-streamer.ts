import https from 'node:https'
import http from 'node:http'
import { DiscordVoice } from '../discord/voice.js'
import { AudioMixer } from '../audio/mixer.js'
import { WebmOpusDemuxer } from './webm-demuxer.js'
import type { Track } from '../types/index.js'
import type { Logger } from '../utils/logger.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const OpusScript = require('opusscript') as typeof import('opusscript')

const SAMPLE_RATE = 48000
const FRAME_DURATION = 20
const FRAME_SIZE = 960 * 2 * 2
const CHANNELS = 2
const FRAME_SAMPLES = 960

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'

interface CrossfadeConfig {
  duration: number
  fadeIn: number
  fadeOut: number
}

function applyFade(buf: Buffer, sampleCount: number, totalFadeSamples: number, fadeIn: boolean): Buffer {
  if (totalFadeSamples <= 0) return buf
  const out = Buffer.alloc(buf.length)
  const samplesToFade = Math.min(sampleCount, totalFadeSamples)
  for (let i = 0; i < samplesToFade; i++) {
    const gain = fadeIn ? i / totalFadeSamples : (totalFadeSamples - i) / totalFadeSamples
    const idx = i * 2
    const s = buf.readInt16LE(idx)
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * gain))), idx)
  }
  for (let i = samplesToFade; i < sampleCount; i++) {
    out.writeInt16LE(buf.readInt16LE(i * 2), i * 2)
  }
  return out
}

export class AudioStreamer extends EventTarget {
  #voice: DiscordVoice
  #currentTrack: Track | null = null
  #nextTrack: Track | null = null
  #playing = false
  #paused = false
  #position = 0
  #startTime = 0
  #seekPosition = 0
  #positionInterval: ReturnType<typeof setInterval> | null = null
  #sendInterval: ReturnType<typeof setInterval> | null = null
  #pcmBuffer: Buffer[] = []
  #nextPcmBuffer: Buffer[] = []
  #volume = 1.0
  #crossfade: CrossfadeConfig | null = null
  #isCrossfading = false
  #crossfadeStart = 0
  #crossfadingOut = false
  #mixer: AudioMixer | null = null
  #logger: Logger | null = null

  #opusDecoder: InstanceType<typeof OpusScript> | null = null
  #httpReq: http.ClientRequest | null = null
  #demuxer: WebmOpusDemuxer | null = null
  #nextHttpReq: http.ClientRequest | null = null
  #nextDemuxer: WebmOpusDemuxer | null = null
  #streamEnded = false
  #nextStreamEnded = false

  constructor(voice: DiscordVoice) {
    super()
    this.#voice = voice
    this.#mixer = new AudioMixer()
    voice.addEventListener('ready', () => {
      if (this.#currentTrack && !this.#playing) this.#startStream()
    })
  }

  setLogger(logger: Logger) { this.#logger = logger }

  setNormalization(enabled: boolean, target = -14) {
    if (this.#mixer) {
      this.#mixer.setFilters({ normalization: { enabled, target } })
    }
  }

  get mixer() { return this.#mixer }

  get playing() { return this.#playing }
  get paused() { return this.#paused }
  get track() { return this.#currentTrack }
  get position() {
    if (!this.#playing) return this.#seekPosition
    return this.#seekPosition + (Date.now() - this.#startTime)
  }

  setCrossfade(cfg: CrossfadeConfig | null) { this.#crossfade = cfg }

  setNextTrack(track: Track) {
    this.#nextTrack = track
    if (this.#playing && this.#crossfade && this.#crossfade.duration > 0) {
      this.#beginCrossfade()
    }
  }

  #getOpusDecoder(): InstanceType<typeof OpusScript> {
    if (!this.#opusDecoder) {
      this.#opusDecoder = new OpusScript(SAMPLE_RATE, CHANNELS, OpusScript.Application.AUDIO)
    }
    return this.#opusDecoder
  }

  #beginCrossfade() {
    if (!this.#nextTrack || this.#isCrossfading) return
    this.#logger?.debug('streamer', `beginning crossfade to "${this.#nextTrack.info.title}"`)
    this.#isCrossfading = true
    this.#crossfadeStart = Date.now()
    this.#crossfadingOut = true

    const uri = this.#nextTrack.userData?.audioUrl as string ?? this.#nextTrack.info.uri
    if (!uri) return

    this.#nextStreamEnded = false
    this.#nextPcmBuffer = []

    this.#nextDemuxer = new WebmOpusDemuxer()
    this.#nextDemuxer.on('data', (opusPacket: Buffer) => {
      try {
        const pcm = this.#getOpusDecoder().decode(opusPacket)
        this.#nextPcmBuffer.push(Buffer.from(pcm))
      } catch {}
    })
    this.#nextDemuxer.on('end', () => {
      this.#nextStreamEnded = true
    })
    this.#nextDemuxer.on('error', () => {})

    const opts = new URL(uri)
    const req = (opts.protocol === 'https:' ? https : http).get(opts, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://www.youtube.com',
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy()
        this.#startHttpsStream(res.headers.location, true)
        return
      }
      if (res.statusCode !== 200) {
        this.#logger?.error('streamer', `crossfade HTTP ${res.statusCode} for ${uri}`)
        return
      }
      res.pipe(this.#nextDemuxer!)
    })
    req.on('error', () => {})
    this.#nextHttpReq = req
  }

  async play(track: Track, startTime = 0) {
    this.#logger?.debug('streamer', `play: track="${track.info.title}" voice.connected=${this.#voice.connected}`)

    if (this.#playing && this.#crossfade && this.#crossfade.duration > 0 && this.#currentTrack && !this.#isCrossfading) {
      this.setNextTrack(track)
      return
    }

    if (this.#isCrossfading) {
      this.#nextTrack = track
      return
    }

    this.#currentTrack = track
    this.#seekPosition = startTime
    this.#position = 0
    this.#paused = false

    if (!this.#voice.connected) {
      this.#logger?.debug('streamer', `play: voice not connected, waiting for ready event`)
      return
    }

    this.#startStream()
  }

  #startStream() {
    if (!this.#currentTrack) return

    const uri = this.#currentTrack.userData?.audioUrl as string ?? this.#currentTrack.info.uri
    if (!uri) {
      this.#onEnd('loadFailed')
      return
    }

    this.#logger?.debug('streamer', `starting HTTP stream for ${uri}`)

    this.#playing = true
    this.#startTime = Date.now()
    this.#streamEnded = false
    this.#pcmBuffer = []

    this.dispatchEvent(new CustomEvent('start', { detail: { track: this.#currentTrack } }))

    this.#demuxer = new WebmOpusDemuxer()
    this.#demuxer.on('data', (opusPacket: Buffer) => {
      if (this.#paused) return
      try {
        const pcm = this.#getOpusDecoder().decode(opusPacket)
        this.#pcmBuffer.push(Buffer.from(pcm))
      } catch {}
    })
    this.#demuxer.on('end', () => {
      this.#logger?.debug('streamer', `demuxer stream ended`)
      this.#streamEnded = true
    })
    this.#demuxer.on('error', () => {})

    this.#startHttpsStream(uri, false)

    this.#sendInterval = setInterval(() => {
      if (this.#paused || !this.#playing) return
      if (this.#pcmBuffer.length === 0) {
        if (this.#streamEnded) {
          if (this.#isCrossfading) {
            this.#finishCrossfade()
          } else {
            this.#onEnd('finished')
          }
        }
        return
      }
      if (this.#isCrossfading && this.#nextPcmBuffer.length > 0) {
        this.#sendCrossfadeFrame()
      } else {
        this.#sendNextFrame()
      }
    }, FRAME_DURATION)

    this.#positionInterval = setInterval(() => {
      this.#seekPosition = this.position
    }, 1000)
  }

  #startHttpsStream(uri: string, isNext: boolean) {
    const req = https.get(uri, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://www.youtube.com',
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy()
        this.#startHttpsStream(res.headers.location, isNext)
        return
      }
      if (res.statusCode !== 200) {
        this.#logger?.error('streamer', `HTTP ${res.statusCode} for ${uri}`)
        if (!isNext) this.#onEnd('loadFailed')
        return
      }
      const targetDemuxer = isNext ? this.#nextDemuxer : this.#demuxer
      if (targetDemuxer) res.pipe(targetDemuxer)
    })
    req.on('error', (err) => {
      this.#logger?.error('streamer', `HTTP error: ${err.message}`)
      if (!isNext) this.#onEnd('loadFailed')
    })
    if (isNext) {
      this.#nextHttpReq = req
    } else {
      this.#httpReq = req
    }
  }

  #sendCrossfadeFrame() {
    const cf = this.#crossfade
    if (!cf) {
      this.#isCrossfading = false
      this.#sendNextFrame()
      return
    }

    const fadeOutDur = cf.fadeOut || cf.duration
    const fadeInDur = cf.fadeIn || cf.duration
    const elapsed = Date.now() - this.#crossfadeStart
    const fadeOutTotalSamples = (fadeOutDur / 1000) * SAMPLE_RATE
    const fadeInTotalSamples = (fadeInDur / 1000) * SAMPLE_RATE
    const fadeOutProgress = Math.min(1, elapsed / fadeOutDur)
    const fadeInProgress = Math.min(1, elapsed / fadeInDur)

    let needed = FRAME_SIZE
    let frame = Buffer.alloc(0)

    while (needed > 0 && this.#pcmBuffer.length > 0) {
      const chunk = this.#pcmBuffer[0]
      if (chunk.length <= needed) {
        frame = Buffer.concat([frame, chunk])
        needed -= chunk.length
        this.#pcmBuffer.shift()
      } else {
        frame = Buffer.concat([frame, chunk.subarray(0, needed)])
        this.#pcmBuffer[0] = chunk.subarray(needed)
        needed = 0
      }
    }

    if (frame.length < FRAME_SIZE) {
      if (this.#nextPcmBuffer.length > 0) {
        this.#finishCrossfade()
        return
      }
      return
    }

    const sampleCount = frame.length / 2
    for (let i = 0; i < sampleCount; i++) {
      const gain = 1 - fadeOutProgress
      const idx = i * 2
      const s = frame.readInt16LE(idx)
      frame.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * gain))), idx)
    }

    needed = FRAME_SIZE
    let nextFrame = Buffer.alloc(0)
    while (needed > 0 && this.#nextPcmBuffer.length > 0) {
      const chunk = this.#nextPcmBuffer[0]
      if (chunk.length <= needed) {
        nextFrame = Buffer.concat([nextFrame, chunk])
        needed -= chunk.length
        this.#nextPcmBuffer.shift()
      } else {
        nextFrame = Buffer.concat([nextFrame, chunk.subarray(0, needed)])
        this.#nextPcmBuffer[0] = chunk.subarray(needed)
        needed = 0
      }
    }

    if (nextFrame.length >= FRAME_SIZE) {
      for (let i = 0; i < sampleCount; i++) {
        const gain = fadeInProgress
        const idx = i * 2
        const s = nextFrame.readInt16LE(idx)
        nextFrame.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * gain))), idx)
      }

      for (let i = 0; i < frame.length; i += 2) {
        const a = frame.readInt16LE(i)
        const b = nextFrame.readInt16LE(i)
        let mixed = a + b
        if (mixed > 32767) mixed = 32767
        if (mixed < -32768) mixed = -32768
        frame.writeInt16LE(mixed, i)
      }
    }

    if (fadeOutProgress >= 1 && this.#nextPcmBuffer.length > 0) {
      this.#finishCrossfade()
      return
    }

    if (this.#mixer) {
      const pcm = new Int16Array(frame.buffer, frame.byteOffset, frame.byteLength / 2)
      const processed = this.#mixer.apply(pcm, SAMPLE_RATE)
      frame = Buffer.from(processed.buffer as ArrayBuffer)
    }
    this.#voice.sendPCM(frame)
  }

  #finishCrossfade() {
    this.#isCrossfading = false
    this.#nextPcmBuffer = []

    this.#cleanupHttp(false)

    const oldTrack = this.#currentTrack
    if (this.#nextTrack) {
      this.#currentTrack = this.#nextTrack
      this.#nextTrack = null
      this.#seekPosition = 0
      this.#startTime = Date.now()
      this.#demuxer = this.#nextDemuxer
      this.#nextDemuxer = null
      this.#httpReq = this.#nextHttpReq
      this.#nextHttpReq = null
      this.#streamEnded = this.#nextStreamEnded
      this.#nextStreamEnded = false
      this.#pcmBuffer = [...this.#nextPcmBuffer]
      this.#nextPcmBuffer = []

      this.dispatchEvent(new CustomEvent('start', { detail: { track: this.#currentTrack } }))
    }

    if (oldTrack) {
      this.dispatchEvent(new CustomEvent('crossfade', { detail: { oldTrack, newTrack: this.#currentTrack } }))
    }
  }

  #sendNextFrame() {
    let needed = FRAME_SIZE
    let frame = Buffer.alloc(0)

    while (needed > 0 && this.#pcmBuffer.length > 0) {
      const chunk = this.#pcmBuffer[0]
      if (chunk.length <= needed) {
        frame = Buffer.concat([frame, chunk])
        needed -= chunk.length
        this.#pcmBuffer.shift()
      } else {
        frame = Buffer.concat([frame, chunk.subarray(0, needed)])
        this.#pcmBuffer[0] = chunk.subarray(needed)
        needed = 0
      }
    }

    if (frame.length >= FRAME_SIZE) {
      if (this.#mixer) {
        const pcm = new Int16Array(frame.buffer, frame.byteOffset, frame.byteLength / 2)
        const processed = this.#mixer.apply(pcm, SAMPLE_RATE)
        frame = Buffer.from(processed.buffer as ArrayBuffer)
      }
      this.#voice.sendPCM(frame)
    }
  }

  pause() {
    this.#paused = true
    this.#seekPosition = this.position
    this.#voice.stopSpeaking()
    this.dispatchEvent(new CustomEvent('pause'))
  }

  resume() {
    if (!this.#paused) return
    this.#paused = false
    this.#startTime = Date.now()
    this.dispatchEvent(new CustomEvent('resume'))
  }

  seek(position: number) {
    this.#seekPosition = Math.max(0, position)
    this.#startTime = Date.now()
    this.#isCrossfading = false
    this.#cleanupHttp(true)
    this.#nextPcmBuffer = []
    this.#nextTrack = null
    if (this.#currentTrack) {
      this.#startStream()
    }
  }

  setVolume(v: number) {
    this.#volume = Math.max(0, Math.min(1, v / 100))
  }

  stop() {
    this.#playing = false
    this.#paused = false
    this.#seekPosition = 0
    this.#startTime = 0
    this.#currentTrack = null
    this.#nextTrack = null
    this.#isCrossfading = false

    this.#clearIntervals()
    this.#cleanupHttp(false)
    this.#cleanupHttp(true)
    this.#pcmBuffer = []
    this.#nextPcmBuffer = []
    this.#voice.stopSpeaking()
  }

  #clearIntervals() {
    if (this.#sendInterval) {
      clearInterval(this.#sendInterval)
      this.#sendInterval = null
    }
    if (this.#positionInterval) {
      clearInterval(this.#positionInterval)
      this.#positionInterval = null
    }
  }

  #cleanupHttp(isNext: boolean) {
    const req = isNext ? this.#nextHttpReq : this.#httpReq
    const demuxer = isNext ? this.#nextDemuxer : this.#demuxer

    if (req) {
      req.destroy()
      if (isNext) this.#nextHttpReq = null
      else this.#httpReq = null
    }
    if (demuxer) {
      demuxer.destroy()
      if (isNext) this.#nextDemuxer = null
      else this.#demuxer = null
    }
  }

  #onEnd(reason: string) {
    this.#playing = false

    this.#clearIntervals()
    this.#cleanupHttp(false)
    this.#cleanupHttp(true)

    this.#voice.stopSpeaking()

    const track = this.#currentTrack
    this.#currentTrack = null
    this.#nextTrack = null
    this.#isCrossfading = false

    this.dispatchEvent(new CustomEvent('end', { detail: { track, reason } }))
  }
}
