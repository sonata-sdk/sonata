import OpusScript from 'opusscript'
import { joinVoiceChannel } from '@sonata-sdk/voice'
import type { Logger } from '../utils/logger.js'

const OPUS_FRAME_SIZE = 960
const PCM_FRAME_SIZE = OPUS_FRAME_SIZE * 2 * 2

export interface VoiceConnectOptions {
  guildId: string
  userId: string
  sessionId: string
  token: string
  endpoint: string
  channelId: string
}

export class DiscordVoice extends EventTarget {
  #connection: ReturnType<typeof joinVoiceChannel> | null = null
  #opts: VoiceConnectOptions | null = null
  #readyEmitted = false
  #encoder: any = null
  #hasSpoken = false
  #logger: Logger | null = null

  connected = false
  ping = 0

  setLogger(logger: Logger) { this.#logger = logger }

  get ssrc() { return this.#connection?.udpInfo?.ssrc ?? 0 }
  get speaking() { return this.#connection?.playerState?.status === 'playing' }

  connect(opts: VoiceConnectOptions) {
    this.#opts = opts
    this.#createConnection()
  }

  #createConnection() {
    const opts = this.#opts!
    this.#logger?.debug('voice', `Creating connection: guild=${opts.guildId} userId=${opts.userId} channelId=${opts.channelId}`)

    this.#connection = joinVoiceChannel({
      guildId: opts.guildId,
      userId: opts.userId,
      channelId: opts.channelId,
      encryption: 'aead_aes256_gcm_rtpsize',
    })

    this.#logger?.debug('voice', `Connection object created, initial state=${this.#connection.state?.status}`)

    this.#connection.on('stateChange', (_oldState: any, newState: any) => {
      const status = newState.status
      const reason = newState.reason
      const code = newState.code
      this.#logger?.debug('voice', `stateChange: ${_oldState?.status} -> ${status} (reason=${reason}, code=${code})`)
      if (status === 'connected') {
        this.connected = true
        this.ping = this.#connection?.ping ?? 0
        if (!this.#readyEmitted) {
          this.#readyEmitted = true
          this.dispatchEvent(new CustomEvent('ready'))
        }
      } else if (status === 'disconnected' || status === 'destroyed') {
        this.connected = false
        this.#readyEmitted = false
      }
    })

    this.#connection.on('error', (err: any) => {
      this.#logger?.error('voice', `Error: ${err?.message ?? err}`)
    })
  }

  feedVoiceUpdate(sessionId: string, token: string, endpoint: string) {
    if (!this.#connection) return

    const cleanEndpoint = endpoint.replace(/^wss:\/\//, '').replace(/\/\?v=\d+$/, '')
    this.#logger?.debug('voice', `feedVoiceUpdate: endpoint=${cleanEndpoint} sessionId=${sessionId}`)

    this.#connection.voiceStateUpdate({ sessionId })
    this.#connection.voiceServerUpdate({ token, endpoint: cleanEndpoint })
    this.#logger?.debug('voice', `calling connect()...`)
    this.#connection.connect()
    this.#logger?.debug('voice', `connect() returned, state=${this.#connection.state?.status}`)
  }

  sendPCM(pcm: Buffer): number {
    const c = this.#connection
    if (!c || !this.connected) return 0
    if (!this.#encoder) {
      this.#encoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO)
      this.#logger?.debug('voice', `Opus encoder created`)
    }
    if (pcm.length < PCM_FRAME_SIZE) {
      this.#logger?.debug('voice', `sendPCM: short frame ${pcm.length} < ${PCM_FRAME_SIZE}`)
      return 0
    }
    try {
      const opus = this.#encoder.encode(pcm, OPUS_FRAME_SIZE)
      if (opus?.length > 0) {
        if (!this.#hasSpoken) {
          this.#hasSpoken = true
          this.#logger?.debug('voice', `first audio chunk, setting speaking`)
          try { c.setSpeaking(1 << 0) } catch (e) { this.#logger?.error('voice', `setSpeaking error: ${e}`) }
        }
        c.sendAudioFrame(opus)
      } else {
        this.#logger?.debug('voice', `opus encode returned empty`)
        return 0
      }
    } catch (e) {
      this.#logger?.error('voice', `sendPCM error: ${e}`)
      return 0
    }
    return 1
  }

  stopSpeaking() {
    if (this.#connection) {
      this.#connection.setSpeaking(0)
    }
    this.#hasSpoken = false
  }

  destroy() {
    this.stopSpeaking()
    if (this.#encoder) {
      this.#encoder.delete()
      this.#encoder = null
    }
    if (this.#connection) {
      this.#connection.destroy()
      this.#connection = null
    }
    this.connected = false
    this.#readyEmitted = false
  }

  close() {
    this.destroy()
  }
}
