<div align="center">
  <img src="assets/logo.svg" width="180" alt="Sonata"/>
  <h1>Sonata</h1>
  <p><strong>Lavalink-compatible audio server</strong> — pure TypeScript, no Java, no yt-dlp</p>
  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#configuration">Configuration</a> •
    <a href="#api">API</a> •
    <a href="#audio-sources">Sources</a>
  </p>
</div>

---

## Features

- **Lavalink v4 + v3 API** — drop-in replacement for any lavaclient
- **12 audio sources** — YouTube, Spotify (mirrored), SoundCloud, Deezer, Apple Music, Bandcamp, Twitch, Vimeo, NicoNico, Mixcloud, Podcast, HTTP direct, local files
- **10 DSP audio filters** — equalizer (15-band), karaoke, timescale (speed/pitch), tremolo, vibrato, rotation (8D), distortion, channel mix, low-pass, volume
- **DAVE/E2EE** — Discord mandatory encryption via `@performanc/voice` + `@snazzah/davey`
- **Opus encoding** — real-time PCM→Opus via opusscript
- **Full queue management** — add, remove, move, swap, shuffle, loop (track/queue/none), history
- **Autoplay** — auto-queue next track when queue ends
- **Session resume** — configurable timeout, survive restarts
- **Plugin system** — register custom event hooks
- **Prometheus metrics** — `/metrics` endpoint (requests, players, memory)
- **Rate limiting** — token bucket with configurable refill/window
- **Track caching** — LRU cache with configurable TTL and max size
- **REST API** — 30+ endpoints covering all Lavalink operations
- **WebSocket events** — real-time track start/end/stuck/exception, player updates
- **HTML Dashboard** — live players, uptime, memory, active sessions
- **Configurable** — 50+ options across 14 sections in `config.js`

---

## Quick Start

```bash
# Install
npm install

# Build
npm run build

# Run
cp config.example.js config.js
node dist/index.js

# With custom path
node dist/index.js /path/to/config.js
```

### Docker

```bash
docker build -t sonata .
docker run -p 2333:2333 \
  -v ./config.js:/app/config.js \
  sonata
```

### Without build (dev)

```bash
# One-shot
npx tsx src/index.ts

# Watch mode (auto-restart on changes)
npm run dev
```

---

## Configuration

Copy `config.example.js` to `config.js` and edit. All options are documented inline. Key sections:

| Section | Options |
|---------|---------|
| `server` | Host, port, password, socket timeout, CORS |
| `logging` | Level (debug/info/warn/error), format (text/json), file path |
| `sources` | Enable/disable each of the 12 audio sources |
| `lavalink` | API version (3/4), session resume timeout |
| `voice` | UDP mode, external address, port range, encryption |
| `player` | Default volume, idle timeout, auto-play, buffer |
| `queue` | Max size, history size |
| `metrics` | Prometheus exporter on/off |
| `rateLimiting` | Requests per window, window ms |
| `plugins` | Plugin paths, npm packages, per-plugin configs |
| `cache` | TTL (ms), max entries |
| `clustering` | Multi-node (not yet implemented) |

---

## Audio Sources

| Source | Method | Playlists | Auth |
|--------|--------|-----------|------|
| YouTube | InnerTube API (5 client profiles) | ✅ via `list=` | None |
| SoundCloud | Public API | ✅ sets | None (auto-discovers client_id) |
| Spotify | Web API + mirrored via YouTube | ✅ albums + playlists | `clientId` + `clientSecret` |
| Deezer | Public Deezer API | ✅ albums + playlists | None |
| Apple Music | iTunes Search API | ❌ | None |
| Bandcamp | HTML scraping | ❌ | None |
| Twitch | HTML scraping | ❌ | None |
| Vimeo | HTML scraping | ❌ | None |
| NicoNico | API + HTML | ❌ | None |
| Mixcloud | API + HTML | ❌ | None |
| Podcast | RSS/XML + iTunes Search | ✅ RSS feeds | None |
| HTTP | Direct file URL | ❌ | None |
| Local | Filesystem path | ❌ | None |

---

## API

### Lavalink v4

