import { accessSync, constants } from 'node:fs'
import { resolve } from 'node:path'
import type { Track } from '../../types/index.js'
import type { AudioSource } from '../manager.js'

const AUDIO_EXTS = ['.mp3', '.ogg', '.wav', '.flac', '.m4a', '.aac', '.opus', '.wma']

export class LocalSource implements AudioSource {
  name = 'local'

  matches(url: string): boolean {
    return url.startsWith('file://') || url.startsWith('/')
  }

  async resolve(query: string): Promise<Track[]> {
    const filePath = query.replace(/^file:\/\//, '')
    const abs = resolve(filePath)
    try {
      accessSync(abs, constants.R_OK)
      const name = abs.split('/').pop() ?? 'Unknown'
      return [{
        encoded: Buffer.from(abs).toString('base64url'),
        info: {
          identifier: abs,
          title: name,
          author: 'Local',
          duration: 0,
          uri: `file://${abs}`,
          artworkUrl: '',
          sourceName: 'local',
          isStream: false,
          position: 0,
        },
        source: 'local',
      }]
    } catch {
      return []
    }
  }

  async resolveTrack(identifier: string): Promise<Track | null> {
    const path = Buffer.from(identifier, 'base64url').toString()
    return (await this.resolve(path))[0] ?? null
  }
}
