import { Readable } from 'node:stream'
import voiceModule from '@performanc/voice'
import type { Logger } from '../utils/logger.js'

const OPUS_FRAME_DURATION = 20

export interface VoiceConnectOptions {
  guildId: string
  userId: string
  sessionId: string
  token: string
  endpoint: string
  channelId: string
}

class OpusFrameStream extends Readable {
  constructor() {
    super({ objectMode: true, highWaterMark: 512 })
  }

  pushFrame(frame: Buffer) {
    this.push(frame)
  }

  _read() {}

  endStream() {
    this.push(null)
  }
}

export class DiscordVoice extends EventTarget {
  #connection: ReturnType<typeof voiceModule.joinVoiceChannel> | null = null
  #opts: VoiceConnectOptions | null = null
  #readyEmitted = false
  #opusStream: OpusFrameStream | null = null
  #logger: Logger | null = null

  connected = false
  ping = 0

  setLogger(logger: Logger) { this.#logger = logger }

  get ssrc() { return (this.#connection as any)?.udpInfo?.ssrc ?? 0 }

  connect(opts: VoiceConnectOptions) {
    this.#opts = opts
    this.#createConnection()
  }

  #createConnection() {
    const opts = this.#opts!
    this.#logger?.debug('voice', `Creating connection: guild=${opts.guildId} userId=${opts.userId} channelId=${opts.channelId}`)

    this.#connection = voiceModule.joinVoiceChannel({
      guildId: opts.guildId,
      userId: opts.userId,
      channelId: opts.channelId,
      encryption: 'aead_aes256_gcm_rtpsize',
    })
    ;(this.#connection as any).stuckTimeout = 30000

    this.#connection.on('stateChange', (_oldState: any, newState: any) => {
      const status = newState.status
      this.#logger?.debug('voice', `stateChange: ${_oldState?.status} -> ${status} (code=${newState.code})`)
      if (status === 'connected') {
        this.connected = true
        this.ping = (this.#connection as any)?.ping ?? 0
        if (!this.#readyEmitted) {
          this.#readyEmitted = true
          this.#logger?.debug('voice', 'dispatching ready event')
          this.dispatchEvent(new CustomEvent('ready'))
        }
      } else if (status === 'disconnected' || status === 'destroyed') {
        this.connected = false
        this.#readyEmitted = false
      }
    })
    this.#connection.on('playerStateChange', (_old: any, state: any) => {
      this.#logger?.debug('voice', `playerStateChange: ${_old?.status} -> ${state.status} (${state.reason})`)
    })
    this.#connection.on('error', (err: any) => {
      this.#logger?.error('voice', `Error: ${err?.message ?? err}`)
    })
    this.#connection.on('debug', (msg: string) => {
      this.#logger?.debug('voice', msg)
    })
  }

  feedVoiceUpdate(sessionId: string, token: string, endpoint: string) {
    if (!this.#connection) return

    const cleanEndpoint = endpoint.replace(/^wss:\/\//, '').replace(/\/\?v=\d+$/, '')
    this.#logger?.debug('voice', `feedVoiceUpdate: endpoint=${cleanEndpoint} sessionId=${sessionId}`)

    ;(this.#connection as any).voiceStateUpdate({ session_id: sessionId })
    ;(this.#connection as any).voiceServerUpdate({ token, endpoint: cleanEndpoint })
    ;(this.#connection as any).connect(() => {
      this.#logger?.debug('voice', 'connect callback fired (session description received)')
    })
  }

  sendPCM(_pcm: Buffer): number { return 0 }

  sendOpus(opus: Buffer) {
    if (!this.#connection || !this.connected) return
    if (!this.#opusStream) {
      this.#opusStream = new OpusFrameStream()
      ;(this.#connection as any).play(this.#opusStream)
    }
    this.#opusStream.pushFrame(opus)
  }

  stopSpeaking() {
    if (this.#opusStream) {
      this.#opusStream.endStream()
      this.#opusStream = null
    }
    if (this.#connection) {
      ;(this.#connection as any).stop('manual')
    }
  }

  destroy() {
    if (this.#opusStream) {
      this.#opusStream.endStream()
      this.#opusStream = null
    }
    if (this.#connection) {
      ;(this.#connection as any).destroy()
      this.#connection = null
    }
    this.connected = false
    this.#readyEmitted = false
  }

  close() {
    this.destroy()
  }
}
