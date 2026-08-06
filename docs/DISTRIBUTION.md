# Distribution status — what's it called, and how do people get it?

This answers a recurring point of confusion: what is this thing named on each
surface, is it actually published anywhere, and how does someone install or
run it. Everything below is grounded in `package.json`, `bin/`, `README.md`,
and `_memory/NAMING-REGISTRY.yaml`.

## Prerequisites

- Node.js 18 or newer (`package.json` declares `node >=18`).
- npm, including support for `npm ci`.
- A real terminal (TTY) for the interactive REPL. Startup can be launched from
  automation, but REPL commands such as `/recipe list` and `/exit` require an
  attached interactive terminal.

## 1. The name, on every surface

One name everywhere: **`soupz-cli`**.

| Surface | Name | Source |
| --- | --- | --- |
| npm package | `soupz-cli` | `package.json` → `"name": "soupz-cli"` |
| Installed executable / bin command | `soupz-cli` | `package.json` → `"bin": { "soupz-cli": "bin/soupz.js" }` |
| Homebrew formula (planned, not created) | `soupz-cli` | `_memory/NAMING-REGISTRY.yaml` → `canonical_names.cli_homebrew_formula: soupz-cli` |
| GitHub repo (intended location, not live) | `soupz/cli` | Referenced in `docs/NPM_PUBLISH.md` (`repository`/`homepage` fields) and `README.md` |

There is no separate "product name" vs "package name" split to worry about —
`_memory/NAMING-REGISTRY.yaml` also lists `soupz-agents` as a **prohibited
legacy name**; that name should not reappear on any new surface (see the
`project_id` note in this repo's config for the one remaining place it was
still used purely as a local identifier, now fixed).

## 2. Current status: NOT published anywhere yet

Repeat the registry check at any time:

```
npm view soupz-cli version
```

While the package remains unpublished, the expected result is:

```
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/soupz-cli
```

That 404 is expected and correct — nobody has run `npm publish` for this
package. Status, surface by surface:

| Surface | Status |
| --- | --- |
| npm registry | **Unpublished.** `npm view soupz-cli` 404s. |
| Homebrew | **No formula, no tap exists.** Name is reserved in the naming registry only. |
| Public GitHub repo | **Not live at the intended location.** `README.md`'s own "Status" section says the same. |

`README.md`'s "Status: source-only, unpublished" section is the canonical
statement of this and this doc should never contradict it. If that changes
(a publish happens), update both files together.

## 3. How Shubh will share it, once published

After an explicitly authorized npm release, the package will be installable
globally as `soupz-cli` or runnable through npm's package executor. A later
Homebrew release will use the same `soupz-cli` formula name, once a tap exists.
See `docs/NPM_PUBLISH.md` for the release checklist; publication is not part of
routine development work.

The Homebrew formula name itself (`soupz-cli`) is already settled per the
naming registry — what's undecided is which tap it lives under, since no tap
repo exists yet.

## 4. How to run it TODAY, from a repo clone

This is the only supported path right now. From the directory containing a
fresh `cli/` clone, use this canonical sequence:

```bash
cd cli && npm ci && npm run dev -- --no-open
```

`npm ci` installs exactly what the committed lockfile describes. Use plain
`npm install` instead only when intentionally adding/updating dependencies and
therefore updating `package-lock.json`, or when working from a source bundle
that genuinely has no lockfile.

The final command starts a loopback daemon on port 7533 and opens the
interactive REPL without opening a browser. In a real TTY, expect a daemon
header, an online status for `localhost:7533`, a short-lived pairing code, and
then the REPL prompt. Pairing codes are credentials: do not paste them into
chat, logs, issues, or screenshots.

At that prompt, `/recipe list` lists the built-in recipes and `/exit` saves
local state and stops the process cleanly. Both commands are TTY-interactive
only. Piped or redirected stdin does not execute them and can leave the daemon
running, so do not use a pipe or redirected file to automate shutdown.

### Startup side effects

Even a local source run changes user-level state:

- Creates or updates `~/.soupz-cli/` for agents, authentication state,
  context, memory, analytics, command history, and related local data.
- Creates or updates `~/.soupz/custom/` when bundled persona exports are
  available for import.
- May copy legacy data from `~/.soupz-agents/` into `~/.soupz-cli/`. The
  migration copies missing data; it does not delete the legacy directory.
- Starts a daemon bound to the local loopback interface, normally port 7533.
- Prints a short-lived pairing credential for connecting a browser or phone.

Supabase is optional. If it is not configured, Supabase connection or network
warnings during startup are harmless for local-only use and do **not** mean
the daemon failed to start. Confirm success from the online localhost status
and the REPL prompt.

### Port 7533 troubleshooting

If startup prints `Web daemon is already running in the background (port
7533)`, another Soupz CLI process already owns the default port. The new REPL
may still appear, but it does not own that existing listener. Return to the
real terminal that started the original daemon and enter `/exit`; a clean exit
saves local state and releases the port. If that terminal is no longer
available, identify the owning process before taking any further action rather
than repeatedly starting more CLI instances.

### Known issues and expected install warnings

- The current lockfile reports 17 npm audit findings: 1 low, 6 moderate, 9
  high, and 1 critical. These are known dependency findings and do not mean
  `npm ci` failed; review the audit separately before production or release
  use.
- npm also prints `allow-scripts` warnings for dependencies whose install
  scripts have not been explicitly approved. These warnings are expected and
  do not by themselves mean the install is broken. Script approval is a
  separate dependency-security decision.
- Older revisions printed `Opening browser...` even with `--no-open`. The
  actual browser launch was already gated correctly. This checkout also gates
  that status line, so the cosmetic message is no longer printed under
  `--no-open`.

## 5. Env vars a new user must supply

**Variable names only — see `.env.example` for the full annotated template.
Never put real values in a tracked file.**

None of these are strictly mandatory just to start the daemon — Soupz can
run agent prompts through either an already-installed, already-authenticated
provider CLI (`claude`, `gemini`, `copilot`/`gh copilot`, `kiro-cli`) **or**
one of the API-key variables below. You need at least one of those two
paths, not both.

AI provider API keys (alternative to installing a provider CLI):
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `GEMINI_API_KEY`

Optional provider/routing behavior:
- `SOUPZ_API_PROVIDER`
- `SOUPZ_ROUTER`
- `SOUPZ_LANG_BRIDGE`
- `SOUPZ_MODEL_TIER`

Optional local Ollama lane:
- `OLLAMA_HOST`
- `OLLAMA_ROUTER_MODEL`

Optional — only needed for the remote/relay pairing path (per `README.md`,
"Configure the optional Supabase-backed remote path"):
- `SOUPZ_SUPABASE_URL`
- `SOUPZ_SUPABASE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOUPZ_SUPABASE_ORDERS_TABLE`

Optional server/runtime tuning:
- `SOUPZ_REMOTE_PORT`
- `SOUPZ_WEB_AGENT`

Copy `.env.example` to `.env` and fill in only what you need for the lane
you're using; `.env` is gitignored and must stay that way.
