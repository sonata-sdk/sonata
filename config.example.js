export default {
  // ── Server ──────────────────────────────────────────────────────────
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
    healthPath: '/health',
    maxBodySize: 1_048_576,
    socketTimeout: 30_000,
    keepAliveTimeout: 5_000,
    maxHeaderSize: 16_384,
    compression: false,
    http2: false,
    trustProxy: false,
    trustedIps: [],
    customHeaders: { 'X-Powered-By': 'Sonata' },
  },

  // ── Logging ─────────────────────────────────────────────────────────
  logging: {
    level: 'trace',         // trace | verbose | debug | normal | warn | error
    format: 'text',         // text | json
    colorize: true,
    showPid: true,
    timestampFormat: 'iso', // iso | epoch | relative | none
    excludePaths: ['/health', '/metrics', '/dashboard', '/version'],
    moduleLevels: {},
    correlationId: false,
    audit: {
      enabled: false,
      events: ['session.create', 'session.destroy', 'player.play', 'player.stop', 'queue.clear', 'queue.shuffle'],
      file: 'logs/audit.log',
    },
    file: {
      enabled: false,
      path: 'logs/sonata.log',
      maxSize: 10_485_760,  // 10MB
      maxFiles: 5,
      compress: false,
    },
  },

  // ── Sources ─────────────────────────────────────────────────────────
  sources: {
    youtube: {
      enabled: true,
      clientProfiles: ['WEB', 'MUSIC', 'ANDROID', 'IOS', 'TV'],
      timeout: 10_000,
      maxResults: 20,
      fetchPlayerJS: false,
      // --
      // OAuth (device code flow) for TVHTML5 client.
      // Set getOAuthToken to true, start the server, visit the URL, enter the code,
      // then paste the refresh token below and set getOAuthToken back to false.
      // WARNING: Do NOT use your main Google account. Use a secondary/burner account!
      oauth: {
        getOAuthToken: false,
        refreshToken: '',
      },
      // --
      // Remote cipher service for resolving YouTube playback URLs.
      // Resolves the 'n' parameter and signature timestamps.
      cipher: {
        url: '',
        token: '',
      },
      // Proof-of-origin token service (optional).
      poToken: {
        service: '',
        token: '',
      },
      // Per-client settings (e.g. TV refresh tokens).
      clients: {
        settings: {
          TV: {
            refreshToken: [],
          },
        },
      },
      // Explicit player script URL for cipher/STS resolution.
      playerUrl: 'https://www.youtube.com/s/player/c2f7551f/player_embed.vflset/en_US/base.js',
    },
    soundcloud: {
      enabled: true,
      clientId: '',
      apiUrl: 'https://api.soundcloud.com',
      resolveRedirects: true,
      timeout: 10_000,
    },
    spotify: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      market: 'US',
      country: 'US',
      maxPlaylistTracks: 200,
      resolverFlavor: 'auto',  // auto | mirror | direct
      retryCount: 2,
      spDc: '',  // Spotify sp_dc cookie (optional, enables ISRC via internal API)
    },
    bandcamp:  { enabled: true, quality: 'high',  timeout: 10_000 },
    twitch:    { enabled: true, quality: 'source', timeout: 10_000 },
    vimeo:     { enabled: true, quality: 'best',   timeout: 10_000 },
    deezer:    { enabled: true, quality: 'MP3_320', timeout: 10_000, arl: '', proxy: '' },
    apple:     { enabled: true, quality: 'high',    timeout: 10_000, storefront: 'us' },
    nico:      { enabled: true, quality: 'best',    timeout: 10_000 },
    mixcloud:  { enabled: true, quality: 'best',    timeout: 10_000 },
    podcast:   { enabled: true, maxEpisodes: 50,    timeout: 10_000 },
    tiktok:    { enabled: false, quality: 'best', timeout: 10_000 },
    http:      true,
    local:     true,

    // Source priority ordering (first match wins)
    priority: ['youtube', 'soundcloud', 'spotify', 'bandcamp', 'twitch',
               'vimeo', 'deezer', 'apple', 'nico', 'mixcloud', 'podcast', 'tiktok', 'http', 'local'],
    requestTimeout: 10_000,
  },

  // ── Lavalink ────────────────────────────────────────────────────────
  lavalink: {
    apiVersion: 4,
    resumeTimeout: 60,
    resumeKey: '',
    sessionTimeout: 300,
    pluginDir: '',
    maxTrackLength: 0,        // 0 = unlimited
    strictValidation: true,
  },

  // ── Voice ───────────────────────────────────────────────────────────
  voice: {
    udpMode: 'ipv4',
    externalAddress: '',
    portRange: [0, 0],
    bufferSize: 4096,
    forceIpDiscovery: false,
    encryptionFallback: ['xsalsa20_poly1305', 'aes256_gcm'],
    silenceFrames: 5,
    keepaliveInterval: 30_000,
    maxReconnectAttempts: 5,
    reconnectDelay: 1_000,
  },

  // ── Queue ───────────────────────────────────────────────────────────
  queue: {
    maxHistorySize: 100,
    defaultVolume: 100,
    maxSize: 0,               // 0 = unlimited
    crossfade: 0,             // 0 = disabled
    crossfadeFadeIn: 0,
    crossfadeFadeOut: 0,
    shuffle: false,
    emptyRepeatMode: 'none',  // none | track | queue
    perSourceLimits: {},

    // ── DJ mode ──
    djMode: {
      enabled: false,
      roles: [],
      users: [],
      allowSelfPlay: true,
      bypassOnEmpty: true,
    },

    // ── Collaborative queue ──
    collaborative: {
      enabled: false,
      maxTracksPerUser: 10,
      minVotesToSkip: 3,
      voteSkipEnabled: false,
    },

    // ── Radio mode (autoplay) ──
    radioMode: {
      enabled: false,
      source: 'youtube',
      basedOn: 'lastTrack',    // lastTrack | history | seed
      seedTracks: [],
      refreshAfter: 10,        // tracks played before refresh
    },

    // ── Smart queue ──
    smartQueue: {
      enabled: false,
      mode: 'history',         // history | genre | artist | similar
      maxTracks: 20,
      minTracksToTrigger: 5,
    },

    // ── Queue filters ──
    filters: {
      deduplicate: false,
      maxPerSource: 0,         // 0 = unlimited
      maxPerArtist: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      allowedSources: [],
      blockedSources: [],
    },
  },

  // ── Player ──────────────────────────────────────────────────────────
  player: {
    autoPlay: true,
    replaygain: false,
    eventHistory: 50,
    emptyQueueBehavior: 'stop',  // stop | pause | await
    autoLeaveMs: 300_000,
    skipOnError: true,
    maxErrorSkips: 3,
    maxTrackDuration: 0,
    minTrackDuration: 0,
    idleTimeout: 300_000,
    crossfadeOffset: 0,
    allowStreamSeek: false,
    maxSeekPosition: 0,
    stickyQueue: false,
    stickyQueueFile: '',
    normalization: false,
    normalizationTarget: -14,

    // ── Audio ducking (reduce volume when others speak) ──
    ducking: {
      enabled: false,
      threshold: 0.02,       // Signal threshold to trigger duck
      reduceBy: 0.5,         // Volume multiplier (0-1)
      attackMs: 100,         // Time to reach reduced volume
      releaseMs: 500,        // Time to restore volume
      minVolume: 0.05,       // Minimum volume when ducking
    },

    // ── Gapless playback ──
    gapless: {
      enabled: false,
      maxGapMs: 50,          // Max silence gap to eliminate
      preferAccurate: true,  // Accurate mode (higher CPU)
    },

    // ── Fade in/out ──
    fade: {
      enabled: false,
      fadeInMs: 2000,
      fadeOutMs: 2000,
      onPlay: true,
      onPause: true,
      onResume: false,
      onSkip: false,
    },

    // ── Auto volume leveling ──
    autoVolume: {
      enabled: false,
      targetLUFS: -14,       // Integrated loudness target
      maxGain: 6,            // Max gain in dB
      minGain: -6,           // Min gain in dB
      attackMs: 2000,
      releaseMs: 5000,
    },

    // ── Player snapshot/restore ──
    snapshot: {
      enabled: false,
      dir: 'data/snapshots',
      autoSave: true,
      saveIntervalMs: 60_000,
      maxSnapshots: 10,
    },

    // ── Intro/outro system ──
    introOutro: {
      enabled: false,
      introFile: '',
      outroFile: '',
      mixIntro: true,        // Mix intro over track start
      mixOutro: true,        // Mix outro over track end
    },

    // ── Bandwidth limit per player ──
    bandwidthLimit: {
      enabled: false,
      maxKbps: 0,              // 0 = unlimited
      burstKbps: 0,
    },

    // ── Dynamic EQ (genre-adaptive) ──
    dynamicEq: {
      enabled: false,
      preset: 'auto',          // auto | rock | jazz | classical | electronic | custom
      customBands: [],
      adaptationMs: 2000,
    },

    // ── Reverb presets ──
    reverb: {
      enabled: false,
      preset: 'room',          // room | hall | stage | cathedral | plate
      mix: 0.3,
      decay: 0.5,
      delay: 0.05,
    },

    // ── Sync zones (player groups) ──
    syncZone: {
      enabled: false,
      maxSkewMs: 50,
      syncIntervalMs: 1000,
    },

    // ── HLS/DASH playback ──
    hls: {
      enabled: true,
      maxBufferSize: 10_485_760,
    },
    dash: {
      enabled: true,
      maxBufferSize: 10_485_760,
    },

    // ── Multichannel downmixing ──
    downmix: {
      enabled: false,
      mode: 'stereo',          // stereo | surround | phantomCenter
    },

    // ── Pitch shifting ──
    pitchShift: {
      enabled: false,
      speed: 1.0,
      pitch: 1.0,
    },

    // ── Spatial audio (3D/binaural) ──
    spatialAudio: {
      enabled: false,
      method: 'binaural',      // binaural | stereo | headphone
      headSize: 0.09,
    },

    // ── Stereo widening ──
    stereoWidening: {
      enabled: false,
      width: 1.0,              // 0 = mono, 1 = normal, 2 = wide
    },

    // ── Mono downmix ──
    monoDownmix: {
      enabled: false,
      method: 'average',       // average | left | right
    },

    // ── Noise gate ──
    noiseGate: {
      enabled: false,
      threshold: 0.01,
      attackMs: 10,
      releaseMs: 100,
      holdMs: 50,
    },

    // ── Convolution reverb ──
    convolutionReverb: {
      enabled: false,
      impulseFile: '',
      mix: 0.5,
    },

    // ── Sidechain compression ──
    sidechain: {
      enabled: false,
      threshold: 0.5,
      ratio: 4,
      attackMs: 5,
      releaseMs: 50,
    },

    // ── Echo/Delay ──
    echo: {
      enabled: false,
      delayMs: 200,
      feedback: 0.3,
      mix: 0.5,
    },

    // ── Flanger ──
    flanger: {
      enabled: false,
      rate: 0.5,
      depth: 1.0,
      feedback: 0.5,
      mix: 0.5,
    },

    // ── Phaser ──
    phaser: {
      enabled: false,
      rate: 0.3,
      depth: 1.0,
      feedback: 0.3,
      stages: 4,
      mix: 0.5,
    },

    // ── Audio fingerprint (acoustic) ──
    fingerprint: {
      enabled: false,
      provider: '',            // external service URL or module name
      minConfidence: 0.8,
    },

    // Default filters applied to every player (optional).
    // Lavalink-compatible — all fields can be overridden per-player via API.
    filters: {
      // volume:  100,                     // 0 – 1000
      // equalizer: [],                    // [{ band: 0, gain: 0.25 }, ...]
      // karaoke:  { level: 0, monoLevel: 1, filterBand: 220, filterWidth: 100 },
      // timescale: { speed: 1, pitch: 1, rate: 1 },
      // tremolo:  { frequency: 2, depth: 0 },
      // vibrato:  { frequency: 2, depth: 0 },
      // rotation: { rotationHz: 0 },
      // distortion: { sinOffset: 0, sinScale: 1, cosOffset: 0, cosScale: 1, tanOffset: 0, tanScale: 1 },
      // channelMix: { leftToLeft: 1, leftToRight: 0, rightToLeft: 0, rightToRight: 1 },
      // lowPass:  { smoothing: 1 },
      // highPass: { smoothing: 0 },
      // reverb:   { delay: 0.05, decay: 0.3, mix: 0 },
      // limiter:  { threshold: 1, attack: 0.002, release: 0.1, ratio: 20 },
    },
  },

  // ── Cache ───────────────────────────────────────────────────────────
  cache: {
    enabled: true,
    ttl: 300_000,
    searchTtl: 60_000,
    playlistTtl: 300_000,
    negativeTtl: 10_000,
    maxSize: 500,
    keyPrefix: 'sonata:',
    memoryOnly: false,
    redis: '',
  },

  // ── Metrics ─────────────────────────────────────────────────────────
  metrics: {
    enabled: true,
    path: '/metrics',
    prefix: 'sonata',
    histogramBuckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    labels: {},
    excludeRoutes: [],
  },

  // ── Rate Limiting ───────────────────────────────────────────────────
  rateLimiting: {
    enabled: false,
    windowMs: 60_000,
    maxRequests: 100,
    perRoute: {},
    statusCode: 429,
    message: 'Too many requests, please try again later.',
    sendHeaders: true,
    trustProxy: false,
    perUser: false,
    redis: {
      enabled: false,
      url: '',
      keyPrefix: 'sonata:rl:',
    },
  },

  // ── Security ────────────────────────────────────────────────────────
  security: {
    // rateLimit/maxRequests/windowMs are deprecated — use rateLimiting above
    rateLimit: false,
    maxRequests: 100,
    windowMs: 60_000,
    blockMethods: [],
    blockPaths: [],
    maxBodyDepth: 10,
    enforceContentType: false,
    hstsMaxAge: 0,
    requireUserAgent: false,
    blockSqlInjection: false,
    blockXss: false,
  },

  // ── Plugins ─────────────────────────────────────────────────────────
  plugins: {
    paths: [],
    configs: {},
    npm: [],
    scanDir: '',
  },

  // ── Discord Gateway (auto-connect mode) ───────────────────────────
  discord: {
    enabled: false,
    token: '',
    intents: 0,
  },

  // ── Webhooks ────────────────────────────────────────────────────────
  webhooks: [
    // {
    //   url: 'https://discord.com/api/webhooks/...',
    //   secret: 'hmac-secret',
    //   events: ['TrackStartEvent', 'TrackEndEvent', 'TrackExceptionEvent'],
    //   retries: 3,
    //   retryDelay: 1000,
    // },
  ],

  // ── Database ─────────────────────────────────────────────────────────
  database: {
    enabled: false,
    type: 'sqlite',       // sqlite | postgres | mysql
    url: '',
    sqlitePath: 'data/sonata.db',
    poolSize: 10,
    migrate: true,
  },

  // ── Recording ────────────────────────────────────────────────────────
  recording: {
    enabled: false,
    dir: 'recordings',
    format: 'wav',        // wav | opus | pcm
    maxDuration: 600,     // seconds, 0 = unlimited
    splitOnTrack: true,
    autoStart: false,
    maxConcurrent: 3,
  },

  // ── Sentry (error tracking) ──────────────────────────────────────────
  sentry: {
    enabled: false,
    dsn: '',
    environment: 'production',
    tracesSampleRate: 0.1,
    attachStacktrace: true,
  },

  // ── Datadog (metrics) ────────────────────────────────────────────────
  datadog: {
    enabled: false,
    agentHost: 'localhost',
    agentPort: 8125,
    prefix: 'sonata.',
    tags: {},
  },

  // ── OpenTelemetry ────────────────────────────────────────────────────
  opentelemetry: {
    enabled: false,
    endpoint: '',
    serviceName: 'sonata',
    samplingRate: 0.1,
    headers: {},
  },

  // ── SSE (Server-Sent Events) ─────────────────────────────────────────
  sse: {
    enabled: false,
    path: '/events',
    maxClients: 50,
    heartbeatInterval: 30_000,
    allowedEvents: ['TrackStartEvent', 'TrackEndEvent', 'PlayerUpdate'],
  },

  // ── WebSocket ────────────────────────────────────────────────────────
  ws: {
    eventFiltering: false,
    allowedEvents: [],
    announcements: {
      enabled: false,
      intervalMs: 60_000,
      message: '',
    },
  },

  // ── Health Checks ────────────────────────────────────────────────────
  healthChecks: {
    enabled: false,
    intervalMs: 30_000,
    checks: ['redis', 'sentry', 'sources'],
    timeout: 5_000,
  },

  // ── Maintenance Mode ─────────────────────────────────────────────────
  maintenance: {
    enabled: false,
    message: 'Server is under maintenance. Please try again later.',
    allowAdmins: true,
    drainPlayers: false,
  },

  // ── API Documentation (Swagger) ──────────────────────────────────────
  docs: {
    swagger: {
      enabled: false,
      path: '/api-docs',
      title: 'Sonata API',
      version: '4.0.0',
    },
  },

  // ── Clustering ──────────────────────────────────────────────────────
  clustering: {
    enabled: false,
    nodes: [],
    nodeId: '',
    heartbeatInterval: 10_000,
    heartbeatTimeout: 30_000,
    electionStrategy: 'manual',  // manual | lowestLoad | roundRobin | hash
    ipc: {
      enabled: false,
      socketPath: '/tmp/sonata-cluster.sock',
    },
    consistentHashing: {
      enabled: false,
      virtualNodes: 100,
    },
  },

  // ── Resolver ────────────────────────────────────────────────────────
  resolving: {
    strict: false,
    maxUriLength: 2048,
    defaultSearch: 'youtube',
    searchAliases: { yt: 'youtube', sc: 'soundcloud', sp: 'spotify', bc: 'bandcamp' },
    retryCount: 2,
    retryDelay: 1_000,
    fallbacks: ['youtube', 'soundcloud'],
  },

  // ── Dashboard ───────────────────────────────────────────────────────
  dashboard: {
    title: 'Sonata',
    theme: 'dark',
    refreshInterval: 5_000,
    showTrackHistory: true,
    showPlayerControls: true,
    brandColor: '#5865F2',
    footerText: 'Sonata Audio Server',
  },

  // ── Misc ────────────────────────────────────────────────────────────
  shutdownDelay: 10_000,
}
