# Soupz Cloud Kitchen — Mobile IDE Documentation

> Remote terminal access from your phone. Pair with an OTP code, run commands, monitor your laptop — all from anywhere.

---

## What Is It?

The Soupz Mobile IDE is a **React Native / Expo** app that connects to your laptop via WebSocket, giving you full terminal access from your phone. It's not a code editor — it's a **remote command center** that lets you:

- Run any CLI command on your laptop from your phone
- Open multiple terminals simultaneously (parallel task execution)
- Monitor your laptop's health (RAM, CPU, temperature)
- Get warnings when your laptop is overheating or running out of memory
- Execute Soupz Stall commands (`soupz`, `@chef`, `/station`) remotely

### Why This Exists

When you're running long AI tasks (model training, builds, test suites), you don't always want to sit at your laptop. Maybe you're on your couch, at a café, or just across the room. The Mobile IDE lets you:

1. **Start a build** and walk away — get notified when it finishes or fails
2. **Run parallel tasks** — open 3 terminals: one for Copilot, one for Gemini, one for tests
3. **Monitor resource usage** — know when to stop Ollama because RAM is at 95%
4. **Quick fixes** — run a `git commit` or restart a server without going back to your desk

---

## Architecture

```
┌──────────────────────┐         WebSocket (ws://port:7533)         ┌─────────────────────┐
│                      │◄──────────────────────────────────────────►│                     │
│   📱 Mobile IDE      │                                            │  🖥️ Remote Server   │
│   (React Native)     │         REST API (GET/POST)                │  (Express + WS)     │
│                      │◄──────────────────────────────────────────►│                     │
│  • Terminal UI       │                                            │  • Terminal Manager  │
│  • Health Dashboard  │                                            │  • Health Monitor    │
│  • Multi-tab Manager │                                            │  • Process Spawner   │
│                      │                                            │  • Output Buffer     │
└──────────────────────┘                                            └─────────────────────┘
         │                                                                    │
         │  Expo Go / Standalone App                                          │
         │  (iOS / Android)                                                   │  Your laptop
         │                                                                    │  running Node.js
         ▼                                                                    ▼
    Your Phone                                                         localhost:7533
    (same WiFi or tunneled)                                         (or tunneled via SSH/localtunnel)
```

### Communication Flow

1. **Phone connects** to laptop via WebSocket on port 7533
2. **Server sends** initial health data (RAM, CPU, etc.)
3. **User creates terminal** → server spawns a shell process
4. **User types command** → phone sends input via WebSocket → server writes to shell stdin
5. **Shell produces output** → server streams stdout/stderr via WebSocket → phone displays
6. **Health broadcasts** every 5 seconds keep the phone updated on system resources

---

## WebSocket Protocol

All messages are JSON. The `type` field determines the message kind.

### Client → Server Messages

| Type | Fields | Description |
|------|--------|-------------|
| `create_terminal` | `cwd?` (string) | Spawn a new shell session |
| `subscribe` | `terminalId` (number) | Attach to an existing terminal's output stream |
| `input` | `terminalId`, `data` (string) | Send keyboard input to a terminal |
| `resize` | `terminalId`, `cols`, `rows` | Resize terminal (future: requires node-pty) |
| `kill_terminal` | `terminalId` (number) | Kill a terminal process |
| `health` | — | Request immediate health snapshot |

### Server → Client Messages

| Type | Fields | Description |
|------|--------|-------------|
| `terminal_created` | `terminalId`, `pid` | New terminal spawned successfully |
| `output` | `terminalId`, `data` | Terminal stdout/stderr chunk |
| `history` | `terminalId`, `data` | Full buffer history on subscribe |
| `exit` | `terminalId`, `code` | Terminal process exited |
| `health` | `data` (object) | System health snapshot |
| `error` | `message` | Error description |

### Health Data Shape

```json
{
  "platform": "darwin",
  "arch": "arm64",
  "hostname": "Shubhs-MacBook",
  "uptime": 86400,
  "cpu": {
    "model": "Apple M1",
    "cores": 8,
    "loadAvg": { "1m": 2.1, "5m": 1.8, "15m": 1.5 },
    "temperature": null
  },
  "memory": {
    "total": 8589934592,
    "used": 6442450944,
    "free": 2147483648,
    "usagePercent": 75
  },
  "warnings": ["⚠️ RAM usage above 70%"]
}
```

---

## REST API

The remote server also exposes REST endpoints for simple integrations.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Returns system health JSON |
| `GET` | `/terminals` | List all active terminals with IDs, PIDs, alive status |
| `POST` | `/terminal` | Create a new terminal, returns `{ id, pid }` |

---

## Setup & Usage

### 1. Start the Remote Server (on your laptop)

```bash
cd packages/remote-server
npm install
npm start
```

Output:
```
🫕 Soupz Remote Server running on port 7533
   REST:      http://localhost:7533/health
   WebSocket: ws://localhost:7533
```

### 2. Launch the Mobile App

```bash
cd packages/mobile-ide
npx expo install    # first time only
npx expo start      # generates QR code
```

Scan the QR code with **Expo Go** (free app on iOS/Android).

### 3. Pair Your Phone

The server shows an 8-digit pairing code on startup (like a Cloud Kitchen order number):

```
🔑  PAIRING CODE:  75471229
    Expires in 300s
```

