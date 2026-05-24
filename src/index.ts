import { loadConfig } from './config/index.js'
import { Server } from './server/index.js'
import { PlayerManager } from './player/manager.js'
import { SessionManager } from './lavalink/session.js'
import { LavalinkAPI } from './lavalink/api.js'
import { LavalinkWS } from './lavalink/ws.js'
import { Resolver } from './resolving/index.js'
import { pluginManager } from './plugin/index.js'
import { Metrics } from './metrics/index.js'

const configPath = process.argv[2] ?? 'sonata.json'
const cfg = loadConfig(configPath)

const resolver = new Resolver(
  process.env.SPOTIFY_CLIENT_ID,
  process.env.SPOTIFY_CLIENT_SECRET,
)

const metrics = new Metrics()
const sessions = new SessionManager()
const pm = new PlayerManager({
  onTrackStart: (p, track) => {
    wsHandler.onTrackStart(p, track)
    pluginManager.emitTrackStart(p.guildId, track)
    metrics.tracksPlayed.inc()
  },
  onTrackEnd: (p, track, reason) => {
    wsHandler.onTrackEnd(p, track, reason)
    pluginManager.emitTrackEnd(p.guildId, track, reason)
  },
  onTrackStuck: (p, track, threshold) => wsHandler.onTrackStuck(p, track, threshold),
  onTrackException: (p, track, err) => wsHandler.onTrackException(p, track, err),
  onPlayerUpdate: (p, state) => {
    wsHandler.onPlayerUpdate(p, state)
    metrics.playersActive.set(pm.count())
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
api.register(srv, cfg.lavalink.version)

srv.ws('/ws')
srv.wss.on('connection', (ws) => wsHandler.handleConnection(ws))

srv.handle('GET', '/metrics', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.end(await metrics.metrics)
})

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
  console.log(`Lavalink API: v${cfg.lavalink.version}`)
  console.log(`Sources: youtube, soundcloud${cfg.sources.spotify ? ', spotify' : ''}`)
})
