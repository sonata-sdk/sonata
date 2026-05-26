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

  // Sources box
  const sources = Object.entries(cfg.sources)
    .filter(([k]) => !['priority', 'requestTimeout', 'userAgent'].includes(k))
    .map(([name, src]: [string, any]) => {
      const enabled = typeof src === 'object' ? src.enabled : src
      const iconName = SOURCE_ICONS[name] || '?'
      const icon = enabled ? iconName : '🔴'
      return ` ${icon}  ${name}`
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

  // System info
  logger?.info('System', `${NAME} v${VERSION}  ·  ${process.version} ${process.platform} ${process.arch}`)
  logger?.info('System', `Git ${git.branch}/${git.commit}${git.date ? `  ·  ${git.date}` : ''}`)
  logger?.info('System', `Listening on ${cfg.server.host}:${cfg.server.port}  (Lavalink v${cfg.lavalink.apiVersion})`)

  // Cluster
  if (cfg.clustering?.enabled) {
    logger?.info('Cluster', `Active  ·  ${cfg.clustering.nodes?.length ?? 0} node(s)  ·  ${cfg.clustering.electionStrategy} strategy`)
  } else {
    logger?.info('Cluster', 'Standalone mode')
  }

  // Rate limiter
  if (cfg.rateLimiting?.enabled) {
    logger?.info('RateLimiter', `Active  ·  ${cfg.rateLimiting.maxRequests} req / ${cfg.rateLimiting.windowMs / 1000}s`)
  }

  // Server features
  if (cfg.server.compression) logger?.info('Server', 'HTTP compression  enabled')
  if (cfg.server.http2) logger?.info('Server', 'HTTP/2  enabled')
  if (cfg.server.cors) logger?.info('Server', 'CORS  enabled')
  if (cfg.server.dashboard) logger?.info('Server', `Dashboard  ${cfg.server.dashboard}`)
  if (cfg.server.ssl?.cert) logger?.info('Server', 'TLS/SSL  enabled')

  // Cache
  if (cfg.cache?.enabled) logger?.info('Cache', `${cfg.cache.memoryOnly ? 'Memory-only' : cfg.cache.redis ? 'Redis' : 'LRU'}  ·  TTL ${cfg.cache.ttl}ms  ·  max ${cfg.cache.maxSize} entries`)

  // Player features
  if (cfg.player?.autoPlay) logger?.info('Player', 'AutoPlay  enabled')
  if (cfg.player?.replaygain) logger?.info('Player', 'ReplayGain  enabled')
  if (cfg.player?.normalization) logger?.info('Player', 'Loudness normalization  enabled')
  if (cfg.player?.stickyQueue) logger?.info('Player', `Sticky queue  ${cfg.player.stickyQueueFile || 'default'}`)
  if (cfg.player?.ducking?.enabled) logger?.info('Player', `Audio ducking  threshold=${cfg.player.ducking.threshold}  reduce=${cfg.player.ducking.reduceBy}`)
  if (cfg.player?.gapless?.enabled) logger?.info('Player', `Gapless playback  maxGap=${cfg.player.gapless.maxGapMs}ms`)
  if (cfg.player?.fade?.enabled) logger?.info('Player', `Fade in/out  ${cfg.player.fade.fadeInMs}ms/${cfg.player.fade.fadeOutMs}ms`)
  if (cfg.player?.autoVolume?.enabled) logger?.info('Player', `Auto volume  target=${cfg.player.autoVolume.targetLUFS}LUFS  gain=${cfg.player.autoVolume.maxGain}dB`)
  if (cfg.player?.snapshot?.enabled) logger?.info('Player', `Snapshots  ${cfg.player.snapshot.dir}  every ${cfg.player.snapshot.saveIntervalMs / 1000}s`)

  // Queue
  if (cfg.queue?.shuffle) logger?.info('Queue', 'Shuffle  enabled')
  if (cfg.queue?.crossfade && cfg.queue?.crossfade > 0) logger?.info('Queue', `Crossfade  ${cfg.queue.crossfade}s`)

  // Proxy
  if (cfg.proxy?.socks) logger?.info('Proxy', `SOCKS5  ${cfg.proxy.socks}`)
  if (cfg.proxy?.http) logger?.info('Proxy', `HTTP  ${cfg.proxy.http}`)

  // Logging
  if (cfg.logging?.file?.enabled) logger?.info('Logging', `File  ${cfg.logging.file.path}`)

  // New config sections
  if (cfg.discord?.enabled) logger?.info('Discord', `Gateway  intents=${cfg.discord.intents}`)
  if (cfg.webhooks?.length) logger?.info('Webhooks', `${cfg.webhooks.length} webhook(s)  configured  events=${cfg.webhooks.map((w: any) => w.events?.length ?? 'all').join(', ')}`)
  if (cfg.database?.enabled) logger?.info('Database', `${cfg.database.type}  ${cfg.database.url || cfg.database.sqlitePath}  pool=${cfg.database.poolSize}`)
  if (cfg.recording?.enabled) logger?.info('Recording', `${cfg.recording.format}  → ${cfg.recording.dir}  max=${cfg.recording.maxDuration}s  split=${cfg.recording.splitOnTrack}`)
  if (cfg.opentelemetry?.enabled) logger?.info('OTel', `Trace  endpoint=${cfg.opentelemetry.endpoint}  rate=${cfg.opentelemetry.samplingRate}`)
  if (cfg.sse?.enabled) logger?.info('SSE', `Events  ${cfg.sse.path}  max=${cfg.sse.maxClients} clients`)
  if (cfg.player?.introOutro?.enabled) logger?.info('Player', `Intro/outro  intro=${cfg.player.introOutro.introFile || 'none'}  outro=${cfg.player.introOutro.outroFile || 'none'}`)
}

export function logMemory(logger?: Logger) {
  const mem = process.memoryUsage()
  logger?.debug('Memory', `rss ${(mem.rss / 1024 / 1024).toFixed(1)}MB  ·  heap ${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB  ·  ext ${(mem.external / 1024 / 1024).toFixed(1)}MB`)
}

export function logPlayerAction(guildId: string, action: string, detail?: string, logger?: Logger) {
  logger?.info('Player', `${guildId}  ${action}${detail ? `  (${detail})` : ''}`)
}
