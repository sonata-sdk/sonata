import { createSocket, Socket } from 'node:dgram'

export class DiscordVoice {
  #socket: Socket | null = null
  #endpoint = ''
  #port = 0
  #ssrc = 0
  #connected = false

  connect(endpoint: string, port: number, ssrc: number) {
    this.#endpoint = endpoint
    this.#port = port
    this.#ssrc = ssrc
    this.#socket = createSocket('udp4')

    this.#socket.on('error', (err) => {
      console.error('Voice UDP error:', err)
      this.#connected = false
    })

    this.#socket.on('message', (msg) => {
      // Handle IP discovery response
      if (msg.length === 74) {
        const ip = msg.slice(8, 72).toString().replace(/\0/g, '')
        console.log(`Voice IP discovered: ${ip}`)
        this.#connected = true
      }
    })

    this.#socket.send(this.#createIpDiscovery(), port, endpoint)
  }

  close() {
    this.#socket?.close()
    this.#socket = null
    this.#connected = false
  }

  get connected() { return this.#connected }

  #createIpDiscovery(): Buffer {
    const packet = Buffer.alloc(74)
    packet.writeUInt16BE(0x1, 0) // Type
    packet.writeUInt16BE(70, 2) // Length
    packet.writeUInt32BE(this.#ssrc, 4) // SSRC
    return packet
  }
}
