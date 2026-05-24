import { loadConfig } from './config/index.js'
import { Server } from './server/index.js'
import { PlayerManager } from './player/manager.js'
import { SessionManager } from './lavalink/session.js'
import { LavalinkAPI } from './lavalink/api.js'
import { LavalinkWS } from './lavalink/ws.js'
import { Resolver } from './resolving/index.js'
import { pluginManager } from './plugin/index.js'
import { Metrics } from './metrics/index.js'

const cfg = await loadConfig(process.argv[2])

const resolver = new Resolver({
  youtube: cfg.sources.youtube,
  soundcloud: cfg.sources.soundcloud,
  spotify: cfg.sources.spotify,
  http: cfg.sources.http,
  local: cfg.sources.local,
})

const metrics = new Metrics(cfg.metrics)
const sessions = new SessionManager(cfg.lavalink)
const pm = new PlayerManager({
  onTrackStart: (p, track) => {
    wsHandler.onTrackStart(p, track)
    pluginManager.emitTrackStart(p.guildId, track)
    if (metrics) metrics.tracksPlayed.inc()
  },
  onTrackEnd: (p, track, reason) => {
    wsHandler.onTrackEnd(p, track, reason)
    pluginManager.emitTrackEnd(p.guildId, track, reason)
  },
  onTrackStuck: (p, track, threshold) => wsHandler.onTrackStuck(p, track, threshold),
  onTrackException: (p, track, err) => wsHandler.onTrackException(p, track, err),
  onPlayerUpdate: (p, state) => {
    wsHandler.onPlayerUpdate(p, state)
    if (metrics) metrics.playersActive.set(pm.count())
  },
  onQueueEnd: (p) => wsHandler.onQueueEnd(p),
})

const wsHandler = new LavalinkWS(pm, sessions)

const srv = new Server({
  level: cfg.logging.level,
  format: cfg.logging.format,
  password: cfg.server.password,
})

const api = new LavalinkAPI(pm, resolver, sessions)
api.register(srv, cfg.lavalink.apiVersion)

srv.ws('/ws')
srv.wss.on('connection', (ws) => wsHandler.handleConnection(ws))

if (cfg.metrics?.enabled && metrics) {
  srv.handle('GET', cfg.metrics.path ?? '/metrics', async (req, res) => {
    res.setHeader('Content-Type', 'text/plain')
    res.end(await metrics.metrics)
  })
}

srv.handle('GET', '/health', (req, res) => {
  res.end(JSON.stringify({
    status: 'ok',
    uptime: process.uptime(),
    players: pm.count(),
    playing: pm.playingCount(),
  }))
})

srv.listen(cfg.server.port, cfg.server.host, () => {
  console.log(`Sonata v0.1.0 running on ${cfg.server.host}:${cfg.server.port}`)
  console.log(`Lavalink API: v${cfg.lavalink.apiVersion}`)
  console.log(`Sources: ${[
    cfg.sources.youtube.enabled && 'youtube',
    cfg.sources.soundcloud.enabled && 'soundcloud',
    cfg.sources.spotify.enabled && 'spotify',
    cfg.sources.http && 'http',
    cfg.sources.local && 'local',
  ].filter(Boolean).join(', ')}`)
})
