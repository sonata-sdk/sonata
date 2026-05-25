declare module '@performanc/voice' {
  import { EventEmitter } from 'node:events'
  import { Readable } from 'node:stream'

  interface VoiceConnectionOptions {
    guildId: string
    userId: string
    channelId: string
    encryption?: string | null
  }

  class VoiceConnection extends EventEmitter {
    udpInfo: { ssrc: number; ip: string; port: number; secretKey: Buffer | null } | null
    ping: number
    state: { status: string; reason: string | null; code: number | null; closeReason: string | null }
    statistics: { packetsSent: number; packetsLost: number; packetsExpected: number }

    voiceStateUpdate(obj: { session_id?: string; sessionId?: string }): void
    voiceServerUpdate(obj: { token: string; endpoint: string; channel_id?: string; channelId?: string }): void
    connect(cb?: () => void, reconnection?: boolean): void
    play(audioStream: Readable): void
    stop(reason?: string): void
    pause(reason?: string): void
    unpause(reason?: string): void
    sendAudioChunk(chunk: Buffer): void
    setSpeaking(value: number): void
    destroy(): void
  }

  export function joinVoiceChannel(options: VoiceConnectionOptions): VoiceConnection

  const _default: { joinVoiceChannel: typeof joinVoiceChannel; getSpeakStream: (ssrc: number, guildId: string) => Readable | null }
  export default _default
}
