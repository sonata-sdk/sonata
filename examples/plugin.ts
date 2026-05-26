import { register } from '@sonata-sdk/plugin-sdk'

export default register({
  name: 'example-plugin',
  version: '1.0.0',

  install(ctx) {
    ctx.log('info', 'Example plugin loaded!')

    ctx.onTrackStart((guildId, track) => {
      ctx.log('info', `Now playing: ${track.info.title} in guild ${guildId}`)
    })

    ctx.onTrackEnd((guildId, track, reason) => {
      ctx.log('debug', `Track ended: ${track.info.title} reason=${reason}`)
    })

    ctx.onPlayerUpdate((guildId, state) => {
      if (state.track && !state.paused) {
        const pos = Math.floor(state.position / 1000)
        const dur = Math.floor((state.track.info.duration ?? 0) / 1000)
        ctx.log('trace', `[${guildId}] ${pos}s / ${dur}s vol=${state.volume}`)
      }
    })

    ctx.registerRoute('GET', '/example-plugin/status', (req, res) => {
      res.end(JSON.stringify({ status: 'ok', name: 'example-plugin' }))
    })
  },
})
