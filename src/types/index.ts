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
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'text' | 'json'
  }
  sources: {
    youtube: boolean
    soundcloud: boolean
    spotify: boolean
  }
  clustering: {
    enabled: boolean
    nodes: string[]
  }
  lavalink: {
    version: 3 | 4
  }
}

export interface Route {
  method: HttpMethod
  path: string
  handler: (req: Request, res: Response) => void | Promise<void>
}
