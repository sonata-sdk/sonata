import { VERSION, NAME } from '../version.js'

export function logStartup(cfg: any) {
  const active = Object.entries(cfg.sources)
    .filter(([, v]: [string, any]) => typeof v === 'object' ? v.enabled : v)
    .map(([k]) => k)

  console.log('╔══════════════════════════════════════╗')
  console.log(`║ ${NAME} v${VERSION.padEnd(25)} ║`)
  console.log('╠══════════════════════════════════════╣')
  console.log(`║ Host: ${cfg.server.host}:${cfg.server.port}`)
  console.log(`║ Lavalink: v${cfg.lavalink.apiVersion}`)
  console.log(`║ Sources: ${active.join(', ')}`)
  console.log(`║ Node: ${process.version} (${process.platform})`)
  console.log(`║ Features: ${[
    cfg.cache?.enabled && 'cache',
    cfg.server.cors && 'cors',
    cfg.server.dashboard && 'dashboard',
    cfg.player?.autoPlay && 'autoplay',
  ].filter(Boolean).join(', ')}`)
  console.log('╚══════════════════════════════════════╝')
}

export function logMemory() {
  const mem = process.memoryUsage()
  console.log(`[memory] rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB ext=${(mem.external / 1024 / 1024).toFixed(1)}MB`)
}

export function logPlayerAction(guildId: string, action: string, detail?: string) {
  const msg = `[player] ${guildId} ${action}${detail ? ` (${detail})` : ''}`
  console.log(msg)
}
