import { spawn, ChildProcess } from 'node:child_process'
import { DiscordVoice } from '../discord/voice.js'
import { AudioMixer } from '../audio/mixer.js'
import type { Track } from '../types/index.js'

const SAMPLE_RATE = 48000
const FRAME_DURATION = 20
const FRAME_SIZE = 960 * 2 * 2

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
  #proc: ChildProcess | null = null
  #nextProc: ChildProcess | null = null
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

  constructor(voice: DiscordVoice) {
    super()
    this.#voice = voice
    this.#mixer = new AudioMixer()
    voice.addEventListener('ready', () => {
      if (this.#currentTrack && !this.#playing) this.#startStream()
    })
  }

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

  #beginCrossfade() {
    if (!this.#nextTrack || this.#isCrossfading) return
    console.log(`[Streamer] beginning crossfade to "${this.#nextTrack.info.title}"`)
    this.#isCrossfading = true
    this.#crossfadeStart = Date.now()
    this.#crossfadingOut = true

    const uri = this.#nextTrack.info.uri
    if (!uri) return

    const args = [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', uri,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      '-loglevel', 'quiet',
      'pipe:1',
    ]

    this.#nextProc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] })
    this.#nextProc.on('error', () => {})
    const stdout = this.#nextProc.stdout
    if (!stdout) {
      this.#nextProc = null
      return
    }
    stdout.on('data', (chunk: Buffer) => {
      this.#nextPcmBuffer.push(chunk)
    })
    stdout.on('end', () => {})
    this.#nextProc.on('exit', () => { this.#nextProc = null })
  }

  async play(track: Track, startTime = 0) {
    console.log(`[Streamer] play: track="${track.info.title}" voice.connected=${this.#voice.connected}`)

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
      console.log(`[Streamer] play: voice not connected, waiting for ready event`)
      return
    }

    this.#startStream()
  }

  #startStream() {
    if (!this.#currentTrack) return

    const uri = this.#currentTrack.info.uri
    if (!uri) {
      this.#onEnd('loadFailed')
      return
    }

    const args = [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', uri,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      '-loglevel', 'quiet',
      'pipe:1',
    ]

    if (this.#seekPosition > 0) {
      args.unshift('-ss', String(this.#seekPosition / 1000))
    }

    console.log(`[Streamer] starting ffmpeg`)

    this.#proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] })
    this.#proc.on('error', (e) => console.log(`[Streamer] ffmpeg error: ${e.message}`))

    const stdout = this.#proc.stdout
    if (!stdout) {
      this.#onEnd('loadFailed')
      return
    }

    this.#playing = true
    this.#startTime = Date.now()
    this.dispatchEvent(new CustomEvent('start', { detail: { track: this.#currentTrack } }))

    this.#pcmBuffer = []
    let feedDone = false

    stdout.on('data', (chunk: Buffer) => {
      if (this.#paused) return
      this.#pcmBuffer.push(chunk)
    })

    stdout.on('end', () => {
      console.log(`[Streamer] ffmpeg done, total PCM buffered`)
      feedDone = true
    })

    this.#proc.on('exit', (code, signal) => {
      console.log(`[Streamer] ffmpeg exit: code=${code} signal=${signal}`)
      feedDone = true
      if (code !== 0 && this.#playing) {
        this.#onEnd('loadFailed')
      }
    })

    this.#sendInterval = setInterval(() => {
      if (this.#paused || !this.#playing) return
      if (this.#pcmBuffer.length === 0) {
        if (feedDone) {
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

    if (this.#proc) {
      this.#proc.kill('SIGKILL')
      this.#proc = null
    }

    const oldTrack = this.#currentTrack
    if (this.#nextTrack) {
      this.#currentTrack = this.#nextTrack
      this.#nextTrack = null
      this.#seekPosition = 0
      this.#startTime = Date.now()
      this.#proc = this.#nextProc
      this.#nextProc = null
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
    if (this.#proc) {
      this.#proc.kill('SIGSTOP')
    }
    if (this.#nextProc) {
      this.#nextProc.kill('SIGSTOP')
    }
    this.dispatchEvent(new CustomEvent('pause'))
  }

  resume() {
    if (!this.#paused) return
    this.#paused = false
    this.#startTime = Date.now()
    if (this.#proc) {
      this.#proc.kill('SIGCONT')
    }
    if (this.#nextProc) {
      this.#nextProc.kill('SIGCONT')
    }
    this.dispatchEvent(new CustomEvent('resume'))
  }

  seek(position: number) {
    this.#seekPosition = Math.max(0, position)
    this.#startTime = Date.now()
    this.#isCrossfading = false
    if (this.#nextProc) {
      this.#nextProc.kill('SIGKILL')
      this.#nextProc = null
    }
    this.#nextPcmBuffer = []
    this.#nextTrack = null
    this.#proc?.kill('SIGKILL')
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

    if (this.#sendInterval) {
      clearInterval(this.#sendInterval)
      this.#sendInterval = null
    }
    if (this.#positionInterval) {
      clearInterval(this.#positionInterval)
      this.#positionInterval = null
    }
    if (this.#proc) {
      this.#proc.kill('SIGKILL')
      this.#proc = null
    }
    if (this.#nextProc) {
      this.#nextProc.kill('SIGKILL')
      this.#nextProc = null
    }
    this.#pcmBuffer = []
    this.#nextPcmBuffer = []
    this.#voice.stopSpeaking()
  }

  #onEnd(reason: string) {
    this.#playing = false

    if (this.#sendInterval) {
      clearInterval(this.#sendInterval)
      this.#sendInterval = null
    }
    if (this.#positionInterval) {
      clearInterval(this.#positionInterval)
      this.#positionInterval = null
    }
    if (this.#proc) {
      this.#proc.kill('SIGKILL')
      this.#proc = null
    }
    if (this.#nextProc) {
      this.#nextProc.kill('SIGKILL')
      this.#nextProc = null
    }

    this.#voice.stopSpeaking()

    const track = this.#currentTrack
    this.#currentTrack = null
    this.#nextTrack = null
    this.#isCrossfading = false

    this.dispatchEvent(new CustomEvent('end', { detail: { track, reason } }))
  }
}
