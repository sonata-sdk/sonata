import { execSync } from 'node:child_process'
import { VERSION, NAME } from '../version.js'
import type { Logger } from './logger.js'

let _gitInfo: { branch: string; commit: string; date: string } | null = null

export function getGitInfo() {
  if (_gitInfo) return _gitInfo
  try {
    _gitInfo = {
      branch: execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf-8' }).trim(),
      commit: execSync('git rev-parse --short HEAD 2>/dev/null', { encoding: 'utf-8' }).trim(),
      date: execSync('git log -1 --format=%cI 2>/dev/null', { encoding: 'utf-8' }).trim(),
    }
  } catch {
    _gitInfo = { branch: 'unknown', commit: 'unknown', date: '' }
  }
  return _gitInfo
}

export function logStartupBanner(logger?: Logger) {
  const git = getGitInfo()
  logger?.info('system', `Starting ${NAME} v${VERSION}`)
  logger?.info('system', `Runtime: ${process.version} on ${process.platform} (${process.arch})`)
  logger?.info('system', `Git branch: ${git.branch}, commit: ${git.commit}${git.date ? `, committed: ${git.date}` : ''}`)
}

const SOURCE_ICONS: Record<string, string> = {
  youtube: '▶️',
  soundcloud: '☁️',
  spotify: '🎧',
  bandcamp: '💿',
  twitch: '📺',
  vimeo: '🎬',
  deezer: '🎵',
  apple: '🍎',
  nico: '📹',
  mixcloud: '🌧️',
  podcast: '🎤',
  jiosaavn: '🎼',
  http: '🌐',
  local: '💾',
  tiktok: '🎶',
}

export function logStartup(cfg: any, pluginCount: number, logger?: Logger) {
  const features: string[] = [
    cfg.cache?.enabled && 'cache',
    cfg.server.cors && 'cors',
    cfg.server.dashboard && 'dashboard',
    cfg.player?.autoPlay && 'autoplay',
  ].filter(Boolean) as string[]

  const sources = Object.entries(cfg.sources)
    .filter(([k]) => !['priority', 'requestTimeout'].includes(k))
    .map(([name, src]: [string, any]) => {
      const enabled = typeof src === 'object' ? src.enabled : src
      const iconName = SOURCE_ICONS[name] || 'question'
      const icon = enabled ? iconName : '🔴'
      return ` ${icon} ${name}`
    })

  logger?.info('startup', `\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`)
  logger?.info('startup', `\u2502 ${NAME} v${VERSION}${' '.repeat(Math.max(0, 40 - VERSION.length - NAME.length - 4))} \u2502`)
  logger?.info('startup', `\u2502 Host: ${cfg.server.host}:${cfg.server.port}                        \u2502`)
  logger?.info('startup', `\u2502 Node: ${process.version} (${process.platform})                    \u2502`)
  logger?.info('startup', `\u2502 Lavalink: v${cfg.lavalink.apiVersion}                                   \u2502`)
  if (pluginCount > 0) {
    logger?.info('startup', `\u2502 Plugins: ${pluginCount} loaded                                      \u2502`)
  }
  logger?.info('startup', `\u2502 Features: ${features.join(', ')}${' '.repeat(Math.max(0, 41 - features.join(', ').length - 10))} \u2502`)
  logger?.info('startup', `\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524`)

  for (const line of sources) {
    logger?.info('startup', `\u2502${line}${' '.repeat(48 - line.length)} \u2502`)
  }

  logger?.info('startup', `\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`)
}

export function logMemory(logger?: Logger) {
  const mem = process.memoryUsage()
  logger?.debug('memory', `rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB ext=${(mem.external / 1024 / 1024).toFixed(1)}MB`)
}

export function logPlayerAction(guildId: string, action: string, detail?: string, logger?: Logger) {
  const msg = `${guildId} ${action}${detail ? ` (${detail})` : ''}`
  logger?.info('player', msg)
}
