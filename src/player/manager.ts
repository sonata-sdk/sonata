import { Player, PlayerEventHandlers, State } from './player.js'

export class PlayerManager {
  #players = new Map<string, Player>()
  #handler: PlayerEventHandlers

  constructor(handler: PlayerEventHandlers) { this.#handler = handler }

  get(guildId: string): Player | undefined { return this.#players.get(guildId) }

  getOrCreate(guildId: string): Player {
    let p = this.#players.get(guildId)
    if (!p) {
      p = new Player(guildId, this.#handler)
      this.#players.set(guildId, p)
    }
    return p
  }

  remove(guildId: string) {
    this.#players.get(guildId)?.stop()
    this.#players.delete(guildId)
  }

  all(): Player[] { return [...this.#players.values()] }
  count() { return this.#players.size }
  playingCount() { return this.all().filter(p => p.state === State.Playing).length }
  reset() { this.#players.forEach(p => p.stop()); this.#players.clear() }
}
