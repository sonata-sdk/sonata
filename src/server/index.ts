import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { WebSocketServer } from '@sonata-sdk/ws/server'
import { createLogger, Logger } from '../utils/logger.js'
import type { HttpMethod } from '../types/index.js'

type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, body?: any) => void | Promise<void>

interface RouteEntry {
  method: HttpMethod
  pattern: RegExp
  paramNames: string[]
  handler: Handler
}

export class Server {
  #routes: RouteEntry[] = []
  #server = createServer((req, res) => this.#handle(req, res))
  #wss = new WebSocketServer({ noServer: true })
  #wsPaths = new Map<string, { wss: WebSocketServer; auth: boolean }>()
  #logger: Logger
  #started = Date.now()
  #requestCount = 0
  #password: string
  #noAuthPaths: Set<string> = new Set()
  #preHandlers: ((req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>)[] = []

  constructor(opts: { logger?: Logger; password?: string }) {
    this.#logger = opts.logger ?? createLogger({ level: 'normal' })
    this.#password = opts.password ?? ''
  }

  noAuth(path: string) { this.#noAuthPaths.add(path) }

  get logger() { return this.#logger }
  get wss() { return this.#wss as unknown as WebSocketServer }

  handle(method: HttpMethod, path: string, handler: Handler) {
    const paramNames: string[] = []
    const regexStr = path.replace(/{(\w+)}/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    this.#routes.push({ method, pattern: new RegExp(`^${regexStr}$`), paramNames, handler })
  }

  onPreHandle(fn: (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>) {
    this.#preHandlers.push(fn)
  }

  ws(path: string, opts?: { auth?: boolean }): WebSocketServer {
    this.#wsPaths.set(path, { wss: this.#wss, auth: opts?.auth ?? true })
    return this.#wss
  }

  addWS(path: string, opts?: { auth?: boolean }): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true })
    this.#wsPaths.set(path, { wss, auth: opts?.auth ?? false })
    return wss
  }

  listen(port: number, host: string, cb?: () => void) {
    this.#server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      const wsCfg = this.#wsPaths.get(url.pathname)
      if (wsCfg) {
        const auth = req.headers['authorization']
        if (wsCfg.auth && this.#password && auth !== this.#password) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
          return
        }
        wsCfg.wss.handleUpgrade(req, socket as any, head as Buffer, (ws) => wsCfg.wss.emit('connection', ws, req))
      } else socket.destroy()
    })
    this.#server.listen(port, host, () => {
      this.#logger.info('System', `Server listening on ${host}:${port}`)
      cb?.()
    })
  }

  close() { return new Promise<void>((resolve) => { this.#wss.close(); this.#server.close(() => resolve()) }) }

  stats() { return { uptime: Date.now() - this.#started, requests: this.#requestCount } }

  async #handle(req: IncomingMessage, res: ServerResponse) {
    this.#requestCount++
    const start = Date.now()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Server', 'Sonata/4.0.0')

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

    // Pre-handlers (CORS, IP filter, etc)
    for (const fn of this.#preHandlers) {
      const handled = await fn(req, res)
      if (handled) return
    }

    if (this.#password && !this.#noAuthPaths.has(url.pathname)) {
      const auth = req.headers['authorization']
      if (auth !== this.#password) return this.#json(res, 401, { error: 'Unauthorized' })
    }

    const method = req.method?.toUpperCase() ?? 'GET'

    for (const route of this.#routes) {
      if (route.method !== method) continue
      const match = url.pathname.match(route.pattern)
      if (!match) continue

      const params: Record<string, string> = {}
      for (let i = 0; i < route.paramNames.length; i++) params[route.paramNames[i]] = match[i + 1]

      this.#readBody(req, (body) => {
        Promise.resolve(route.handler(req, res, params, body))
          .catch((err) => { this.#logger.error('http', `request handler error: ${err.message || err}`); this.#json(res, 500, { error: 'Internal Server Error' }) })
          .finally(() => this.#logger.info('http', `${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - start}ms`))
      })
      return
    }

    this.#json(res, 404, { error: 'Not Found' })
  }

  #readBody(req: IncomingMessage, cb: (body: any) => void) {
    const ct = req.headers['content-type'] ?? ''
    if (!ct.includes('application/json') && !ct.includes('text/plain') && !ct.includes('x-www-form-urlencoded')) {
      return cb(undefined)
    }
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString()
      if (!raw) return cb(undefined)
      try { cb(JSON.parse(raw)) }
      catch { cb(raw) }
    })
  }

  #json(res: ServerResponse, status: number, data: unknown) {
    res.statusCode = status
    res.end(JSON.stringify(data))
  }
}
