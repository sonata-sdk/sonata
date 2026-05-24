import type { ServerResponse } from 'node:http'

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
  'Access-Control-Max-Age': '86400',
}

export function corsHandler(req: { method?: string }, res: ServerResponse): boolean {
  if (req.method === 'OPTIONS') {
    for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v)
    res.statusCode = 204
    res.end()
    return true
  }
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v)
  return false
}
