import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client'

interface MetricsConfig {
  enabled: boolean
  path?: string
  prefix?: string
}

export class Metrics {
  requestsTotal: Counter<string>
  playersActive: Gauge<string>
  tracksPlayed: Counter<string>
  requestDuration: Histogram<string>
  memoryUsage: Gauge<string>
  uptimeGauge: Gauge<string>

  constructor(config: MetricsConfig) {
    const p = config.prefix ?? 'sonata'

    this.requestsTotal = new Counter({
      name: `${p}_requests_total`, help: 'Total HTTP requests', labelNames: ['method', 'path', 'status'],
    })
    this.playersActive = new Gauge({
      name: `${p}_players_active`, help: 'Active players',
    })
    this.tracksPlayed = new Counter({
      name: `${p}_tracks_played_total`, help: 'Total tracks played',
    })
    this.requestDuration = new Histogram({
      name: `${p}_request_duration_ms`, help: 'Request duration in ms',
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
    })
    this.memoryUsage = new Gauge({
      name: `${p}_memory_bytes`, help: 'Memory usage in bytes', labelNames: ['type'],
    })
    this.uptimeGauge = new Gauge({
      name: `${p}_uptime_seconds`, help: 'Server uptime in seconds',
    })

    collectDefaultMetrics({ register })
    setInterval(() => this.#collectMemory(), 10_000)
    setInterval(() => this.#collectUptime(), 10_000)
  }

  get metrics() { return register.metrics() }

  #collectMemory() {
    const mem = process.memoryUsage()
    this.memoryUsage.set({ type: 'heapUsed' }, mem.heapUsed)
    this.memoryUsage.set({ type: 'heapTotal' }, mem.heapTotal)
    this.memoryUsage.set({ type: 'rss' }, mem.rss)
  }

  #collectUptime() {
    this.uptimeGauge.set(process.uptime())
  }
}
