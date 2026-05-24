import { IncomingMessage, ServerResponse } from 'node:http'

const BLOCKED = [
  'curl/7', 'wget/', 'python-requests', 'Go-http-client',
  'scrapy', 'bot', 'crawler', 'scanner',
]

export function userAgentBlocklist(blocked: string[] = BLOCKED) {
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const ua = (req.headers['user-agent'] || '').toLowerCase()
    for (const b of blocked) {
      if (ua.includes(b.toLowerCase())) {
        res.statusCode = 403
        res.end(JSON.stringify({ error: 'User-Agent blocked' }))
        return true
      }
    }
    return false
  }
}
