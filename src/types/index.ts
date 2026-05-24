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
    /** Host to bind the HTTP/WS server */
    host: string
    /** Port to listen on */
    port: number
    /** Lavalink auth password */
    password: string
    /** Number of worker threads (0 = main thread only) */
    workers?: number
    /** Max request body size in bytes */
    maxBodySize?: number
    /** HTTP socket timeout in ms */
    socketTimeout?: number
    /** Trust X-Forwarded-For headers */
    trustProxy?: boolean
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'text' | 'json'
    /** Write logs to file instead of stdout */
    destination?: string
    /** Colorize text output */
    colorize?: boolean
    /** Exclude these URL paths from access logs */
    excludePaths?: string[]
  }
  sources: {
    youtube: {
      /** Enable YouTube source */
      enabled: boolean
      /** InnerTube client profiles to try in order */
      clientProfiles?: ('WEB' | 'MUSIC' | 'ANDROID' | 'IOS' | 'TV')[]
      /** Proxy for YouTube requests */
      proxy?: string
    }
    soundcloud: {
      /** Enable SoundCloud source */
      enabled: boolean
      /** Custom client ID (auto-discovered if empty) */
      clientId?: string
    }
    spotify: {
      /** Enable Spotify source (metadata-only; mirrors to YouTube for audio) */
      enabled: boolean
      /** Spotify API client ID */
      clientId: string
      /** Spotify API client secret */
      clientSecret: string
      /** Country code for market filtering */
      market?: string
    }
    /** Enable direct HTTP audio URLs */
    http?: boolean
    /** Enable local file playback */
    local?: boolean
  }
  lavalink: {
    apiVersion: 3 | 4
    /** Session resume timeout in seconds */
    resumeTimeout?: number
    /** Fixed resume key (auto-generated if empty) */
    resumeKey?: string
    /** Session timeout in seconds */
    sessionTimeout?: number
  }
  voice: {
    /** UDP mode: ipv4 or ipv6 */
    udpMode?: 'ipv4' | 'ipv6'
    /** External IP for voice connections (auto if empty) */
    externalAddress?: string
    /** UDP port range [min, max] */
    portRange?: [number, number]
    /** UDP socket buffer size */
    bufferSize?: number
  }
  queue: {
    /** Max size of play history */
    maxHistorySize?: number
    /** Default volume (0-1000) */
    defaultVolume?: number
  }
  metrics: {
    /** Enable Prometheus metrics endpoint */
    enabled: boolean
    /** Metrics path (default: /metrics) */
    path?: string
    /** Custom metric prefix */
    prefix?: string
  }
  rateLimiting: {
    /** Enable rate limiting */
    enabled: boolean
    /** Time window in ms */
    windowMs?: number
    /** Max requests per window */
    maxRequests?: number
  }
  plugins: {
    /** Paths to plugin modules */
    paths?: string[]
    /** Plugin configs keyed by plugin name */
    configs?: Record<string, Record<string, unknown>>
  }
  clustering: {
    enabled: boolean
    nodes?: {
      host: string
      port: number
      password?: string
      secure?: boolean
    }[]
  }
}

export interface Route {
  method: HttpMethod
  path: string
  handler: (req: Request, res: Response) => void | Promise<void>
}
