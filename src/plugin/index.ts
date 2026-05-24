import type { Plugin, PluginContext, Track, TrackEndHandler, TrackEventHandler } from '../types/index.js'

class PluginManager {
  #plugins: Plugin[] = []
  #trackStartHandlers: TrackEventHandler[] = []
  #trackEndHandlers: TrackEndHandler[] = []

  register(plugin: Plugin) {
    const ctx: PluginContext = {
      config: {},
      onTrackStart: (handler) => this.#trackStartHandlers.push(handler),
      onTrackEnd: (handler) => this.#trackEndHandlers.push(handler),
    }
    plugin.install(ctx)
    this.#plugins.push(plugin)
  }

  get all() { return [...this.#plugins] }

  emitTrackStart(guildId: string, track: Track) {
    for (const h of this.#trackStartHandlers) h(guildId, track)
  }

  emitTrackEnd(guildId: string, track: Track, reason: string) {
    for (const h of this.#trackEndHandlers) h(guildId, track, reason)
  }
}

export const pluginManager = new PluginManager()
