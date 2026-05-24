import type { Track } from '../types/index.js'

export class Queue {
  #tracks: Track[] = []
  #history: Track[] = []
  #current: Track | null = null

  enqueue(track: Track) { this.#tracks.push(track) }
  dequeue(): Track | null { return this.#tracks.shift() ?? null }
  peek(): Track | null { return this.#tracks[0] ?? null }

  remove(index: number): Track | null {
    if (index < 0 || index >= this.#tracks.length) return null
    return this.#tracks.splice(index, 1)[0]
  }

  clear() {
    this.#history.push(...this.#tracks)
    this.#tracks = []
  }

  shuffle() {
    for (let i = this.#tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.#tracks[i], this.#tracks[j]] = [this.#tracks[j], this.#tracks[i]]
    }
  }

  setCurrent(track: Track | null) {
    if (this.#current) this.#history.push(this.#current)
    this.#current = track
  }

  get current() { return this.#current }
  get all(): Track[] { return [...this.#tracks] }
  get history(): Track[] { return [...this.#history] }
  get length() { return this.#tracks.length }
}
