import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client'

export class Metrics {
  requestsTotal = new Counter({ name: 'sonata_requests_total', help: 'Total HTTP requests', labelNames: ['method', 'path', 'status'] })
  playersActive = new Gauge({ name: 'sonata_players_active', help: 'Active players' })
  tracksPlayed = new Counter({ name: 'sonata_tracks_played_total', help: 'Total tracks played' })
  requestDuration = new Histogram({ name: 'sonata_request_duration_ms', help: 'Request duration in ms', buckets: [5, 10, 25, 50, 100, 250, 500, 1000] })
  memoryUsage = new Gauge({ name: 'sonata_memory_bytes', help: 'Memory usage in bytes', labelNames: ['type'] })
  uptimeGauge = new Gauge({ name: 'sonata_uptime_seconds', help: 'Server uptime in seconds' })

  constructor() {
    collectDefaultMetrics({ register })
    setInterval(() => this.#collectMemory(), 10000)
    setInterval(() => this.#collectUptime(), 10000)
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
