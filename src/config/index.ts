import { readFileSync, existsSync } from 'node:fs'
import type { Config } from '../types/index.js'

const DEFAULTS: Config = {
  server: { host: '0.0.0.0', port: 2333, password: '' },
  logging: { level: 'info', format: 'text' },
  sources: { youtube: true, soundcloud: false, spotify: false },
  clustering: { enabled: false, nodes: [] },
  lavalink: { version: 4 },
}

export function loadConfig(path?: string): Config {
  const cfg = structuredClone(DEFAULTS)

  if (path && existsSync(path)) {
    const data = readFileSync(path, 'utf-8')
    const user = JSON.parse(data)
    deepMerge(cfg, user)
  }

  if (process.env.SONATA_HOST) cfg.server.host = process.env.SONATA_HOST
  if (process.env.SONATA_PORT) cfg.server.port = Number(process.env.SONATA_PORT)
  if (process.env.SONATA_PASSWORD) cfg.server.password = process.env.SONATA_PASSWORD
  if (process.env.SONATA_LOG_LEVEL) cfg.logging.level = process.env.SONATA_LOG_LEVEL as Config['logging']['level']

  return cfg
}

function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
}
