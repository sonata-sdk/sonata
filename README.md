# Sonata

High-performance Lavalink-compatible audio server for Discord bots. Written in TypeScript.

## Features

- **Lavalink v4 + v3 API** — drop-in replacement for existing Lavalink setups
- **WebSocket** — real-time events (track start/end, player updates)
- **YouTube, SoundCloud, Spotify** — audio resolvers via yt-dlp
- **Player management** — play, pause, seek, volume, filters, equalizer
- **Queue system** — shuffle, loop (track/queue), remove, clear
- **Discord Gateway** — voice state updates, reconnect handling
- **Plugin system** — extend with custom hooks
- **Metrics** — Prometheus endpoint (`/metrics`)
- **Rate limiting** — per-token/ip request limiting
- **Structured logging** — text or JSON format
- **Docker** — multi-stage build with ffmpeg + yt-dlp
- **Config file** — JSON config + environment overrides
- **Single process** — no JVM, no runtime dependencies

## Quick Start

```bash
# Install dependencies
npm install

# Run
npm start -- sonata.json
```

Or with Docker:

```bash
docker build -t sonata .
docker run -p 2333:2333 sonata
```

## Configuration

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 2333,
    "password": "youshallnotpass"
  },
  "logging": { "level": "info", "format": "text" },
  "sources": { "youtube": true, "soundcloud": false, "spotify": false },
  "lavalink": { "version": 4 }
}
```

Environment variables: `SONATA_HOST`, `SONATA_PORT`, `SONATA_PASSWORD`, `SONATA_LOG_LEVEL`.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/loadtracks?identifier=` | Search/load tracks |
| `GET` | `/decodetrack?track=` | Decode track |
| `POST` | `/v4/sessions` | Create session |
| `PATCH` | `/v4/sessions/{id}` | Update session |
| `DELETE` | `/v4/sessions/{id}` | Destroy session |
| `GET` | `/v4/sessions/{id}/players` | List players |
| `GET` | `/v4/sessions/{id}/players/{guildId}` | Get player |
| `PATCH` | `/v4/sessions/{id}/players/{guildId}` | Control playback |
| `DELETE` | `/v4/sessions/{id}/players/{guildId}` | Destroy player |
| `POST` | `/v4/sessions/{id}/players/{guildId}/voice` | Voice update |
| `GET` | `/v4/stats` | Server stats |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/health` | Health check |

## Project Structure

```
src/
├── config/       # Configuration loader
├── server/       # HTTP + WebSocket server
├── lavalink/     # REST API + WS events
├── player/       # Player, queue, voice
├── discord/      # Gateway + Voice UDP
├── resolving/    # Audio resolvers
├── audio/        # Mixer + filters
├── plugin/       # Plugin system
├── metrics/      # Prometheus
├── middleware/   # Auth, rate limit
└── types/        # Shared types
```

## License

MIT
