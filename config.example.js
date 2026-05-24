export default {
  server: {
    host: '0.0.0.0',
    port: 2333,
    password: 'youshallnotpass',
    // Max request body size in bytes (default: 1MB)
    maxBodySize: 1_048_576,
    // HTTP socket timeout in ms
    socketTimeout: 30_000,
    // Trust X-Forwarded-For headers for rate limiting
    trustProxy: false,
  },

  logging: {
    level: 'info', // debug | info | warn | error
    format: 'text', // text | json
    // Write to file instead of stdout
    // destination: '/var/log/sonata.log',
    colorize: true,
    // Don't log health/metrics requests
    excludePaths: ['/health', '/metrics'],
  },

  sources: {
    youtube: {
      enabled: true,
      // InnerTube client profiles to try (in order)
      // More profiles = better chance of getting stream URLs
      clientProfiles: ['WEB', 'MUSIC', 'ANDROID', 'IOS', 'TV'],
      // HTTP proxy for YouTube requests
      // proxy: 'http://proxy:8080',
    },
    soundcloud: {
      enabled: true,
      // Custom client ID (auto-discovered from soundcloud.com if empty)
      clientId: '',
    },
    spotify: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      market: 'US',
    },
    // Direct HTTP audio URLs (e.g. https://example.com/song.mp3)
    http: false,
    // Local file playback (e.g. file:///music/song.mp3)
    local: false,
  },

  lavalink: {
    // API version: 3 or 4
    apiVersion: 4,
    // Session resume timeout in seconds
    resumeTimeout: 60,
    // Fixed resume key (auto-generated if empty)
    resumeKey: '',
    // Session timeout before auto-cleanup
    sessionTimeout: 300,
  },

  voice: {
    udpMode: 'ipv4', // ipv4 | ipv6
    // External IP for voice connections (auto-detected if empty)
    externalAddress: '',
    // UDP port range [min, max] (0 = system assigned)
    portRange: [0, 0],
    bufferSize: 4096,
  },

  queue: {
    maxHistorySize: 100,
    defaultVolume: 100,
  },

  metrics: {
    enabled: true,
    path: '/metrics',
    prefix: 'sonata',
  },

  rateLimiting: {
    enabled: false,
    windowMs: 60_000,  // 1 minute
    maxRequests: 100,   // max 100 requests per window
  },

  plugins: {
    // Paths to plugin modules (.js files)
    paths: [],
    // Per-plugin configs
    configs: {},
  },

  clustering: {
    enabled: false,
    nodes: [
      // { host: 'node2', port: 2333, password: 'youshallnotpass' },
    ],
  },
}
