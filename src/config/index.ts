import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Config } from '../types/index.js'

const DEFAULTS: Config = {
  server: {
    host: '0.0.0.0',
    port: 2333,
    password: 'youshallnotpass',
    maxBodySize: 1_048_576,
    socketTimeout: 30_000,
    trustProxy: false,
  },
  logging: {
    level: 'info',
    format: 'text',
    colorize: true,
    excludePaths: ['/health', '/metrics'],
  },
  sources: {
    youtube: { enabled: true, clientProfiles: ['WEB', 'MUSIC', 'ANDROID', 'IOS', 'TV'] },
    soundcloud: { enabled: true, clientId: '' },
    spotify: { enabled: false, clientId: '', clientSecret: '', market: 'US' },
    http: false,
    local: false,
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
  },
  metrics: {
    enabled: true,
    path: '/metrics',
    prefix: 'sonata',
  },
  rateLimiting: {
    enabled: false,
    windowMs: 60_000,
    maxRequests: 100,
  },
  plugins: {
    paths: [],
    configs: {},
  },
  clustering: {
    enabled: false,
    nodes: [],
  },
}

export async function loadConfig(path?: string): Promise<Config> {
  const cfg = structuredClone(DEFAULTS) as Config

  const configPath = path ?? resolve(process.cwd(), 'config.js')

  if (existsSync(configPath)) {
    const url = pathToFileURL(configPath).href
    const mod = await import(url)
    const userConfig = mod.default ?? mod
    deepMerge(cfg, userConfig)
  }

  return cfg
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] === undefined) continue
    if (isObject(source[key]) && isObject(target[key])) {
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
}
