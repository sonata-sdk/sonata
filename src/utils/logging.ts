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

  // Player DSP features
  if (cfg.player?.bandwidthLimit?.enabled) logger?.info('Player', `Bandwidth limit  max=${cfg.player.bandwidthLimit.maxKbps}Kbps  burst=${cfg.player.bandwidthLimit.burstKbps}`)
  if (cfg.player?.dynamicEq?.enabled) logger?.info('Player', `Dynamic EQ  preset=${cfg.player.dynamicEq.preset}  adapt=${cfg.player.dynamicEq.adaptationMs}ms`)
  if (cfg.player?.reverb?.enabled) logger?.info('Player', `Reverb  preset=${cfg.player.reverb.preset}  mix=${cfg.player.reverb.mix}  decay=${cfg.player.reverb.decay}`)
  if (cfg.player?.syncZone?.enabled) logger?.info('Player', `Sync zone  maxSkew=${cfg.player.syncZone.maxSkewMs}ms  interval=${cfg.player.syncZone.syncIntervalMs}ms`)
  if (cfg.player?.hls?.enabled) logger?.info('Player', 'HLS playback  enabled')
  if (cfg.player?.dash?.enabled) logger?.info('Player', 'DASH playback  enabled')
  if (cfg.player?.downmix?.enabled) logger?.info('Player', `Downmix  mode=${cfg.player.downmix.mode}`)
  if (cfg.player?.pitchShift?.enabled) logger?.info('Player', `Pitch shift  speed=${cfg.player.pitchShift.speed}  pitch=${cfg.player.pitchShift.pitch}`)
  if (cfg.player?.spatialAudio?.enabled) logger?.info('Player', `Spatial audio  method=${cfg.player.spatialAudio.method}`)
  if (cfg.player?.stereoWidening?.enabled) logger?.info('Player', `Stereo widening  width=${cfg.player.stereoWidening.width}`)
  if (cfg.player?.monoDownmix?.enabled) logger?.info('Player', `Mono downmix  method=${cfg.player.monoDownmix.method}`)
  if (cfg.player?.noiseGate?.enabled) logger?.info('Player', `Noise gate  threshold=${cfg.player.noiseGate.threshold}`)
  if (cfg.player?.convolutionReverb?.enabled) logger?.info('Player', `Convolution reverb  impulse=${cfg.player.convolutionReverb.impulseFile || 'none'}`)
  if (cfg.player?.sidechain?.enabled) logger?.info('Player', `Sidechain  threshold=${cfg.player.sidechain.threshold}  ratio=${cfg.player.sidechain.ratio}`)
  if (cfg.player?.echo?.enabled) logger?.info('Player', `Echo/Delay  delay=${cfg.player.echo.delayMs}ms  feedback=${cfg.player.echo.feedback}`)
  if (cfg.player?.flanger?.enabled) logger?.info('Player', `Flanger  rate=${cfg.player.flanger.rate}  depth=${cfg.player.flanger.depth}`)
  if (cfg.player?.phaser?.enabled) logger?.info('Player', `Phaser  rate=${cfg.player.phaser.rate}  stages=${cfg.player.phaser.stages}`)
  if (cfg.player?.fingerprint?.enabled) logger?.info('Player', `Audio fingerprint  provider=${cfg.player.fingerprint.provider || 'default'}`)

  // Queue features
  if (cfg.queue?.djMode?.enabled) logger?.info('Queue', `DJ mode  roles=${cfg.queue.djMode.roles?.length ?? 0}  users=${cfg.queue.djMode.users?.length ?? 0}`)
  if (cfg.queue?.collaborative?.enabled) logger?.info('Queue', `Collaborative  maxPerUser=${cfg.queue.collaborative.maxTracksPerUser}  voteSkip=${cfg.queue.collaborative.voteSkipEnabled}`)
  if (cfg.queue?.radioMode?.enabled) logger?.info('Queue', `Radio mode  source=${cfg.queue.radioMode.source}  basedOn=${cfg.queue.radioMode.basedOn}`)
  if (cfg.queue?.smartQueue?.enabled) logger?.info('Queue', `Smart queue  mode=${cfg.queue.smartQueue.mode}  max=${cfg.queue.smartQueue.maxTracks}`)
  if (cfg.queue?.filters?.deduplicate) logger?.info('Queue', 'Queue dedup  enabled')
  if (cfg.queue?.filters?.maxPerSource) logger?.info('Queue', `Queue source limit  ${cfg.queue.filters.maxPerSource} per source`)

  // New sections
  if (cfg.sentry?.enabled) logger?.info('Sentry', `Error tracking  env=${cfg.sentry.environment}  rate=${cfg.sentry.tracesSampleRate}`)
  if (cfg.datadog?.enabled) logger?.info('Datadog', `Metrics  ${cfg.datadog.agentHost}:${cfg.datadog.agentPort}  prefix=${cfg.datadog.prefix}`)
  if (cfg.ws?.announcements?.enabled) logger?.info('WS', `Announcements  every ${cfg.ws.announcements.intervalMs / 1000}s`)
  if (cfg.ws?.eventFiltering) logger?.info('WS', 'Event filtering  enabled')
  if (cfg.healthChecks?.enabled) logger?.info('HealthChecks', `Active  every ${cfg.healthChecks.intervalMs / 1000}s  checks=${cfg.healthChecks.checks?.join(', ') ?? 'all'}`)
  if (cfg.maintenance?.enabled) logger?.info('Maintenance', `ACTIVE  ${cfg.maintenance.message}  drainPlayers=${cfg.maintenance.drainPlayers}`)
  if (cfg.docs?.swagger?.enabled) logger?.info('Docs', `Swagger  ${cfg.docs.swagger.path}  ${cfg.docs.swagger.title} v${cfg.docs.swagger.version}`)
  if (cfg.clustering?.ipc?.enabled) logger?.info('Cluster', `IPC  ${cfg.clustering.ipc.socketPath}`)
  if (cfg.clustering?.consistentHashing?.enabled) logger?.info('Cluster', `Consistent hashing  vnodes=${cfg.clustering.consistentHashing.virtualNodes}`)
  if (cfg.rateLimiting?.redis?.enabled) logger?.info('RateLimiter', `Redis  ${cfg.rateLimiting.redis.keyPrefix}`)
  if (cfg.logging?.correlationId) logger?.info('Logging', 'Correlation IDs  enabled')
  if (cfg.logging?.audit?.enabled) logger?.info('Logging', `Audit trail  → ${cfg.logging.audit.file}  events=${cfg.logging.audit.events?.length ?? 'all'}`)
}

export function logMemory(logger?: Logger) {
  const mem = process.memoryUsage()
  logger?.debug('Memory', `rss ${(mem.rss / 1024 / 1024).toFixed(1)}MB  ·  heap ${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB  ·  ext ${(mem.external / 1024 / 1024).toFixed(1)}MB`)
}

export function logPlayerAction(guildId: string, action: string, detail?: string, logger?: Logger) {
  logger?.info('Player', `${guildId}  ${action}${detail ? `  (${detail})` : ''}`)
}
