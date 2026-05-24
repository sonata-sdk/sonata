import type { FilterOptions, Band } from '../types/index.js'

export class AudioMixer {
  #filters: FilterOptions = {}
  #bands: Band[] = Array.from({ length: 15 }, (_, i) => ({ band: i, gain: 0 }))

  setFilters(f: FilterOptions) { this.#filters = { ...f } }

  setEqualizer(bands: Band[]) {
    for (const b of bands) {
      if (b.band >= 0 && b.band < 15) this.#bands[b.band] = b
    }
  }

  resetEqualizer() { this.#bands = Array.from({ length: 15 }, (_, i) => ({ band: i, gain: 0 })) }

  get filters(): FilterOptions & { equalizer: Band[] } {
    return { ...this.#filters, equalizer: [...this.#bands] }
  }
}
