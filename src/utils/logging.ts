import { execSync } from 'node:child_process'
import { VERSION, NAME } from '../version.js'
import type { Logger } from './logger.js'

let _gitInfo: { branch: string; commit: string; date: string } | null = null

export function getGitInfo() {
  if (_gitInfo) return _gitInfo
  try {
    _gitInfo = {
      branch: execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf-8' }).trim(),
      commit: execSync('git rev-parse --short HEAD 2>/dev/null', { encoding: 'utf-8' }).trim(),
      date: execSync('git log -1 --format=%cI 2>/dev/null', { encoding: 'utf-8' }).trim(),
    }
  } catch {
    _gitInfo = { branch: 'unknown', commit: 'unknown', date: '' }
  }
  return _gitInfo
}

const SOURCE_ICONS: Record<string, string> = {
  youtube: '▶️',
  soundcloud: '☁️',
  spotify: '🎧',
  bandcamp: '💿',
  twitch: '📺',
  vimeo: '🎬',
  deezer: '🎵',
  apple: '🍎',
  nico: '📹',
  mixcloud: '🌧️',
  podcast: '🎤',
  jiosaavn: '🎼',
  http: '🌐',
  local: '💾',
  tiktok: '🎶',
}

export function logBanner(cfg: any, logger?: Logger) {
  const git = getGitInfo()

  logger?.info('System', `Starting ${NAME} v${VERSION}`)
  logger?.info('System', `Git ${git.branch}/${git.commit}${git.date ? ` (${git.date})` : ''}`)
  logger?.info('System', `${process.version} ${process.platform} ${process.arch}`)

  logger?.info('System', `Listening on ${cfg.server.host}:${cfg.server.port} (Lavalink v${cfg.lavalink.apiVersion})`)

  if (cfg.clustering?.enabled) {
    logger?.info('Cluster', `Active (${cfg.clustering.nodes?.length ?? 0} node(s), ${cfg.clustering.electionStrategy} strategy)`)
  } else {
    logger?.info('Cluster', 'Standalone mode')
  }

  if (cfg.rateLimiting?.enabled) {
    logger?.info('RateLimiter', `Active (${cfg.rateLimiting.maxRequests} req/${cfg.rateLimiting.windowMs / 1000}s)`)
  }

  if (cfg.server.compression) logger?.info('Server', 'HTTP compression enabled')
  if (cfg.server.http2) logger?.info('Server', 'HTTP/2 enabled')
  if (cfg.server.cors) logger?.info('Server', 'CORS enabled')
  if (cfg.server.dashboard) logger?.info('Server', `Dashboard at ${cfg.server.dashboard}`)
  if (cfg.cache?.enabled) logger?.info('Cache', `${cfg.cache.memoryOnly ? 'Memory-only' : 'Redis'} (TTL ${cfg.cache.ttl}ms, max ${cfg.cache.maxSize} entries)`)

  if (cfg.player?.autoPlay) logger?.info('Player', 'AutoPlay enabled')
  if (cfg.player?.replaygain) logger?.info('Player', 'ReplayGain enabled')
  if (cfg.player?.normalization) logger?.info('Player', 'Loudness normalization enabled')
  if (cfg.player?.stickyQueue) logger?.info('Player', `Sticky queue active (${cfg.player.stickyQueueFile})`)
  if (cfg.queue?.shuffle) logger?.info('Queue', 'Shuffle enabled')

  if (cfg.proxy?.socks) logger?.info('Proxy', `SOCKS5 ${cfg.proxy.socks}`)
  if (cfg.proxy?.http) logger?.info('Proxy', `HTTP ${cfg.proxy.http}`)

  if (cfg.logging?.file?.enabled) logger?.info('Logging', `File: ${cfg.logging.file.path}`)

  const sources = Object.entries(cfg.sources)
    .filter(([k]) => !['priority', 'requestTimeout', 'userAgent'].includes(k))
    .map(([name, src]: [string, any]) => {
      const enabled = typeof src === 'object' ? src.enabled : src
      const iconName = SOURCE_ICONS[name] || '?'
      const icon = enabled ? iconName : '🔴'
      return ` ${icon} ${name}`
    })

  const longest = Math.max(...sources.map(s => s.length), 0)
  const boxW = Math.max(longest + 3, 40)
  const h = '\u2500'
  const pad = (s: string) => s + ' '.repeat(Math.max(0, boxW - s.length))
  const fmt = (s: string) => `\u2502 ${pad(s)} \u2502`

  logger?.info('Sources', `\u250C${h.repeat(boxW + 2)}\u2510`)
  for (const line of sources) {
    logger?.info('Sources', fmt(line))
  }
  logger?.info('Sources', `\u2514${h.repeat(boxW + 2)}\u2518`)
}

export function logMemory(logger?: Logger) {
  const mem = process.memoryUsage()
  logger?.debug('Memory', `rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB ext=${(mem.external / 1024 / 1024).toFixed(1)}MB`)
}

export function logPlayerAction(guildId: string, action: string, detail?: string, logger?: Logger) {
  const msg = `${guildId} ${action}${detail ? ` (${detail})` : ''}`
  logger?.info('Player', msg)
}