1. Enter the code in the app's pairing screen
2. Enter your laptop's IP (shown as `LAN: ws://192.168.x.x:7533`)
3. Tap **"Pair Device"**
4. ✅ Connected — session stays active for 24 hours

Generate a new code anytime: `curl -X POST http://localhost:7533/pair`

### How It Works (Like iCloud Keychain)

- The code is **one-time use** — once paired, it's consumed
- Your phone gets a **session token** (valid 24 hours)
- If you close the app, it **auto-reconnects** with the saved token
- If the token expires, you need a new pairing code
- The server **won't accept commands** from unauthenticated clients

### 4. Use It

- Tap **"+ Terminal"** to create terminals
- Type commands in the input bar
- Long-press a tab to kill that terminal
- Tap **Health** to see system resources
- Warnings appear automatically when RAM > 90% or CPU is high

---

## Security — OTP Pairing Model

The Cloud Kitchen uses a **pairing code model** (similar to Apple's iCloud Keychain):

### How It Works
1. Server generates an **8-digit one-time code** on startup
2. Code is valid for **5 minutes** — enter it on your phone or browser extension
3. On validation, the server returns a **session token** (valid 24 hours)
4. All subsequent WebSocket and REST requests require this token
5. Unauthenticated clients get **disconnected after 10 seconds**

### Security Properties
- ✅ **One-time codes** — each code works exactly once, then is deleted
- ✅ **Short expiry** — codes expire in 5 minutes, sessions in 24 hours
- ✅ **Token-based auth** — no passwords stored, tokens are cryptographically random (32 bytes hex)
- ✅ **WebSocket auth timeout** — clients must authenticate within 10 seconds or get disconnected
- ✅ **Health broadcasts only to authenticated clients** — no data leakage

### Planned Improvements
- [ ] QR code generation (encode server URL + pairing code into scannable QR)
- [ ] Rate limiting on pairing attempts (prevent brute force)
- [ ] TLS/WSS encryption for tunnel connections
- [ ] Command allowlist/blocklist
- [ ] Session revocation from server CLI

---

## App Screens & Features

### Connection Screen
- Server URL input with default `ws://localhost:7533`
- Connect button with loading state
- Setup instructions shown as hint text

### Main Terminal View
- **Header bar** — App title, health button (shows warning badge), "+ Terminal" button
- **Health panel** (collapsible) — RAM usage bar with color coding (green/amber/red), CPU load, temperature, warnings
- **Terminal tabs** — Horizontal scrollable tabs, active tab highlighted in red, long-press to kill
- **Terminal output** — Dark terminal with green monospace text, auto-scrolls, selectable text
- **Input bar** — `$` prompt, text input, send button

### Empty State
- Shown when no terminals are open
- Kitchen-themed emoji (🍳) with "No terminals open" message

---

## Parallel Workflow Example

Open 3 terminals on your phone:

```
Terminal 1: soupz                          # Interactive Soupz session
Terminal 2: npm run build -- --watch       # Watch build
Terminal 3: npm test -- --watchAll         # Watch tests
```

Now from Terminal 1, use Soupz to generate code. Terminal 2 auto-rebuilds. Terminal 3 auto-tests. You see results across all three tabs without touching your laptop.

---

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Mobile app | React Native + Expo |
| Navigation | `@react-navigation/native` + bottom tabs |
| Server | Express + `ws` (WebSocket) |
| Terminal spawn | Node.js `child_process.spawn` |
| Health monitoring | Node.js `os` module |
| State management | React `useState` / `useRef` |

### Known Limitations

1. **No PTY support** — Uses `child_process.spawn` instead of `node-pty`, so:
   - No proper terminal colors (ANSI codes may appear raw)
   - No terminal resize support
   - Interactive programs (vim, htop) won't work properly
2. **Text-only** — No graphical output, no image preview
3. **Single user** — Multiple phones connecting may conflict on terminal ownership
4. **WiFi required** — Without a tunnel, phone must be on same network

### Future: node-pty Upgrade

For full terminal emulation, replace `child_process.spawn` with `node-pty`:

```bash
npm install node-pty
```

This enables:
- Proper ANSI color rendering
- Terminal resize (cols/rows)
- Interactive programs (vim, nano, htop)
- xterm.js integration on the phone side

---

## File Structure

```
packages/
├── remote-server/
│   ├── package.json
│   └── src/
│       └── index.js          # Express + WebSocket server
│
└── mobile-ide/
    ├── package.json
    ├── App.js                # Main app (all-in-one for now)
    └── src/
        ├── screens/          # Future: separate screen components
        ├── components/       # Future: reusable UI components
        ├── services/         # Future: WebSocket service, health service
        └── utils/            # Future: formatters, constants
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOUPZ_REMOTE_PORT` | `7533` | Port for the remote server |
| `SHELL` | `/bin/bash` | Shell used for terminals |

---

## Roadmap

- [ ] **node-pty** integration for full terminal emulation
- [ ] **xterm.js** rendering on mobile for proper colors/cursor
- [ ] **Authentication** — JWT or shared-secret before WebSocket upgrade
- [ ] **Push notifications** — notify when a long-running command finishes
- [ ] **Command history** — search and re-run previous commands
- [ ] **Snippets** — save frequent commands as one-tap buttons
- [ ] **File browser** — browse and preview files on the laptop
- [ ] **Split view** — show 2 terminals side by side on tablet
- [ ] **Voice input** — speak commands instead of typing
- [ ] **Clipboard sync** — copy output on phone, paste on laptop
