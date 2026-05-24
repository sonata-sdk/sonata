import { Player, PlayerEventHandlers, State } from './player.js'
import { TrackCache } from '../cache/index.js'

const IDLE_TIMEOUT = 300_000

export class PlayerManager {
  #players = new Map<string, Player>()
  #handler: PlayerEventHandlers
  #idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
  #autoLeaveMs = 0
  #autoLeaveInterval: ReturnType<typeof setInterval> | null = null
  #onAutoLeave: ((guildId: string) => void) | null = null
  #stickyQueueEnabled = false
  #stickyQueueFileTemplate = ''

  constructor(handler: PlayerEventHandlers, stickyQueue = false, stickyQueueFile = '') {
    this.#handler = handler
    this.#stickyQueueEnabled = stickyQueue
    this.#stickyQueueFileTemplate = stickyQueueFile
  }

  setAutoLeave(ms: number, onLeave: (guildId: string) => void) {
    this.#autoLeaveMs = ms
    this.#onAutoLeave = onLeave
    if (ms > 0 && !this.#autoLeaveInterval) {
      this.#autoLeaveInterval = setInterval(() => this.#checkAutoLeave(), 10_000)
    }
  }

  #checkAutoLeave() {
    if (this.#autoLeaveMs <= 0) return
    for (const [guildId, p] of this.#players) {
      if (!p.voice?.connected) continue
      if (p.state === State.Playing || p.state === State.Paused) continue
      if (p.getIdleTime() >= this.#autoLeaveMs) {
        this.#onAutoLeave?.(guildId)
      }
    }
  }

  get(guildId: string): Player | undefined { return this.#players.get(guildId) }

  getOrCreate(guildId: string): Player {
    let p = this.#players.get(guildId)
    if (!p) {
      const stickyFile = this.#stickyQueueEnabled
        ? (this.#stickyQueueFileTemplate || `data/queue-${guildId}.json`).replace('{guildId}', guildId)
        : ''
      p = new Player(guildId, this.#handler, stickyFile)
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
  reset() {
    this.#players.forEach(p => p.stop())
    this.#players.clear()
    if (this.#autoLeaveInterval) {
      clearInterval(this.#autoLeaveInterval)
      this.#autoLeaveInterval = null
    }
  }

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
