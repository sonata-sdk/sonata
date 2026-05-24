import { IncomingMessage, ServerResponse } from 'node:http'
import type { Logger } from '../utils/logger.js'

export function loggingMiddleware(req: IncomingMessage, res: ServerResponse, start: number, logger?: Logger) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const ms = Date.now() - start
  logger?.debug('http', `${req.method} ${url.pathname} ${res.statusCode} ${ms}ms`)
}
