import { IncomingMessage } from 'node:http'

export function ipWhitelist(allowed: string[]) {
  if (!allowed?.length) return (_req: IncomingMessage): boolean => true
  const set = new Set(allowed)
  return (req: IncomingMessage): boolean => {
    const ip = req.socket.remoteAddress ?? ''
    return set.has(ip) || set.has(ip.replace(/^::ffff:/, ''))
  }
}

export function ipBlacklist(blocked: string[]) {
  if (!blocked?.length) return (_req: IncomingMessage): boolean => true
  const set = new Set(blocked)
  return (req: IncomingMessage): boolean => {
    const ip = req.socket.remoteAddress ?? ''
    return !set.has(ip) && !set.has(ip.replace(/^::ffff:/, ''))
  }
}
