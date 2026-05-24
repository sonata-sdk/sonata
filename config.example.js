export default {
  server: {
    host: '0.0.0.0',
    port: 2333,
    password: 'youshallnotpass',
    tokens: [],
    ipWhitelist: [],
    ipBlacklist: [],
    cors: true,
    dashboard: '/dashboard',
    versionPath: '/version',
    maxBodySize: 1_048_576,
    socketTimeout: 30_000,
    trustProxy: false,
  },

  logging: {
    level: 'info',
    format: 'text',
    colorize: true,
    excludePaths: ['/health', '/metrics', '/dashboard', '/version'],
  },

  sources: {
    youtube: { enabled: true, clientProfiles: ['WEB', 'MUSIC', 'ANDROID', 'IOS', 'TV'] },
    soundcloud: { enabled: true, clientId: '' },
    spotify: { enabled: false, clientId: '', clientSecret: '', market: 'US' },
    bandcamp: { enabled: true },
    twitch: { enabled: true },
    vimeo: { enabled: true },
    deezer: { enabled: true },
    apple: { enabled: true },
    nico: { enabled: true },
    mixcloud: { enabled: true },
    podcast: { enabled: true },
    http: true,
    local: true,
  },

  lavalink: {
    apiVersion: 4,
    resumeTimeout: 60,
    resumeKey: '',
    sessionTimeout: 300,
  },

  voice: {
    udpMode: 'ipv4',
    externalAddress: '',
    portRange: [0, 0],
    bufferSize: 4096,
  },

  queue: {
    maxHistorySize: 100,
    defaultVolume: 100,
    maxSize: 0,
    crossfade: 0,
  },

  player: {
    autoPlay: true,
    replaygain: false,
    eventHistory: 50,
  },

  cache: {
    enabled: true,
    ttl: 300_000,
    maxSize: 500,
    redis: '',
  },

  metrics: {
    enabled: true,
    path: '/metrics',
    prefix: 'sonata',
  },

  security: {
    rateLimit: false,
    maxRequests: 100,
    windowMs: 60_000,
  },

  plugins: {
    paths: [],
    configs: {},
  },

  clustering: {
    enabled: false,
    nodes: [],
  },

  shutdownDelay: 10_000,
}
