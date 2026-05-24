export interface FilterConfig {
  volume?: number
  equalizer?: { band: number; gain: number }[]
  karaoke?: { level?: number; monoLevel?: number; filterBand?: number; filterWidth?: number }
  timescale?: { speed?: number; pitch?: number; rate?: number }
  tremolo?: { frequency?: number; depth?: number }
  vibrato?: { frequency?: number; depth?: number }
  rotation?: { rotationHz?: number }
  distortion?: { sinOffset?: number; sinScale?: number; cosOffset?: number; cosScale?: number; tanOffset?: number; tanScale?: number }
  channelMix?: { leftToLeft?: number; leftToRight?: number; rightToLeft?: number; rightToRight?: number }
  lowPass?: { smoothing?: number }
  normalization?: { enabled: boolean; target?: number }
}

export interface ProcessedFilters {
  volume: number
  equalizer: number[]
  karaoke: Required<NonNullable<FilterConfig['karaoke']>>
  timescale: Required<NonNullable<FilterConfig['timescale']>>
  tremolo: Required<NonNullable<FilterConfig['tremolo']>>
  vibrato: Required<NonNullable<FilterConfig['vibrato']>>
  rotation: Required<NonNullable<FilterConfig['rotation']>>
  distortion: Required<NonNullable<FilterConfig['distortion']>>
  channelMix: Required<NonNullable<FilterConfig['channelMix']>>
  lowPass: Required<NonNullable<FilterConfig['lowPass']>>
  normalization: { enabled: boolean; target: number; gain: number }
}

const DEFAULTS: ProcessedFilters = {
  volume: 1.0,
  equalizer: new Array(15).fill(0),
  karaoke: { level: 0, monoLevel: 1, filterBand: 220, filterWidth: 100 },
  timescale: { speed: 1, pitch: 1, rate: 1 },
  tremolo: { frequency: 2, depth: 0 },
  vibrato: { frequency: 2, depth: 0 },
  rotation: { rotationHz: 0 },
  distortion: { sinOffset: 0, sinScale: 1, cosOffset: 0, cosScale: 1, tanOffset: 0, tanScale: 1 },
  channelMix: { leftToLeft: 1, leftToRight: 0, rightToLeft: 0, rightToRight: 1 },
  lowPass: { smoothing: 1 },
  normalization: { enabled: false, target: -14, gain: 1.0 },
}

export class AudioMixer {
  #filters: ProcessedFilters

  constructor() {
    this.#filters = structuredClone(DEFAULTS)
  }

