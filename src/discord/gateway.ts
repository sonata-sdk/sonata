import WebSocket from 'ws'

interface GatewayEvent {
  op: number
  d: any
  s: number | null
  t: string | null
}

export class DiscordGateway extends EventTarget {
  #token: string
  #intents: number
  #ws: WebSocket | null = null
  #sessionId = ''
  #sequence = 0
  #heartbeatInterval = 0
  #heartbeatTimer: ReturnType<typeof setInterval> | null = null
  #resumeUrl = 'wss://gateway.discord.gg'
  #connected = false

  constructor(token: string, intents: number) {
    super()
    this.#token = token
    this.#intents = intents
  }

  get sessionId() { return this.#sessionId }
  get connected() { return this.#connected }

  connect() {
    this.#ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json')

    this.#ws.on('open', () => {
      this.#connected = true
    })

    this.#ws.on('message', (data) => {
      const evt: GatewayEvent = JSON.parse(data.toString())
      this.#handle(evt)
    })

    this.#ws.on('close', (code) => {
      this.#connected = false
      if (this.#heartbeatTimer) clearInterval(this.#heartbeatTimer)
      this.dispatchEvent(new CustomEvent('close', { detail: { code } }))
      setTimeout(() => this.connect(), 5000)
    })

    this.#ws.on('error', (err) => {
      this.dispatchEvent(new CustomEvent('error', { detail: err }))
    })
  }

  close() {
    if (this.#heartbeatTimer) clearInterval(this.#heartbeatTimer)
    this.#ws?.close(1000)
    this.#ws = null
    this.#connected = false
  }

  voiceStateUpdate(guildId: string, channelId: string | null) {
    this.#send(4, { guild_id: guildId, channel_id: channelId, self_mute: false, self_deaf: false })
  }

  #handle(evt: GatewayEvent) {
    if (evt.s) this.#sequence = evt.s

    switch (evt.op) {
      case 0: // Dispatch
        if (evt.t === 'READY') {
          this.#sessionId = evt.d.session_id
          this.#resumeUrl = evt.d.resume_gateway_url
        }
        this.dispatchEvent(new CustomEvent(evt.t ?? 'unknown', { detail: evt.d }))
        break
      case 10: // Hello
        this.#heartbeatInterval = evt.d.heartbeat_interval
        this.#identify()
        this.#startHeartbeat()
        break
      case 7: // Reconnect
        this.#reconnect()
        break
      case 9: // Invalid Session
        this.#sequence = 0
        this.#identify()
        break
    }
  }

  #identify() {
    this.#send(2, {
      token: this.#token,
      intents: this.#intents,
      properties: { os: 'linux', browser: 'sonata', device: 'sonata' },
    })
  }

  #send(op: number, d: any) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify({ op, d }))
    }
  }

  #startHeartbeat() {
    this.#heartbeatTimer = setInterval(() => {
      this.#send(1, this.#sequence)
    }, this.#heartbeatInterval)
  }

  #reconnect() {
    this.#ws?.close(4000)
    setTimeout(() => this.connect(), 2000)
  }
}
