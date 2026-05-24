import type { Track, PlayerState, FilterOptions } from '../types/index.js'
import { Queue } from './queue.js'
import { VoiceConnection } from './voice.js'

export enum State { Stopped, Playing, Paused, Ended }

export interface PlayerEventHandlers {
  onTrackStart: (player: Player, track: Track) => void
  onTrackEnd: (player: Player, track: Track, reason: string) => void
  onTrackStuck: (player: Player, track: Track, threshold: number) => void
  onTrackException: (player: Player, track: Track, err: Error) => void
  onPlayerUpdate: (player: Player, state: PlayerState) => void
  onQueueEnd: (player: Player) => void
}

export class Player {
  readonly guildId: string
  #queue = new Queue()
  #state = State.Stopped
  #volume = 100
  #position = 0
  #lastUpdate = Date.now()
  #voice: VoiceConnection | null = null
  #filters: FilterOptions = {}
  #events: PlayerEventHandlers
  #loopMode: 'none' | 'track' | 'queue' = 'none'

  constructor(guildId: string, events: PlayerEventHandlers) {
    this.guildId = guildId
    this.#events = events
  }

  play(track?: Track | null) {
    if (!track) track = this.#queue.dequeue()
    if (!track) {
      this.#state = State.Stopped
      this.#events.onQueueEnd(this)
      return
    }

    this.#queue.setCurrent(track)
    this.#state = State.Playing
    this.#position = 0
    this.#lastUpdate = Date.now()
    this.#events.onTrackStart(this, track)
  }

  stop() {
    this.#state = State.Stopped
    this.#position = 0
    this.#queue.clear()
  }

  pause() { if (this.#state === State.Playing) this.#state = State.Paused }
  resume() { if (this.#state === State.Paused) this.#state = State.Playing }

  setPosition(pos: number) {
    this.#position = pos
    this.#lastUpdate = Date.now()
  }

  setVolume(v: number) { this.#volume = Math.max(0, Math.min(1000, v)) }
  setVoice(vc: VoiceConnection) { this.#voice = vc }
  setFilters(f: FilterOptions) { this.#filters = f }
  setLoop(mode: 'none' | 'track' | 'queue') { this.#loopMode = mode }

  get state() { return this.#state }
  get volume() { return this.#volume }
  get queue() { return this.#queue }
  get voice() { return this.#voice }
  get filters() { return { ...this.#filters } }
  get loopMode() { return this.#loopMode }

  get position(): number {
    if (this.#state === State.Playing) {
      return this.#position + (Date.now() - this.#lastUpdate)
    }
    return this.#position
  }

  get track(): Track | null {
    return this.#queue.current
  }

  toState(): PlayerState {
    return {
      guildId: this.guildId,
      track: this.track ?? undefined,
      volume: this.#volume,
      paused: this.#state === State.Paused,
      position: this.position,
      connected: this.#voice?.connected ?? false,
      ping: this.#voice?.ping ?? 0,
    }
  }
}
