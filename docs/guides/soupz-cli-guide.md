# Soupz CLI v0.2.0 — source-checkout guide

Soupz CLI starts a local daemon and interactive REPL that route work to AI
provider CLIs already installed on this computer. It is an orchestration and
transport layer, not an AI model.

## Availability

Soupz CLI is currently source-only. The `soupz-cli` npm package, Homebrew
formula, and intended public repository are not published, so registry install
and public clone commands are not supported yet.

From an existing checkout:

```bash
npm install
npm run smoke:cli
npm run dev
```

The package and executable name are both `soupz-cli`. When running directly
from source, use `node bin/soupz.js` in place of `soupz-cli`.

## Current shell command surface

```text
node bin/soupz.js --help
node bin/soupz.js --version
node bin/soupz.js agents
node bin/soupz.js auth [status|login|logout] [provider-id]
node bin/soupz.js ask <provider-id> "prompt"
node bin/soupz.js sync
node bin/soupz.js --no-open --no-motion
```

| Command | Current behavior |
| --- | --- |
| `--help` | Prints the shell command and option surface. |
| `--version` | Prints the package-derived CLI version. |
| `agents` | Lists provider lanes, shipped specialists, and local provider availability. |
| `auth` | Shows provider authentication status or delegates login/logout to the selected provider CLI. |
| `ask` | Sends one prompt through the explicitly named provider lane. It requires that provider to be installed and authenticated. |
| `sync` | Runs the local Supabase CLI and pushes database migrations. This is an external-state operation, not a setup or read-only command. Review the target before using it. |
| no command | Starts the daemon and REPL. `--no-open` suppresses browser launch; `--no-motion` disables animated terminal status. |

Other startup options shown by `--help` include `--port <port>`, `--cloud`, and
`--yolo`. `--cloud` creates an internet tunnel. `--yolo` enables provider
permission-bypass behavior; use it only when that increased authority is
intentional.

## Supported providers and specialists

The shipped provider lanes are Claude Code, Codex CLI, Gemini CLI, GitHub
Copilot CLI, and Kiro CLI. `agents` reports which local binaries are available.

Ollama is **not a supported provider lane in the current runtime**. It is
excluded while agent definitions are loaded, is not used by the router, and
cannot be added with `soupz-cli add ollama`; there is no `add` shell command.
Installing Ollama separately does not make Soupz route work to it.

Specialists such as `architect`, `planner`, `dev`, and `tester` are prompt
wrappers under `defaults/agents/`. A specialist still needs an available
provider lane to execute its prompt.

## Starting the daemon and REPL

```bash
node bin/soupz.js --no-open
```

The daemon binds to `127.0.0.1:7533` by default. Override the port with
`--port 8000`. The displayed pairing code and resulting session token are
short-lived credentials; do not paste them into logs, issues, or chat.

Inside the REPL, `/help` is the authoritative complete command list. These are
the core navigation and inspection commands:

| Command | Current behavior |
| --- | --- |
| `/help` | Displays the REPL command menu. |
| `/kitchen` | Lists provider lanes and their availability. |
| `/chefs` or `/agents` | Lists shipped specialist prompt wrappers. `/personas` is not a command. |
| `/station <provider-id>` | Selects an available provider lane; `/tool` is an alias. |
| `/utensil <model>` | Selects a model from the current Copilot/Gemini model catalog; `/model` is an alias. |
| `/auto` | Clears the provider lock and returns to automatic routing. |
| `/recipe list` | Lists the built-in recipe chains. |
| `/chain` | Prints chain syntax; `/chain a→b "prompt"` executes specialists sequentially. |
| `/fleet view` | Shows active and recent fleet worker states. |
| `/fleet runs` | Lists recorded fleet runs. |
| `/meter` | Shows locally observed session/process usage; unavailable provider token/cost data is labeled unavailable. |
| `/pantry` | Shows pantry storage status. |
| `/stock store <text>` | Stores context in the pantry. |
| `/stock recall <query>` | Searches pantry context. `/pantry bank ...` is not supported. |
| `/sessions` | Lists named local sessions. |
| `/version` | Shows CLI, Node, and operating-system version information. |
| `/quit` or `/exit` | Saves local state and exits the session. |

Commands that execute a prompt—plain input, `@specialist`, `/chain`,
`/delegate`, `/parallel`, `/fleet`, `/subagent`, `/team`, and recipes—can call
external provider CLIs and inherit their authentication, network, cost, and
permission behavior.

## Data and configuration

Runtime data is stored under `~/.soupz-cli/`. Existing data under the legacy
`~/.soupz-agents/` path is copied forward without deleting or overwriting the
legacy source.

Use environment variables for configuration; never put credentials in tracked
files. Common settings are:

| Variable / flag | Purpose |
| --- | --- |
| `SOUPZ_REMOTE_PORT` / `--port` | Select daemon port. |
| `SOUPZ_BIND_HOST` | Select bind host; the default is loopback. |
| `SOUPZ_APP_URL` | Select browser/pairing base URL. |
| `SOUPZ_ALLOWED_ORIGINS` | Add allowed browser origins. |
| `SOUPZ_ALLOWED_ROOTS` | Restrict selectable workspace roots. |
| `SOUPZ_REDUCE_MOTION=1` / `--no-motion` | Disable terminal animation. |
| `SOUPZ_SUPABASE_URL`, `SOUPZ_SUPABASE_KEY` | Configure the optional remote path; keep values out of Git. |

## Verification

```bash
npm test
npm run smoke:cli
npm pack --dry-run --ignore-scripts
git diff --check
```

The smoke check covers help/version naming, isolated-home legacy migration,
and fresh-home agent loading. Package preview verifies intended tarball
contents without publishing anything.
