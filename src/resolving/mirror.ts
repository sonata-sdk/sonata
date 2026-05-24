import type { Track } from '../types/index.js'
import { AudioSourceManager } from './manager.js'
import type { MirroredTrack } from './spotify/index.js'

export class MirrorResolver {
  #sourceManager: AudioSourceManager

  constructor(sourceManager: AudioSourceManager) {
    this.#sourceManager = sourceManager
  }

  async resolve(track: Track): Promise<Track | null> {
    if (!this.#needsResolve(track)) return track

    const mirrored = track as unknown as MirroredTrack
    const queries = mirrored.resolveQuery.split(' || ')

    for (const query of queries) {
      try {
        const result = await this.#sourceManager.resolve(query)
        if (result && result.tracks.length > 0) {
          const resolved = result.tracks[0]
          // Preserve original metadata but use resolved audio
          return {
            ...resolved,
            info: {
              ...resolved.info,
              title: track.info.title,
              author: track.info.author,
              uri: track.info.uri,
              artworkUrl: track.info.artworkUrl || resolved.info.artworkUrl,
            },
          }
        }
      } catch { continue }
    }

    return null
  }

  #needsResolve(track: Track): boolean {
    return (track as any).needsResolve === true
  }
}
