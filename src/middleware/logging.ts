import { IncomingMessage, ServerResponse } from 'node:http'

export function loggingMiddleware(req: IncomingMessage, res: ServerResponse, start: number) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const ms = Date.now() - start
  console.log(`${req.method} ${url.pathname} ${res.statusCode} ${ms}ms`)
}
