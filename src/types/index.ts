export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface Track {
  encoded: string
  info: TrackInfo
  source: string
  userData?: Record<string, unknown>
}

export interface TrackInfo {
  identifier: string
  title: string
  author: string
  duration: number
  uri: string
  artworkUrl: string
  sourceName: string
  isStream: boolean
  position: number
}

export interface PlayerState {
  guildId: string
  track?: Track
  volume: number
  paused: boolean
  position: number
  connected: boolean
  ping: number
}

export interface VoiceState {
  sessionId: string
  token: string
  endpoint: string
}

export interface SessionState {
  id: string
  resume: boolean
  resumeKey?: string
}

export interface LoadTracksResult {
  loadType: 'track' | 'search' | 'playlist' | 'empty' | 'error'
  tracks: Track[]
  playlistInfo?: PlaylistInfo
  exception?: Exception
}

export interface PlaylistInfo {
  name: string
  trackCount: number
}

export interface Exception {
  message: string
  severity: 'COMMON' | 'SUSPICIOUS' | 'FAULT'
}

export interface Stats {
  players: number
  playing: number
  uptime: number
  memory: MemoryStats
  cpu: CpuStats
  frameStats?: FrameStats
}

export interface MemoryStats {
  free: number
  used: number
  allocated: number
  reservable: number
}

export interface CpuStats {
  cores: number
  systemLoad: number
  processLoad: number
}

export interface FrameStats {
  sent: number
  nulled: number
  dropped: number
}

export interface Plugin {
  name: string
  version: string
  install(ctx: PluginContext): void | Promise<void>
}

export interface PluginContext {
  config: Record<string, unknown>
  onTrackStart: (handler: TrackEventHandler) => void
  onTrackEnd: (handler: TrackEndHandler) => void
}

export type TrackEventHandler = (guildId: string, track: Track) => void
export type TrackEndHandler = (guildId: string, track: Track, reason: string) => void

export interface QueueState {
  current: Track | null
  queue: Track[]
  history: Track[]
}

export interface FilterOptions {
  volume?: number
  equalizer?: Band[]
  karaoke?: KaraokeOptions
  timescale?: TimescaleOptions
  tremolo?: TremoloOptions
  vibrato?: VibratoOptions
  rotation?: RotationOptions
  distortion?: DistortionOptions
  channelMix?: ChannelMixOptions
  lowPass?: LowPassOptions
}

export interface Band {
  band: number
  gain: number
}

export interface KaraokeOptions {
  level?: number
  monoLevel?: number
  filterBand?: number
  filterWidth?: number
}

export interface TimescaleOptions {
  speed?: number
  pitch?: number
  rate?: number
}

export interface TremoloOptions {
  frequency?: number
  depth?: number
}

export interface VibratoOptions {
  frequency?: number
  depth?: number
}

export interface RotationOptions {
  rotationHz?: number
}

export interface DistortionOptions {
  sinOffset?: number
  sinScale?: number
  cosOffset?: number
  cosScale?: number
  tanOffset?: number
  tanScale?: number
  offset?: number
  scale?: number
}

export interface ChannelMixOptions {
  leftToLeft?: number
  leftToRight?: number
  rightToLeft?: number
  rightToRight?: number
}

export interface LowPassOptions {
  smoothing?: number
}

export interface Config {
  server: {
    host: string
    port: number
    password: string
    workers?: number
    maxBodySize?: number
    socketTimeout?: number
    trustProxy?: boolean
    /** Auth tokens (can have multiple) */
    tokens?: string[]
    /** IP whitelist (empty = allow all) */
    ipWhitelist?: string[]
    /** IP blacklist */
    ipBlacklist?: string[]
    /** Enable CORS */
    cors?: boolean
    /** Dashboard path (empty = disabled) */
    dashboard?: string
    /** Version endpoint path */
    versionPath?: string
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'text' | 'json'
    destination?: string
    colorize?: boolean
    excludePaths?: string[]
  }
  sources: {
    youtube: { enabled: boolean; clientProfiles?: ('WEB' | 'MUSIC' | 'ANDROID' | 'IOS' | 'TV')[]; proxy?: string }
    soundcloud: { enabled: boolean; clientId?: string }
    spotify: { enabled: boolean; clientId: string; clientSecret: string; market?: string }
    bandcamp?: { enabled: boolean }
    twitch?: { enabled: boolean }
    vimeo?: { enabled: boolean }
    deezer?: { enabled: boolean }
    apple?: { enabled: boolean }
    nico?: { enabled: boolean }
    mixcloud?: { enabled: boolean }
    podcast?: { enabled: boolean }
    http?: boolean
    local?: boolean
  }
  lavalink: {
    apiVersion: 3 | 4
    resumeTimeout?: number
    resumeKey?: string
    sessionTimeout?: number
  }
  voice: {
    udpMode?: 'ipv4' | 'ipv6'
    externalAddress?: string
    portRange?: [number, number]
    bufferSize?: number
  }
  queue: {
    maxHistorySize?: number
    defaultVolume?: number
    /** Max queue size (0 = unlimited) */
    maxSize?: number
    /** Crossfade duration in ms */
    crossfade?: number
  }
  player: {
    /** Auto advance to next track */
    autoPlay?: boolean
    /** Volume normalization (replaygain) */
    replaygain?: boolean
    /** Max event history entries */
    eventHistory?: number
  }
  cache: {
    /** Enable track cache */
    enabled: boolean
    /** Cache TTL in ms */
    ttl?: number
    /** Max cached entries */
    maxSize?: number
    /** Redis URL (if using redis cache) */
    redis?: string
  }
  metrics: {
    enabled: boolean
    path?: string
    prefix?: string
  }
  rateLimiting: {
    enabled?: boolean
    windowMs?: number
    maxRequests?: number
  }
  security: {
    /** Rate limit enabled */
    rateLimit?: boolean
    /** Max requests per window */
    maxRequests?: number
    /** Window in ms */
    windowMs?: number
  }
  plugins: {
    paths?: string[]
    configs?: Record<string, Record<string, unknown>>
  }
  clustering: {
    enabled: boolean
    nodes?: { host: string; port: number; password?: string; secure?: boolean }[]
  }
  /** Graceful shutdown delay in ms */
  shutdownDelay?: number
}

export interface Route {
  method: HttpMethod
  path: string
  handler: (req: Request, res: Response) => void | Promise<void>
}
