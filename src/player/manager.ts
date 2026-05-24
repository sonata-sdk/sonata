import { Player, PlayerEventHandlers, State } from './player.js'
import { TrackCache } from '../cache/index.js'

const IDLE_TIMEOUT = 300_000

export class PlayerManager {
  #players = new Map<string, Player>()
  #handler: PlayerEventHandlers
  #idleTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(handler: PlayerEventHandlers) { this.#handler = handler }

  get(guildId: string): Player | undefined { return this.#players.get(guildId) }

  getOrCreate(guildId: string): Player {
    let p = this.#players.get(guildId)
    if (!p) {
      p = new Player(guildId, this.#handler)
      this.#players.set(guildId, p)
      this.#resetIdle(guildId)
    }
    return p
  }

  remove(guildId: string) {
    this.#players.get(guildId)?.stop()
    this.#players.delete(guildId)
    this.#clearIdle(guildId)
  }

  all(): Player[] { return [...this.#players.values()] }
  count() { return this.#players.size }
  playingCount() { return this.all().filter(p => p.state === State.Playing).length }
  pausedCount() { return this.all().filter(p => p.state === State.Paused).length }
  connectedCount() { return this.all().filter(p => p.voice?.connected).length }
  reset() { this.#players.forEach(p => p.stop()); this.#players.clear() }

  getStats() {
    return {
      players: this.count(),
      playing: this.playingCount(),
      paused: this.pausedCount(),
      connected: this.connectedCount(),
      uptime: process.uptime(),
    }
  }

  #resetIdle(guildId: string) {
    this.#clearIdle(guildId)
    const timer = setTimeout(() => {
      const p = this.#players.get(guildId)
      if (p && p.state === State.Stopped) {
        p.stop()
        this.#players.delete(guildId)
      }
    }, IDLE_TIMEOUT)
    this.#idleTimers.set(guildId, timer)
  }

  #clearIdle(guildId: string) {
    const t = this.#idleTimers.get(guildId)
    if (t) { clearTimeout(t); this.#idleTimers.delete(guildId) }
  }
}
