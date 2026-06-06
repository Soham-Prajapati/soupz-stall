# Soupz

**Control your laptop's AI coding tools from any device.** Run `npx @shubh_prajapati99/soupz`, scan a code, and code from your phone.

Soupz is a local-first AI agent orchestration daemon with a hosted web IDE. It bridges your laptop's AI coding agents (Claude Code, Gemini, Copilot, Ollama, Kiro) to any browser — phone, tablet, or another PC.

## Quick Start

### 1. Install
```bash
npx @shubh_prajapati99/soupz
```

### 2. Pair
Open your browser to `https://soupz.vercel.app/code`. Scan the QR code from your terminal, or enter the 9-character pairing code.

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

- **Daemon** — Runs on your laptop (`npx @shubh_prajapati99/soupz`), spawns CLI agents, manages files/git
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

## Security Architecture (Why do scanners flag this?)

Because Soupz acts as a **Remote IDE Daemon**, it intentionally spawns PTY shells, reads the local file system, and executes terminal commands (like `git` or `gh copilot`). Automated NPM security scanners (like Socket.dev) often flag these behaviors as "Medium Risk" or "Malware" because they assume NPM packages are simple libraries, not Remote Access Daemons.

**How we keep it secure:**
- **Pairing Tokens:** The daemon only accepts WebSocket connections that present a cryptographically secure, short-lived (5-min) OTP.
- **Local-First Execution:** Your codebase never leaves your machine. The web app is purely a thin client/remote control.
- **Strict Command Primitives:** The daemon strictly avoids vulnerable shell interpolation (like `execSync`) and uses raw binary execution (`execFileSync`) to prevent command injection from malicious prompts.

## Documentation

- [Setup & Troubleshooting](docs/SETUP.md)
- [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Runtime Changelog](docs/RUNTIME_CHANGELOG.md)
- [Project Overview](PROJECT_OVERVIEW.md)
- [Model Selection and Grading](docs/guides/MODEL_SELECTION_AND_GRADING.md)
- [Owner Action Checklist](docs/guides/OWNER_ACTION_CHECKLIST.md)

## License

MIT
