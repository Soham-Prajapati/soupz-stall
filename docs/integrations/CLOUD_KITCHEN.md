# ☁️ Soupz Cloud Kitchen — Remote Access Server

The Cloud Kitchen is an Express + WebSocket server that enables remote access to your Soupz Stall from mobile devices and browser extensions. It auto-starts silently when you run `soupz-stall`.

---

## How It Works

```
┌────────────────────────────────────────────────────────────┐
│                    Your Laptop                              │
│                                                            │
│  ┌──────────┐    auto-starts    ┌───────────────────┐     │
│  │soupz-stall│ ──────────────► │  Cloud Kitchen    │     │
│  │  (CLI)    │                  │  Express + WSS    │     │
│  └──────────┘                  │  Port 7533        │     │
│                                 │                   │     │
│                                 │  OTP Auth         │     │
│                                 │  Terminal Spawn   │     │
│                                 │  Health Monitor   │     │
│                                 │  Screenshot Relay │     │
│                                 └─────┬─────────────┘     │
└───────────────────────────────────────┼────────────────────┘
                                        │  WebSocket
                            ┌───────────┼───────────┐
                            │           │           │
                     ┌──────┴───┐ ┌─────┴────┐ ┌───┴──────┐
                     │ Mobile   │ │ Browser  │ │ Other    │
                     │ IDE App  │ │Extension │ │ Clients  │
                     └──────────┘ └──────────┘ └──────────┘
```

## Auto-Start (Embedded Mode)

When you run `soupz-stall`, the Cloud Kitchen starts automatically in the background:

- **No extra terminal needed** — runs in the same process
- **No startup logs** — completely silent (silentMode = true)
- **On-demand OTP** — type `/cloud-kitchen` to see the pairing code
- **Graceful shutdown** — stops when you `/quit` the stall

## Manual Start (Standalone)

```bash
cd packages/remote-server
npm install
npm start
```

This shows the full banner with connection details.

## OTP Pairing System

Modeled after iCloud Keychain's pairing UX:

1. **Server generates** an 9-character alphanumeric alphanumeric code (charset: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no ambiguous chars like 0/O, 1/I)
2. **User enters code** in mobile app or browser extension
3. **Client validates** via `POST /pair/validate` with the code
4. **Server returns** a 64-char hex session token
5. **Client connects** WebSocket and sends `{ type: 'auth', token }` 
6. **Server validates** token on every message

### Auto-Refresh
- Codes auto-refresh every **5 minutes**
- Expired codes are automatically cleaned up
- Each code is **one-time use** (deleted after validation)
- `/cloud-kitchen` shows the current code with time remaining

## REST API

### `GET /health`
Returns system health data:
```json
{
  "status": "ok",
  "uptime": 3600,
  "memory": {
    "total": 8589934592,
    "used": 7516192768,
    "free": 1073741824,
    "percent": 87,
    "totalFormatted": "8.0 GB",
    "usedFormatted": "7.0 GB",
    "freeFormatted": "1.0 GB"
  },
  "swap": {
    "total": 12884901888,
    "used": 11609055232,
    "free": 1275846656,
    "percent": 90,
    "totalFormatted": "12.0 GB",
    "usedFormatted": "10.8 GB",
    "freeFormatted": "1.2 GB"
  },
  "disk": {
    "total": 494384795648,
    "used": 469165555712,
    "free": 25219239936,
    "percent": 95,
    "totalFormatted": "460.5 GB",
    "usedFormatted": "437.0 GB",
    "freeFormatted": "23.5 GB"
  },
  "cpu": { "count": 8, "model": "Apple M1" },
  "platform": "darwin",
  "nodeVersion": "v25.8.0",
  "hostname": "MacBook-Air"
}
```

### `POST /pair/validate`
Validates a pairing code and returns a session token.
```json
// Request
{ "code": "ABC12DEF" }
// Response (200)
{ "token": "a1b2c3...64chars", "expiresIn": 86400 }
// Response (401)
{ "error": "Invalid or expired pairing code" }
```

## WebSocket Protocol

All messages are JSON with a `type` field.

### Client → Server

| Type | Fields | Description |
|------|--------|-------------|
| `auth` | `token`, `clientType` | Authenticate with session token |
| `create_terminal` | — | Spawn a new pty terminal |
| `input` | `terminalId`, `data` | Send keystrokes to terminal |
| `resize` | `terminalId`, `cols`, `rows` | Resize terminal |
| `kill_terminal` | `terminalId` | Kill a terminal |
| `logout` | — | End session |
| `ping` | — | Latency measurement |

### Server → Client

| Type | Fields | Description |
|------|--------|-------------|
| `auth_success` | `hostname`, `health` | Auth successful |
| `auth_failed` | `message` | Auth failed |
| `terminal_created` | `terminalId`, `pid` | Terminal spawned |
| `output` | `terminalId`, `data` | Terminal output |
| `history` | `terminalId`, `data` | Terminal scrollback |
| `exit` | `terminalId`, `code` | Terminal exited |
| `health` | `data` | Health update |
| `logged_out` | — | Session ended |
| `pong` | — | Latency response |

### AI Vision Commands (Extension only)

| Type | Fields | Description |
|------|--------|-------------|
| `capture_screenshot` | `requestId` | Capture visible tab |
| `screenshot_captured` | `requestId`, `dataUrl`, `url`, `title` | Screenshot result |
| `get_dom` | `requestId` | Get page DOM structure |
| `dom_data` | `requestId`, `data` | DOM inspection result |
| `navigate` | `requestId`, `url` | Navigate to URL |
| `click_element` | `requestId`, `selector` | Click a CSS selector |
| `evaluate` | `requestId`, `script` | Execute JavaScript |

## Health Monitoring

The server monitors system resources using native APIs:

- **Memory**: `os.totalmem()` / `os.freemem()`
- **Swap (macOS)**: `sysctl vm.swapusage`
- **Swap (Linux)**: `/proc/meminfo`
- **Disk**: `df -k /`
- **CPU**: `os.cpus()` model and count

Health data is broadcast to all connected clients every 10 seconds.

## Terminal Management

Terminals are spawned using `node-pty` (v1.2.0-beta.11):

- Default shell: user's `$SHELL` or `/bin/bash`
- Terminal size: 120×30 (resizable)
- Each terminal gets a unique ID
- Output is buffered (last 2000 chars) for reconnecting clients
- Terminals are cleaned up when clients disconnect

## Port Configuration

Default port: `7533` (embedded) or configurable via environment.

If port 7533 is already in use (e.g., from a previous soupz-stall instance), the server silently resolves without crashing — the stall boots normally without remote access.
