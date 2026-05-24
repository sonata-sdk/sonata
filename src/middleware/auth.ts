import { IncomingMessage, ServerResponse } from 'node:http'

export function authMiddleware(password: string) {
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    if (!password) return true
    const auth = req.headers['authorization']
    if (auth !== password) {
      res.statusCode = 401
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return false
    }
    return true
  }
}
