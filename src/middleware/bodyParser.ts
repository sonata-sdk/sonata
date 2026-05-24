import { IncomingMessage } from 'node:http'

export function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const ct = req.headers['content-type'] || ''
    if (!ct.includes('application/json') && !ct.includes('text/plain')) {
      return resolve(undefined)
    }
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString()
      if (!raw) return resolve(undefined)
      try { resolve(JSON.parse(raw)) }
      catch { resolve(raw) }
    })
    req.on('error', () => resolve(undefined))
  })
}
