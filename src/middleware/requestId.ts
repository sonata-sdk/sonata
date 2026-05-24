import { randomUUID } from 'node:crypto'
import { IncomingMessage, ServerResponse } from 'node:http'

export function requestIdMiddleware(req: IncomingMessage, res: ServerResponse) {
  const id = req.headers['x-request-id'] as string || randomUUID()
  req.headers['x-request-id'] = id
  res.setHeader('X-Request-Id', id)
  return false
}