| Method | Endpoint |
|--------|----------|
| `GET` | `/v4/info` |
| `GET` | `/v4/stats` |
| `GET/POST/DELETE` | `/v4/sessions`, `/v4/sessions/{id}` |
| `GET` | `/v4/sessions/{id}/players` |
| `GET/PATCH/DELETE` | `/v4/sessions/{id}/players/{guildId}` |
| `POST` | `/v4/sessions/{id}/players/{guildId}/voice` |
| `GET` | `/v4/loadtracks?identifier=` |
| `GET/POST` | `/v4/decodetrack?track=` |
| `POST` | `/v4/decodetracks` |
| `POST/DELETE/PATCH` | `/v4/sessions/{id}/players/{guildId}/queue` |
| `GET` | `/v4/sessions/{id}/players/{guildId}/history` |
| `GET` | `/v4/routeplanner/status` |
| `POST` | `/v4/routeplanner/free/address`, `/v4/routeplanner/free/all` |

Legacy `/v3/*` equivalents also work.

### Non-Lavalink

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (status, uptime, players, sessions, memory) |
| `GET` | `/version` | Version, node info, platform |
| `GET` | `/dashboard` | HTML admin dashboard |
| `GET` | `/metrics` | Prometheus metrics |

### Search prefixes

| Prefix | Source | Example |
|--------|--------|---------|
| URL | YouTube | `https://youtube.com/watch?v=...` |
| URL | SoundCloud | `https://soundcloud.com/user/track` |
| URL | Spotify | `https://open.spotify.com/track/...` |
| text | all | `never gonna give you up` |

---

## Audio Filters

All filters are applied in real-time via the `AudioMixer`:

| Filter | Description |
|--------|-------------|
| **Volume** | Multiplier with 16-bit clamp (0-1000%) |
| **Equalizer** | 15-band graphic EQ (40Hz–16kHz) |
| **Karaoke** | Center channel removal (vocal suppression) |
| **Timescale** | Speed, pitch, and rate independently |
| **Tremolo** | Amplitude modulation (volume oscillation) |
| **Vibrato** | Pitch modulation |
| **Rotation** | 8D stereo pan rotation |
| **Distortion** | Sin/Cos/Tan waveshaping |
| **Channel Mix** | Left/right mixing matrix |
| **Low Pass** | 1-pole low-pass filter |

Set via `PATCH /v4/sessions/{id}/players/{guildId}` with `{ filters: { ... } }`.

---

## Architecture

```
src/
├── index.ts              # Entry point, wires everything
├── config/               # Config.js module loader
├── server/               # HTTP/WS server, router, middleware
├── lavalink/             # REST API v3/v4, WS protocol, sessions
├── player/               # Player state machine, queue, encoder, streamer
├── discord/              # Discord voice (Opus + DAVE/MLS) + gateway
├── audio/                # DSP mixer (10 filters)
├── resolving/            # 12 audio source resolvers
│   ├── youtube/          # InnerTube API (5 client profiles)
│   ├── soundcloud/       # SoundCloud API
│   ├── spotify/          # Spotify Web API + mirror
│   └── ...               # 10 more sources
├── cache/                # LRU track cache
├── dashboard/            # HTML admin UI
├── metrics/              # Prometheus exporter
├── plugin/               # Plugin system
└── types/                # TypeScript type definitions
```

48 source files, ~8K lines of TypeScript.

---

## Plugin System

```typescript
import { pluginManager } from 'sonata'

pluginManager.register({
  name: 'my-plugin',
  version: '1.0.0',
  install(ctx) {
    ctx.onTrackStart((guildId, track) => {
      console.log(`Now playing: ${track.info.title}`)
    })
    ctx.onTrackEnd((guildId, track, reason) => {
      console.log(`Finished: ${reason}`)
    })
  },
})
```

---

## Performance

| Metric | Sonata | Lavalink (Java) |
|--------|--------|-----------------|
| Runtime | Node.js 20+ | JRE 17+ |
| Binary | ~5MB JS | ~100MB JAR |
| RAM (idle) | ~15MB | ~300MB |
| RAM (10 players) | ~30MB | ~500MB |
| Startup | ~200ms | ~10s |
| Dependencies | npm | Maven |

---

## Development

```bash
npm run typecheck   # TypeScript check
npm test            # Run tests
npm run build       # Compile to dist/
npm run dev         # Watch mode
```

---

## License

MIT
