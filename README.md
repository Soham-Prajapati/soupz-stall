# Soupz CLI

Soupz CLI runs a local daemon that connects a browser to AI coding CLIs already installed on your computer. It can pair a phone or another browser, expose an authenticated workspace and terminal, invoke supported agent CLIs, and coordinate parallel agent work. Soupz CLI is an orchestration and transport layer; it is not an AI model.

## Status: source-only, unpublished

This project is pre-release. The `soupz-cli` npm package is not published, there is no supported Homebrew formula, and the intended public GitHub location is not available. Commands that fetch the package from npm or clone the intended public repository are therefore not valid installation instructions yet.

Today, run Soupz CLI from an existing local source checkout. The canonical package name, installed executable, and future install copy are all `soupz-cli`.

## How it works

1. `soupz-cli` starts an Express and WebSocket daemon on your computer.
2. The daemon creates a short-lived pairing code and can open the configured browser app.
3. An authenticated browser can work with files, git, terminals, and orders inside the daemon's allowed roots.
4. Agent requests are passed to an installed provider CLI. Fleet mode can run several local CLI processes and synthesize their results.

The main pieces are:

- `bin/soupz.js` — executable, daemon startup, pairing display, and the interactive REPL.
- `packages/remote-server/` — authenticated HTTP/WebSocket server, terminal, workspace, and pairing routes.
- `src/agents/` and `defaults/agents/` — provider adapters and specialist definitions.
- `src/session/` — REPL commands, orchestration, fleet state, and the local Meter.
- `packages/dashboard/` — browser interface used by the hosted app and local development.

## Requirements

- Node.js 18 or newer and npm.
- A local copy of this repository with dependencies installed.
- At least one supported CLI if you want Soupz to run agent prompts.

Provider support reflects the definitions that ship today:

| Provider lane | Detection / command | Notes |
| --- | --- | --- |
| Claude Code | `claude` | Runs in non-interactive print mode. |
| Codex CLI | `codex` (also detects `codex-cli` or `openai-codex`) | Runs `codex exec`; the current adapter enables unattended execution. |
| Gemini CLI | `gemini` | Uses streaming JSON output; the current adapter enables unattended execution. |
| GitHub Copilot CLI | standalone `copilot`, otherwise `gh copilot` | Requires the corresponding installed and authenticated CLI. |
| Kiro CLI | `kiro-cli` | Runs `kiro-cli chat`. Availability depends on that binary being installed. |

Specialists such as `architect`, `dev`, and `researcher` are prompt wrappers. They still need one of the available provider lanes above. Ollama is not currently a supported lane.

## First local run

From this checkout:

```bash
npm install
npm run smoke:cli
npm run dev
```

`npm run dev` starts the daemon and interactive REPL. By default it listens on `127.0.0.1:7533` and opens the configured browser app. Use the displayed QR code or enter the nine-character pairing code in the browser.

Useful source-checkout alternatives:

```bash
node bin/soupz.js --help
node bin/soupz.js --version
node bin/soupz.js agents
node bin/soupz.js --no-open
```

## Daily commands

At the shell:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local daemon and REPL. |
| `node bin/soupz.js agents` | Show shipped provider and specialist definitions and local availability. |
| `node bin/soupz.js ask "prompt"` | Send one prompt through the default available lane. |
| `node bin/soupz.js --port 8000` | Start on a different local port. |
| `node bin/soupz.js --no-open` | Start without opening a browser. |
| `node bin/soupz.js --no-motion` | Use deterministic, non-animated terminal output. |

Inside the REPL:

| Command | Purpose |
| --- | --- |
| `/help` | List available REPL commands. |
| `/kitchen` | Show provider lanes and whether each local binary is available. |
| `/agents` | List specialist prompt wrappers. |
| `/station <id>` | Select a provider lane. |
| `/fleet "prompt"` | Start a parallel fleet run. |
| `/fleet view` | Show all fleet agents, state counts, failures, and age. |
| `/fleet runs` | List recorded fleet runs. |
| `/fleet result <run-id>` | Show a run's synthesized result. |
| `/meter` | Show locally observed session and process usage. |
| `/exit` | Save local state and stop the session. |

## Configuration

Prefer environment variables for configuration. Do not put credentials in tracked files.

| Variable / flag | Default | Effect |
| --- | --- | --- |
| `SOUPZ_REMOTE_PORT` / `--port` | `7533` | Daemon port. The CLI flag takes precedence. |
| `SOUPZ_BIND_HOST` | `127.0.0.1` | Bind address. Setting `0.0.0.0` explicitly exposes the daemon to the network. |
| `SOUPZ_APP_URL` | hosted Soupz browser app | Browser and pairing base URL; also added to the origin allowlist. |
| `SOUPZ_ALLOWED_ORIGINS` | built-in local and app origins | Comma-separated additional allowed browser origins. |
| `SOUPZ_ALLOWED_ROOTS` | home, repository, and daemon working directory | Colon-separated base paths that may be selected as workspace roots. |
| `SOUPZ_REDUCE_MOTION=1` / `--no-motion` | off | Disable terminal animation. CI, redirected output, `NO_COLOR`, and `TERM=dumb` also disable it. |
| `SOUPZ_SHOW_CODE_TIMER=1` | off | Show the pairing-code countdown in a capable TTY. |
| `SOUPZ_SUPABASE_URL`, `SOUPZ_SUPABASE_KEY` | unset | Configure the optional Supabase-backed remote path. Values are credentials/configuration and must stay out of git. |