  setFilters(opts: FilterConfig) {
    if (opts.volume !== undefined) this.#filters.volume = Math.max(0, Math.min(10, opts.volume / 100))
    if (opts.equalizer) {
      for (const b of opts.equalizer) {
        if (b.band >= 0 && b.band < 15) this.#filters.equalizer[b.band] = b.gain
      }
    }
    if (opts.karaoke) Object.assign(this.#filters.karaoke, opts.karaoke)
    if (opts.timescale) Object.assign(this.#filters.timescale, opts.timescale)
    if (opts.tremolo) Object.assign(this.#filters.tremolo, opts.tremolo)
    if (opts.vibrato) Object.assign(this.#filters.vibrato, opts.vibrato)
    if (opts.rotation) Object.assign(this.#filters.rotation, opts.rotation)
    if (opts.distortion) Object.assign(this.#filters.distortion, opts.distortion)
    if (opts.channelMix) Object.assign(this.#filters.channelMix, opts.channelMix)
    if (opts.lowPass) Object.assign(this.#filters.lowPass, opts.lowPass)
    if (opts.normalization !== undefined) {
      this.#filters.normalization.enabled = opts.normalization.enabled ?? false
      if (opts.normalization.target !== undefined) this.#filters.normalization.target = opts.normalization.target
    }
  }

  getFilters(): FilterConfig {
    return {
      volume: Math.round(this.#filters.volume * 100),
      equalizer: this.#filters.equalizer.map((gain, band) => ({ band, gain })).filter(b => b.gain !== 0),
      karaoke: { ...this.#filters.karaoke },
      timescale: { ...this.#filters.timescale },
      tremolo: { ...this.#filters.tremolo },
      vibrato: { ...this.#filters.vibrato },
      rotation: { ...this.#filters.rotation },
      distortion: { ...this.#filters.distortion },
      channelMix: { ...this.#filters.channelMix },
      lowPass: { ...this.#filters.lowPass },
      normalization: { ...this.#filters.normalization },
    }
  }

  clear() { this.#filters = structuredClone(DEFAULTS) }

  process(): ProcessedFilters {
    return structuredClone(this.#filters)
  }

  apply(pcm: Int16Array, sampleRate = 48000): Int16Array {
    let samples = pcm
    const f = this.#filters
    const ch = 2
    const len = samples.length

    // Volume
    if (f.volume !== 1) {
      for (let i = 0; i < len; i++) {
        let s = samples[i] * f.volume
        if (s > 32767) s = 32767
        if (s < -32768) s = -32768
        samples[i] = s | 0
      }
    }

    // Normalization (dynamic gain based on RMS loudness)
    if (f.normalization.enabled) {
      let sumSq = 0
      for (let i = 0; i < len; i++) sumSq += samples[i] * samples[i]
      const rms = Math.sqrt(sumSq / len)
      const targetLevel = 32768 * Math.pow(10, f.normalization.target / 20)
      const targetGain = rms > 0 ? targetLevel / rms : 1.0
      const clampedGain = Math.max(0.1, Math.min(10, targetGain))
      f.normalization.gain += (clampedGain - f.normalization.gain) * 0.1
      if (Math.abs(f.normalization.gain - 1) > 0.01) {
        for (let i = 0; i < len; i++) {
          let s = samples[i] * f.normalization.gain
          if (s > 32767) s = 32767
          if (s < -32768) s = -32768
          samples[i] = s | 0
        }
      }
    }

    // Equalizer (simplified biquad shelving per band)
    if (f.equalizer.some(g => g !== 0)) {
      const prev = new Float64Array(len)
      for (let i = 0; i < len; i++) prev[i] = samples[i]
      for (let band = 0; band < 15; band++) {
        const gain = f.equalizer[band]
        if (gain === 0) continue
        const freq = 40 * Math.pow(2, band * 2 / 3)
        const w0 = 2 * Math.PI * freq / sampleRate
        const alpha = Math.sin(w0) / 2
        const a0 = 1 + alpha
        const b0 = (1 + Math.cos(w0)) / 2 * gain
        const b1 = -(1 + Math.cos(w0)) * gain
        const b2 = (1 + Math.cos(w0)) / 2 * gain
        const a1 = -2 * Math.cos(w0)
        const a2 = 1 - alpha
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0
        for (let i = 0; i < len; i++) {
          const x = prev[i]
          const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
          x2 = x1; x1 = x; y2 = y1; y1 = y
          samples[i] = Math.max(-32768, Math.min(32767, y | 0))
        }
      }
    }

    // Tremolo
    if (f.tremolo.depth > 0) {
      for (let i = 0; i < len; i++) {
        const mod = 1 - f.tremolo.depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * f.tremolo.frequency * i / sampleRate))
        samples[i] = (samples[i] * mod) | 0
      }
    }

    // Vibrato (pitch modulation via sample interpolation)
    if (f.vibrato.depth > 0) {
      const buf = new Int16Array(samples)
      for (let i = 2; i < len - 2; i++) {
        const offset = f.vibrato.depth * 5 * Math.sin(2 * Math.PI * f.vibrato.frequency * i / sampleRate)
        const src = Math.max(0, Math.min(len - 1, i + offset))
        const frac = src - Math.floor(src)
        const si = Math.floor(src)
        samples[i] = Math.round(buf[si] * (1 - frac) + (buf[Math.min(si + 1, len - 1)] * frac))
      }
    }

    // Rotation
    if (f.rotation.rotationHz > 0 && ch === 2) {
      let idx = 0
      for (let i = 0; i < len; i += 2) {
        const a = 2 * Math.PI * f.rotation.rotationHz * idx / sampleRate
        const l = samples[i]
        const r = samples[i + 1]
        samples[i] = (l * Math.cos(a) + r * Math.sin(a)) | 0
        samples[i + 1] = (l * -Math.sin(a) + r * Math.cos(a)) | 0
        idx++
      }
    }

    // Channel Mix
    if (ch === 2 && (f.channelMix.leftToLeft !== 1 || f.channelMix.leftToRight !== 0 || f.channelMix.rightToLeft !== 0 || f.channelMix.rightToRight !== 1)) {
      for (let i = 0; i < len; i += 2) {
        const l = samples[i]; const r = samples[i + 1]
        samples[i] = Math.max(-32768, Math.min(32767, (l * f.channelMix.leftToLeft + r * f.channelMix.rightToLeft) | 0))
        samples[i + 1] = Math.max(-32768, Math.min(32767, (l * f.channelMix.leftToRight + r * f.channelMix.rightToRight) | 0))
      }
    }

    // Low Pass (1-pole)
    if (f.lowPass.smoothing < 1) {
      let prev = 0
      const c = f.lowPass.smoothing
      for (let i = 0; i < len; i++) {
        prev = prev + c * (samples[i] - prev)
        samples[i] = prev | 0
      }
    }

    // Distortion
    if (f.distortion.sinOffset !== 0 || f.distortion.tanOffset !== 0) {
      for (let i = 0; i < len; i++) {
        let s = samples[i] / 32768
        s = Math.sin(s * f.distortion.sinScale + f.distortion.sinOffset)
        s = Math.cos(s * f.distortion.cosScale + f.distortion.cosOffset)
        s = Math.tan(s * f.distortion.tanScale + f.distortion.tanOffset)
        if (s > 1) s = 1; if (s < -1) s = -1
        samples[i] = (s * 32768) | 0
      }
    }

    // Karaoke (center channel removal)
    if (f.karaoke.level > 0 && ch === 2) {
      for (let i = 0; i < len; i += 2) {
        const mono = (samples[i] + samples[i + 1]) / 2
        samples[i] = Math.round(samples[i] * f.karaoke.monoLevel - mono * f.karaoke.level)
        samples[i + 1] = Math.round(samples[i + 1] * f.karaoke.monoLevel - mono * f.karaoke.level)
      }
    }

    // Timescale (simplified: skip samples for speed)
    if (f.timescale.speed !== 1) {
      const step = 1 / f.timescale.speed
      const out = new Int16Array(Math.floor(len / step))
      for (let i = 0; i < out.length; i++) {
        const src = Math.min(Math.floor(i * step), len - 1)
        out[i] = samples[src]
      }
      samples = out
    }

    return samples
  }
}
