import { loadConfig } from './src/config/index.js'
import { createLogger } from './src/utils/logger.js'
import { Server } from './src/server/index.js'
import { Resolver } from './src/resolving/index.js'
import { PlayerManager } from './src/player/manager.js'
import { SessionManager } from './src/lavalink/session.js'
import { LavalinkAPI } from './src/lavalink/api.js'
import { LavalinkWS } from './src/lavalink/ws.js'
import { AuthManager } from './src/middleware/auth.js'

const cfg = await loadConfig()
cfg.server.port = 5555
cfg.logging.level = 'trace'

const logger = createLogger(cfg.logging)
logger.info('system', '=== SERVER STARTED (log demo, port 5555) ===')
logger.info('system', 'Level: trace — all messages shown')
logger.info('system', 'Format: text with timestamps')

logger.trace('demo', 'TRACE: most verbose, for deep debugging')
logger.verbose('demo', 'VERBOSE: detailed flow information')
logger.debug('demo', 'DEBUG: general debugging info')
logger.info('demo', 'NORMAL: default level, general info')
logger.warn('demo', 'WARN: something needs attention')
logger.error('demo', 'ERROR: something failed')

logger.info('voice', 'Connecting to Discord voice channel...')
logger.debug('voice', 'stateChange: connecting -> ready')
logger.debug('voice', 'UDP connection established')

logger.info('streamer', 'Starting playback of Rick Astley - Never Gonna Give You Up')
logger.verbose('streamer', 'ffmpeg args: -reconnect 1 -reconnect_streamed 1 -i https://...')
logger.debug('streamer', 'PCM buffer: 48000 bytes, Opus encoded')

logger.info('http', 'GET /health 200 2ms')
logger.info('http', 'GET /loadtracks 200 312ms')
logger.debug('http', 'Cache hit for loadtracks identifer=never+gonna...')

const resolver = new Resolver({
  youtube: { enabled: true, clientProfiles: ['WEB'] },
  soundcloud: { enabled: false },
  spotify: { enabled: false, clientId: '', clientSecret: '' },
  tiktok: false,
})

const srv = new Server({ logger, password: 'test' })
const sessions = new SessionManager(cfg.lavalink)
const pm = new PlayerManager({}, false, '')
const wsHandler = new LavalinkWS(pm, sessions, { queue: cfg.queue, player: cfg.player }, logger)
const api = new LavalinkAPI(pm, resolver, sessions, null)

srv.noAuth('/health')
srv.handle('GET', '/health', (req, res) => res.end(JSON.stringify({ status: 'ok' })))
api.register(srv, 4)

srv.listen(5555, '0.0.0.0', () => {
  logger.info('http', 'READY on http://0.0.0.0:5555')
  // Make API calls to generate more logs
  setTimeout(async () => {
    for (let i = 0; i < 2; i++) {
      await fetch('http://localhost:5555/health')
      await new Promise(r => setTimeout(r, 300))
    }
    const r = await fetch('http://localhost:5555/loadtracks?identifier=never+gonna+give+you+up', {
      headers: { 'Authorization': 'test' }
    })
    const data = await r.json()
    logger.info('demo', `Loaded ${data.tracks.length} tracks (${data.loadType})`)
    logger.info('demo', '=== DEMO COMPLETE ===')
  }, 500)
})
