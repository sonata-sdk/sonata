import { createHmac } from 'node:crypto'
import type { Logger } from '../utils/logger.js'

interface WebhookConfig {
  url: string
  secret?: string
  events?: string[]
  retries?: number
  retryDelay?: number
}

interface WebhookPayload {
  event: string
  guildId: string
  timestamp: string
  data: any
}

export class WebhookManager {
  #webhooks: WebhookConfig[] = []
  #logger: Logger | null

  constructor(configs: WebhookConfig[] = [], logger?: Logger | null) {
    this.#webhooks = configs
    this.#logger = logger ?? null
  }

  add(config: WebhookConfig) {
    this.#webhooks.push(config)
    this.#logger?.info('Webhooks', `Added webhook: ${config.url}`)
  }

  remove(url: string) {
    this.#webhooks = this.#webhooks.filter(w => w.url !== url)
  }

  async send(event: string, guildId: string, data: any) {
    const payload: WebhookPayload = { event, guildId, timestamp: new Date().toISOString(), data }
    const body = JSON.stringify(payload)

    for (const wh of this.#webhooks) {
      if (wh.events?.length && !wh.events.includes(event)) continue

      const maxRetries = wh.retries ?? 3
      const retryDelay = wh.retryDelay ?? 1000

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Sonata/4.0.0',
          }

          if (wh.secret) {
            const sig = createHmac('sha256', wh.secret).update(body).digest('hex')
            headers['X-Sonata-Signature'] = sig
            headers['X-Sonata-Timestamp'] = payload.timestamp
          }

          const res = await fetch(wh.url, { method: 'POST', headers, body })

          if (res.ok) {
            this.#logger?.debug('Webhooks', `Sent ${event} to ${wh.url}`)
            break
          }

          this.#logger?.warn('Webhooks', `Webhook ${wh.url} returned ${res.status} (attempt ${attempt + 1})`)
        } catch (err: any) {
          this.#logger?.warn('Webhooks', `Webhook ${wh.url} failed: ${err.message} (attempt ${attempt + 1})`)
        }

        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)))
        }
      }
    }
  }
}
