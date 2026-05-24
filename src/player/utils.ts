export function clampVolume(v: number): number {
  return Math.max(0, Math.min(1000, Math.round(v)))
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function parseDuration(str: string): number {
  const parts = str.split(':').map(Number)
  if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000
  if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000
  return parts[0] * 1000 || 0
}

export class Timer {
  #start = 0
  start() { this.#start = Date.now() }
  stop(): number { return Date.now() - this.#start }
  get elapsed(): number { return Date.now() - this.#start }
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str
}