Runtime data is written under `~/.soupz-cli/`. Older `~/.soupz-agents/` data is copied forward without deleting or overwriting the legacy source.

## Privacy and security boundaries

- The daemon binds to loopback by default. LAN access is an explicit `SOUPZ_BIND_HOST=0.0.0.0` choice; use it only on a network you trust.
- Direct browser-to-daemon sessions keep transport on the selected local network path. Remote relay sessions can write commands and responses, including prompt or file text, to the configured Supabase tables in transit. That relay is not end-to-end encrypted.
- Every invoked provider CLI sends prompts and context according to that provider's behavior and terms. Soupz cannot make an external provider local.
- Pairing codes are short-lived credentials. Treat the code and resulting session token as secrets.
- Origin checks, pairing tokens, loopback defaults, and real-path containment protect the daemon boundary. They do not make a deliberately exposed daemon safe on an untrusted network.
- Provider adapters currently use unattended / permission-bypass flags where supported. An invoked agent can act with the permissions of your operating-system user.
- Session archives under `.soupz/output/` may contain raw prompts, stdout, plans, and events. They stay out of the npm package, but you should still treat local archives as sensitive.
- Meter is local observation, not billing. It records session inputs, process starts, terminal outcomes, and elapsed process time only when those events are available. Repeated terminal events are ignored. Provider token and cost lines remain unavailable unless explicit provider telemetry is supplied; Soupz never estimates them from text length.

## Agent, fleet, and Meter views

Run `node bin/soupz.js agents` before the first session to confirm definitions load and to see which provider binaries are available. A definition can load correctly while its provider is unavailable; installing and authenticating that provider CLI is a separate step.

`/fleet view` starts with counts for needs-input, running, completed, failed, and unknown agents. Agents that need input are listed first, failures stay truncated on the same row, and age is right-aligned for scanning. The view reports unknown state or age when the runtime did not provide one rather than inventing a value.

`/meter` is intentionally conservative. It does not convert characters to tokens, infer prices, or count duplicate process close/error notifications.

## Verification matrix

| Check | Command | What it covers |
| --- | --- | --- |
| Unit/integration suite | `npm test` | Agent loading, lifecycle, Meter/fleet rendering, daemon, pairing, filesystem, git, and dashboard behavior. |
| CLI smoke | `npm run smoke:cli` | Help/version naming, isolated-home migration, and fresh-home agent loading. |
| Pairing smoke | `npm run smoke:pairing` | Local pair, validate, WebSocket auth, order creation, and cleanup. Uses a local test port. |
| Package preview | `npm pack --dry-run --ignore-scripts` | Intended tarball contents without publishing. |
| Whitespace check | `git diff --check` | Patch formatting. |

For a release candidate, also pack the tarball and install that tarball into a temporary project with a clean temporary `HOME`; then run its `soupz-cli --version`, `--help`, and `agents` commands. This verifies the artifact rather than relying on the source checkout.

## Troubleshooting

**No provider lanes are available**

Run `node bin/soupz.js agents`, install one supported CLI from its provider, authenticate it using the provider's instructions, and retry. Loading a specialist definition does not install a provider.

**The browser cannot connect**

Confirm the daemon is running, the browser origin is allowed, and the displayed code has not expired. If you changed the port, use the same port throughout the connection. Keep loopback binding unless LAN access is intentional.

**Port 7533 is already in use**

Stop the old daemon or run `node bin/soupz.js --port 8000`. The CLI can attach its REPL while an existing daemon owns the configured port.

**Motion or ANSI output is undesirable**

Use `--no-motion` or set `SOUPZ_REDUCE_MOTION=1`. Redirected output and CI are static automatically.

**A fleet agent shows needs input**

Use `/fleet view` to find it, then `/fleet peek <worker-id>` to inspect captured output. Provider CLIs can still request authentication, approval, or interactive input even when an unattended adapter is configured.

**Fresh-home agents are missing**

Run `npm run smoke:cli`. It creates an isolated home, seeds the packaged definitions, and fails if they cannot be loaded. Do not repair this by copying credentials or private agent files into the repository.

## Release and installation status

| Channel | Status | Supported action today |
| --- | --- | --- |
| Local source checkout | Available | `npm install`, then `npm run dev`. |
| Packed local tarball | Verification only | Create locally and install the resulting file into a temporary test project. |
| npm registry | Unpublished | No registry install command is supported yet. |
| Homebrew | Unpublished | No formula is supported yet. |
| Intended public GitHub repository | Unpublished | No public clone or issue URL is promised yet. |

Publishing to npm, creating a Homebrew release, pushing to a remote, or changing remote state requires an explicit release-owner decision. None of those actions are part of local verification.

## License

MIT
