import { VERSION, NAME } from '../version.js'

const SPINNERS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function showBanner(cfg: any) {
  const banner = `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   ███████╗ ██████╗ ███╗   ██╗ █████╗ ████████╗ █████╗          ║
║   ██╔════╝██╔═══██╗████╗  ██║██╔══██╗╚══██╔══╝██╔══██╗         ║
║   ███████╗██║   ██║██╔██╗ ██║███████║   ██║   ███████║         ║
║   ╚════██║██║   ██║██║╚██╗██║██╔══██║   ██║   ██╔══██║         ║
║   ███████║╚██████╔╝██║ ╚████║██║  ██║   ██║   ██║  ██║         ║
║   ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝         ║
║                                                                  ║
║   ${NAME} v${VERSION} - Lavalink-compatible audio server              ║
║   Node.js ${process.version} | ${process.platform}                          ║
╚══════════════════════════════════════════════════════════════════╝
`
  console.log(banner)
}

let spinnerTimer: ReturnType<typeof setInterval> | null = null
let spinnerFrame = 0
let spinnerMessage = ''

export function startSpinner(msg: string) {
  spinnerMessage = msg
  spinnerFrame = 0
  if (spinnerTimer) clearInterval(spinnerTimer)
  process.stdout.write('\x1B[?25l')
  spinnerTimer = setInterval(() => {
    process.stdout.write(`\r${SPINNERS[spinnerFrame]} ${spinnerMessage}`)
    spinnerFrame = (spinnerFrame + 1) % SPINNERS.length
  }, 80)
}

export function stopSpinner(msg?: string) {
  if (spinnerTimer) {
    clearInterval(spinnerTimer)
    spinnerTimer = null
  }
  process.stdout.write('\r\x1B[?25h')
  if (msg) console.log(msg)
}

export function formatTrackProgress(current: number, duration: number): string {
  if (duration <= 0) return 'LIVE'
  const curSec = Math.floor(current / 1000)
  const durSec = Math.floor(duration / 1000)
  const curMin = Math.floor(curSec / 60)
  const curS = curSec % 60
  const durMin = Math.floor(durSec / 60)
  const durS = durSec % 60
  const progress = duration > 0 ? Math.min(1, current / duration) : 0
  const barLen = 20
  const filled = Math.round(progress * barLen)
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled)
  return `${bar} ${String(curMin).padStart(2, '0')}:${String(curS).padStart(2, '0')} / ${String(durMin).padStart(2, '0')}:${String(durS).padStart(2, '0')}`
}
