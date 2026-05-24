import { WebSocket } from 'ws'
import { PlayerManager } from '../player/manager.js'
import { State } from '../player/player.js'

export function createDashboardWS(pm: PlayerManager) {
  return (ws: WebSocket) => {
    const sendState = () => {
      if (ws.readyState !== WebSocket.OPEN) return
      const players = pm.all().map(p => ({
        guildId: p.guildId,
        track: p.track ? {
          title: p.track.info.title,
          author: p.track.info.author,
          duration: p.track.info.duration,
          position: p.position,
        } : null,
        state: p.state === State.Playing ? 'playing' : p.state === State.Paused ? 'paused' : 'stopped',
        volume: p.volume,
        queueLength: p.queue.length,
      }))
      ws.send(JSON.stringify({
        type: 'state',
        players,
        memory: process.memoryUsage().rss,
        uptime: process.uptime(),
      }))
    }

    sendState()
    const interval = setInterval(sendState, 2000)
    ws.on('close', () => clearInterval(interval))
    ws.on('error', () => clearInterval(interval))
  }
}
