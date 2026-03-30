# Soupz

**Control your laptop's AI coding tools from any device.** Run `npx soupz-cockpit` (alias `npx soupz`), scan a code, and code from your phone.

Soupz is a local-first AI agent orchestration daemon with a hosted web IDE. It bridges your laptop's AI coding agents (Claude Code, Gemini, Copilot, Ollama, Kiro) to any browser — phone, tablet, or another PC.

## Quick Start

### 1. Install
```bash
npx soupz-cockpit    # alias: npx soupz
```

### 2. Pair
Open your browser to `soupz.vercel.app`. Scan the QR code from your terminal, or enter the 9-character pairing code.

### 3. Build
- **Chat Mode**: Send prompts to your AI agents, get real-time responses
- **IDE Mode**: Edit files, run git commands, use a terminal — all from your phone
- **Builder Mode**: Lovable-style centered prompt with live preview split

## Features

- **Multi-Agent Orchestration** — Automatically picks the best available agent (Claude Code, Gemini, Copilot, Ollama)
- **Real-Time IDE** — Monaco editor, file tree, git operations, terminal
- **Local-First** — Your code never leaves your machine. Web app is just a remote control.
- **Mobile-Ready** — Works on phones, tablets, any browser. True responsive design.
- **Voice Support** — Chat with voice input and neural text-to-speech
- **Run Archive** — Each order drops JSON/MD logs into `.soupz/output/` so you can review prompts, plans, stdout, and events later
- **Free to Use** — Works with free agents (Copilot, Gemini). No subscriptions required.

## Architecture

- **Daemon** — Runs on your laptop (`npx soupz-cockpit`), spawns CLI agents, manages files/git
- **Web App** — Hosted at soupz.vercel.app, acts as a remote control
- **Relay** — Supabase Realtime for remote connections (LAN uses WebSocket)
- **Pairing** — 9-character OTP or QR code, 5-min auto-refresh

## Requirements

- Node.js 18+
- At least one CLI agent installed:
  - Claude Code (`npm install -g @anthropic-ai/claude-code`)
  - Gemini CLI (`npm install -g @google/gemini-cli`)
  - GitHub Copilot CLI (`gh copilot --version`)
  - Ollama (`ollama pull <model>`)

## Documentation

- [Setup & Troubleshooting](docs/SETUP.md)
- [System Architecture](docs/CURRENT_SYSTEM.md)
- [Runtime Changelog](docs/RUNTIME_CHANGELOG.md)
- [Project Overview](PROJECT_OVERVIEW.md)

## License

MIT
