const CLIENT_ID = '861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com'
const CLIENT_SECRET = 'SboVhoG9s0rNafixCSGGKXAT'
const SCOPES = 'https://www.googleapis.com/auth/youtube'

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_url: string
  interval: number
  error?: string
  error_description?: string
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

export async function acquireYouTubeRefreshToken(): Promise<string> {
  const deviceRes = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPES }),
  })

  if (!deviceRes.ok) {
    const text = await deviceRes.text()
    throw new Error(`Device code request failed: ${deviceRes.status} - ${text.slice(0, 200)}`)
  }

  const deviceData = (await deviceRes.json()) as DeviceCodeResponse

  if (deviceData.error) {
    throw new Error(`Device code error: ${deviceData.error_description || deviceData.error}`)
  }

  console.log('')
  console.log('==================================================================')
  console.log('\x1b[1m\x1b[31mALERT: DO NOT USE YOUR MAIN GOOGLE ACCOUNT! USE A SECONDARY OR BURNER ACCOUNT ONLY!\x1b[0m')
  console.log('')
  console.log('To authorize, visit the following URL in your browser:')
  console.log(`\x1b[1m\x1b[32m${deviceData.verification_url}\x1b[0m`)
  console.log('')
  console.log('And enter the code:')
  console.log(`\x1b[1m\x1b[37m${deviceData.user_code}\x1b[0m`)
  console.log('==================================================================')
  console.log('')

  const interval = (deviceData.interval || 5) * 1000
  let refreshToken: string | null = null

  while (!refreshToken) {
    await new Promise(resolve => setTimeout(resolve, interval))

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        device_code: deviceData.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    })

    const tokenData = (await tokenRes.json()) as TokenResponse

    if (tokenData.error === 'authorization_pending') {
      continue
    }

    if (!tokenRes.ok || tokenData.error) {
      throw new Error(`Token error: ${tokenData.error_description || tokenData.error || tokenRes.status}`)
    }

    if (tokenData.refresh_token) {
      refreshToken = tokenData.refresh_token
    }
  }

  console.log('')
  console.log('==================================================================')
  console.log('\x1b[1m\x1b[32mAuthorization granted successfully!\x1b[0m')
  console.log('==================================================================')
  console.log('')
  console.log('Copy your Refresh Token and paste it in your config.js:')
  console.log(`\x1b[1m\x1b[37m${refreshToken}\x1b[0m`)
  console.log('')
  console.log('Example config:')
  console.log(JSON.stringify({
    sources: {
      youtube: {
        clients: {
          settings: {
            TV: {
              refreshToken: [refreshToken],
            },
          },
        },
      },
    },
  }, null, 2))
  console.log('')
  console.log('==================================================================')
  console.log('\x1b[1m\x1b[31mIMPORTANT:\x1b[0m')
  console.log('After pasting the token, set \x1b[33mgetOAuthToken\x1b[0m to \x1b[31mfalse\x1b[0m')
  console.log('otherwise the server will keep trying to obtain a new token on every restart.')
  console.log('==================================================================')
  console.log('')

  return refreshToken
}

export async function getOAuthAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) return null
  const data = (await res.json()) as TokenResponse
  return data.access_token ?? null
}
