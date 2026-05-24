export type PlayerEventType = 'trackStart' | 'trackEnd' | 'trackStuck' | 'trackException' | 'queueEnd' | 'playerUpdate' | 'pause' | 'resume' | 'volumeChange' | 'seek' | 'filterChange' | 'destroy'

export interface PlayerEventPayload {
  trackStart: { guildId: string; track: any }
  trackEnd: { guildId: string; track: any; reason: string }
  trackStuck: { guildId: string; track: any; thresholdMs: number }
  trackException: { guildId: string; track: any; error: string }
  queueEnd: { guildId: string }
  playerUpdate: { guildId: string; state: any }
  pause: { guildId: string }
  resume: { guildId: string }
  volumeChange: { guildId: string; volume: number }
  seek: { guildId: string; position: number }
  filterChange: { guildId: string; filters: any }
  destroy: { guildId: string }
}

export class PlayerEvents extends EventTarget {
  emit<T extends PlayerEventType>(type: T, detail: PlayerEventPayload[T]) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }
  on<T extends PlayerEventType>(type: T, handler: (detail: PlayerEventPayload[T]) => void) {
    this.addEventListener(type, (e: any) => handler(e.detail))
  }
}
