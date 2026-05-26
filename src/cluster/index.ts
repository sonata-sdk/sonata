import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import type { Logger } from '../utils/logger.js'

interface ClusterNode {
  id: string
  host: string
  port: number
  load: number
  players: number
  lastSeen: number
}

export class ClusterManager {
  #nodes: Map<string, ClusterNode> = new Map()
  #thisNode: ClusterNode
  #strategy: 'manual' | 'lowestLoad' | 'roundRobin' | 'hash'
  #heartbeatInterval: number
  #heartbeatTimeout: number
  #logger: Logger | null
  #server: any = null
  #rrIndex = 0

  constructor(opts: { nodeId: string; host: string; port: number; strategy?: string; heartbeatInterval?: number; heartbeatTimeout?: number; logger?: Logger | null }) {
    this.#thisNode = { id: opts.nodeId, host: opts.host, port: opts.port, load: 0, players: 0, lastSeen: Date.now() }
    this.#strategy = (opts.strategy as any) ?? 'lowestLoad'
    this.#heartbeatInterval = opts.heartbeatInterval ?? 10_000
    this.#heartbeatTimeout = opts.heartbeatTimeout ?? 30_000
    this.#logger = opts.logger ?? null
  }

  get id() { return this.#thisNode.id }
  get nodes() { return [...this.#nodes.values()] }
  get thisNode() { return this.#thisNode }

  register(node: ClusterNode) {
    node.lastSeen = Date.now()
    this.#nodes.set(node.id, node)
    this.#logger?.info('Cluster', `Node registered: ${node.id} @ ${node.host}:${node.port}`)
  }

  unregister(id: string) {
    this.#nodes.delete(id)
    this.#logger?.info('Cluster', `Node unregistered: ${id}`)
  }

  update(id: string, data: Partial<ClusterNode>) {
    const node = this.#nodes.get(id)
    if (node) {
      Object.assign(node, data, { lastSeen: Date.now() })
    }
  }

  select(guildId?: string): ClusterNode | null {
    const alive = this.nodes.filter(n => Date.now() - n.lastSeen < this.#heartbeatTimeout)
    if (alive.length === 0) return null

    switch (this.#strategy) {
      case 'lowestLoad':
        return alive.reduce((a, b) => (a.load + a.players / 100) < (b.load + b.players / 100) ? a : b)
      case 'roundRobin':
        return alive[this.#rrIndex++ % alive.length]
      case 'hash':
        if (!guildId) return alive[0]
        return alive[guildId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % alive.length]
      default:
        return alive[0]
    }
  }

  heartbeat(players: number, load: number) {
    this.#thisNode.players = players
    this.#thisNode.load = load
    this.#thisNode.lastSeen = Date.now()
  }

  startSync(playersFn: () => number) {
    setInterval(() => {
      this.heartbeat(playersFn(), 0)
      this.#cleanupStale()
    }, this.#heartbeatInterval)
  }

  #cleanupStale() {
    const now = Date.now()
    for (const [id, node] of this.#nodes) {
      if (now - node.lastSeen > this.#heartbeatTimeout) {
        this.#logger?.warn('Cluster', `Node timed out: ${id}`)
        this.#nodes.delete(id)
      }
    }
  }

  listen(port: number, host: string) {
    this.#server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.end(JSON.stringify({ id: this.#thisNode.id, players: this.#thisNode.players, load: this.#thisNode.load }))
        return
      }
      res.statusCode = 404
      res.end()
    })
    this.#server.listen(port, host, () => {
      this.#logger?.info('Cluster', `Cluster sync listening on ${host}:${port}`)
    })
  }

  close() {
    this.#server?.close()
  }
}
