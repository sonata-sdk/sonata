import { VERSION, NAME } from '../version.js'
import type { Logger } from './logger.js'

export function logStartup(cfg: any, logger?: Logger) {
  const active = Object.entries(cfg.sources)
    .filter(([, v]: [string, any]) => typeof v === 'object' ? v.enabled : v)
    .map(([k]) => k)

  logger?.info('startup', `╔══════════════════════════════════════╗`)
  logger?.info('startup', `║ ${NAME} v${VERSION.padEnd(25)} ║`)
  logger?.info('startup', `╠══════════════════════════════════════╣`)
  logger?.info('startup', `║ Host: ${cfg.server.host}:${cfg.server.port}`)
  logger?.info('startup', `║ Lavalink: v${cfg.lavalink.apiVersion}`)
  logger?.info('startup', `║ Sources: ${active.join(', ')}`)
  logger?.info('startup', `║ Node: ${process.version} (${process.platform})`)
  logger?.info('startup', `║ Features: ${[
    cfg.cache?.enabled && 'cache',
    cfg.server.cors && 'cors',
    cfg.server.dashboard && 'dashboard',
    cfg.player?.autoPlay && 'autoplay',
  ].filter(Boolean).join(', ')}`)
  logger?.info('startup', `╚══════════════════════════════════════╝`)
}

export function logMemory(logger?: Logger) {
  const mem = process.memoryUsage()
  logger?.debug('memory', `rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB ext=${(mem.external / 1024 / 1024).toFixed(1)}MB`)
}

export function logPlayerAction(guildId: string, action: string, detail?: string, logger?: Logger) {
  const msg = `${guildId} ${action}${detail ? ` (${detail})` : ''}`
  logger?.info('player', msg)
}
