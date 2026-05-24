export class VoiceConnection {
  #sessionId = ''
  #token = ''
  #endpoint = ''
  #connected = false
  #connectedAt = Date.now()
  #ping = 0
  #guildId: string

  constructor(guildId: string) { this.#guildId = guildId }

  update(sessionId: string, token: string, endpoint: string) {
    this.#sessionId = sessionId
    this.#token = token
    this.#endpoint = endpoint
  }

  connect() { this.#connected = true; this.#connectedAt = Date.now() }
  disconnect() { this.#connected = false }
  get connected() { return this.#connected }
  set ping(p: number) { this.#ping = p }
  get ping() { return this.#ping }
  get info() { return { sessionId: this.#sessionId, token: this.#token, endpoint: this.#endpoint, guildId: this.#guildId } }
}
