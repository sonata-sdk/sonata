import { WebSocket } from 'ws'
import { PlayerManager } from '../player/manager.js'
import { SessionManager } from './session.js'
import { VoiceConnection } from '../player/voice.js'
import { Player } from '../player/player.js'
import type { Track, PlayerState } from '../types/index.js'

interface WSClient { ws: WebSocket; sessionId: string }

export class LavalinkWS {
  pm: PlayerManager
  sessions: SessionManager
  #clients = new Map<string, WSClient>()

  constructor(pm: PlayerManager, sessions: SessionManager) {
    this.pm = pm
    this.sessions = sessions
  }

  handleConnection(ws: WebSocket) {
    const session = this.sessions.create(false, '')
    const client: WSClient = { ws, sessionId: session.id }
    this.#clients.set(session.id, client)

    this.#send(ws, 'ready', { resumed: false, session: { id: session.id, resume: false } })

    ws.on('message', (data) => {
      try { this.#handleMessage(client, JSON.parse(data.toString())) }
      catch { /* ignore */ }
    })
    ws.on('close', () => this.#clients.delete(session.id))
    ws.on('ping', () => ws.pong())
  }

  onTrackStart(p: Player, track: Track) { this.#broadcast('trackStart', { guildId: p.guildId, track }) }
  onTrackEnd(p: Player, track: Track, reason: string) { this.#broadcast('trackEnd', { guildId: p.guildId, track, reason }) }
  onTrackStuck(p: Player, track: Track, threshold: number) { this.#broadcast('trackStuck', { guildId: p.guildId, track, threshold }) }
  onTrackException(p: Player, track: Track, err: Error) { this.#broadcast('trackException', { guildId: p.guildId, track, error: err.message }) }
  onQueueEnd(p: Player) { this.#broadcast('queueEnd', { guildId: p.guildId }) }

  onPlayerUpdate(p: Player, state: PlayerState) {
    this.#broadcast('playerUpdate', { guildId: state.guildId, state })
  }

  #handleMessage(client: WSClient, msg: any) {
    if (msg.op === 'ping') return this.#send(client.ws, 'pong', {})
    if (msg.op !== 'voiceUpdate') return

    const { guildId, sessionId, event } = msg
    if (!guildId || !event) return

    const p = this.pm.getOrCreate(guildId)
    const vc = new VoiceConnection(guildId)
    vc.update(sessionId, event.token, event.endpoint)
    p.setVoice(vc)
  }

  #send(ws: WebSocket, op: string, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op, data }))
    }
  }

  #broadcast(op: string, data: any) {
    const msg = JSON.stringify({ op, data })
    for (const c of this.#clients.values()) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(msg)
    }
  }
}
