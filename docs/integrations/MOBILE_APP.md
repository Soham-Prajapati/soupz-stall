# 📱 Soupz Cloud Kitchen — Mobile IDE

The Soupz Mobile IDE is a React Native (Expo) app that connects to your laptop's Soupz Stall via WebSocket, giving you a full remote terminal, system health monitoring, and quick-action recipe buttons — all from your phone.

---

## Overview

The app turns your phone into a remote terminal for your AI kitchen. You can:

- **Spawn terminals** — create multiple terminal sessions on your laptop from your phone
- **Run commands** — type directly into your laptop's shell from anywhere on WiFi
- **Monitor health** — see RAM, swap, CPU, disk usage with real numbers + bars
- **Quick recipes** — one-tap shortcuts for common soupz-stall commands
- **Special keys** — Ctrl+C, Ctrl+D, Tab, arrow keys via dedicated buttons

## Architecture

```
┌─────────────────┐     WebSocket (ws://ip:7533)     ┌──────────────────┐
│   Mobile App    │ ◄──────────────────────────────► │  Cloud Kitchen   │
│   (Expo/RN)     │                                  │  (Remote Server) │
│                 │     OTP Pairing (REST)           │                  │
│  - Terminal UI  │ ──────────────────────────────►  │  - node-pty      │
│  - Health Panel │                                  │  - Health stats  │
│  - Recipe Bar   │                                  │  - Auth/sessions │
└─────────────────┘                                  └──────────────────┘
                                                            │
                                                     ┌──────┴──────┐
                                                     │ soupz-stall │
                                                     │  (CLI)      │
                                                     └─────────────┘
```

## Setup

### Prerequisites
- Node.js v18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (iOS App Store / Google Play)

### Installation

```bash
cd packages/mobile-ide
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone.

### Connecting to Your Kitchen

1. **Start soupz-stall** on your laptop:
   ```bash
   soupz-stall
   ```
   The Cloud Kitchen server starts automatically in the background on port 7533.

2. **Get your OTP** — type `/cloud-kitchen` in the stall to see the current 8-digit pairing code.

3. **Open the app** — enter the OTP code. If on the same WiFi, use `localhost`; otherwise use your laptop's local IP (shown in `/cloud-kitchen` output).

4. **Pair** — tap "Pair with Kitchen". Once connected, the screen switches to the terminal view.

### Auto-Reconnect

The app saves your session to AsyncStorage. If you close and reopen the app, it will attempt to reconnect automatically using the saved session token — no re-pairing needed (as long as the server is still running).

## Features

### Terminal Management
- **Create terminals** — tap ➕ in the header or the "Open a Station" button
- **Switch terminals** — tap the station tabs (🔥 = active, 🍳 = idle)
- **Kill terminals** — long-press a tab → confirm to close
- **Clear output** — tap the clear button or use Ctrl+L

### Special Keys Bar
A horizontal scrollable bar with:
| Key | Action |
|-----|--------|
| Ctrl+C | Interrupt running process |
| Ctrl+D | Send EOF / logout |
| Tab | Tab completion |
| ↑ | Previous command in history |
| ↓ | Next command in history |
| Ctrl+L | Clear terminal screen |

All keys provide haptic feedback (10ms vibration) on press.

### Health Panel (Kitchen Thermometer)
Tap the 📊 icon in the header to toggle the health panel. Shows:

- **CPU** — usage percentage with progress bar
- **RAM** — used/total in GB with percentage bar
- **Swap** — used/total in GB (important on 8GB Macs)
- **Disk** — used/total with percentage
- **Warnings** — high usage alerts

### Recipe Bar
Quick-tap buttons for common soupz-stall commands:
- `soupz-stall` — launch the stall
- `/help` — show all commands
- `/health` — system diagnostics
- `/chefs` — list AI personas
- `/todo` — task list
- `clear` — clear terminal

## OTP Security

- Pairing codes are **8-digit alphanumeric** (charset: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
- Codes **auto-refresh every 5 minutes** on the server
- Each code is **one-time use** — consumed on first pairing
- Session tokens are **64-char hex** (32 bytes random)
- Sessions validate on every WebSocket message

## Latency Monitoring

The app pings the server every 5 seconds and displays round-trip latency in the header status bar (e.g., "🟢 Stove hot • 3ms • MacBook").

## Technical Details

- **Framework**: React Native via Expo SDK 55
- **State**: React hooks (useState/useEffect/useRef)
- **Storage**: AsyncStorage for session persistence
- **ANSI Handling**: Custom `stripAnsi()` strips CSI, OSC, and control sequences
- **Buffer Cap**: Terminal output capped at 50K chars (trims to 40K) to prevent memory issues
- **Keyboard**: KeyboardAvoidingView for iOS, with behavior='padding'
- **Safe Area**: SafeAreaView wraps all screens for notch/Dynamic Island support
