# Contributing to soupz-cli

Thanks for helping improve soupz-cli — the hosted web IDE plus local daemon that
bridges your laptop to a browser on any device. This guide covers everything you
need to get a change from idea to merged PR.

## Prerequisites

- Node.js >= 18 (enforced via `engines` in `package.json`)
- npm (the repo uses npm workspaces: `packages/*`)

## Development setup

```bash
git clone <your fork>
cd cli
npm install
npm run dev:web
```

`npm run dev:web` starts the local daemon and the Vite dev server together and
auto-pairs them. The daemon listens on port 7533 (`SOUPZ_REMOTE_PORT`), the
dashboard dev server on 7534/5173. To run only the daemon: `npm start`.

Configuration lives in `.env` (gitignored). Copy required key names from
`.env.example` if present. Never commit a real API key, token, or connection
string — PRs containing credentials will be closed and the credential treated
as compromised.

## Running tests

```bash
npm test                # vitest run — unit tests
npm run smoke:cli       # CLI smoke check
npm run smoke:pairing   # pairing-flow smoke check
npm run lint:docs-links # verifies documentation links
```

Run `npm test` before every push. Run the smoke checks when your change touches
the daemon, pairing, or startup flow.

## Code style

Match the surrounding code — this repo has strong conventions:

- ESM everywhere (`"type": "module"`); no CommonJS in new code.
- Dashboard (`packages/dashboard/`): React 18 + Tailwind. Colors come from CSS
  custom properties (theme variables) — never hardcode colors in components.
- Lucide icons only; font weights 400/500/600 only.
- No emojis in code, comments, or CLI output.
- UI state persists in localStorage; do not add server-side state for UI prefs.
- Agent IDs are kebab-case strings (e.g. `claude-code`).

## Proposing a change

1. Open an issue first for anything larger than a small fix, so the approach
   can be agreed before you invest time.
2. Branch from `main` with a descriptive name (`fix/pairing-refresh`,
   `feat/terminal-scrollback`).
3. Keep PRs small and focused — one logical change per PR.
4. Fill in the PR template: what changed, why, and how you tested it.

## What maintainers look for

- Tests pass (`npm test`) and new behavior has test coverage.
- No credentials, tokens, or personal data anywhere in the diff.
- Changes to the daemon's pairing/auth surface are discussed in an issue first —
  this is security-sensitive code.
- Documentation updated when behavior changes (`docs/CURRENT_SYSTEM.md` is the
  canonical runtime description; `docs/SETUP.md` for setup changes).
- The diff matches the existing style rather than introducing a new one.

## What not to change

- **Brand assets** (logos, icons, wordmarks) are locked and are not accepted in
  PRs.
- **Product names are fixed.** `soupz-cli` (package, bin, formula name) and the
  Soupz product names are not open to renaming or restyling.
- Do not edit generated files or lockfiles unrelated to your change.

## Conduct

Be respectful and constructive in issues and reviews. A formal code of conduct
may be adopted later; until then, ordinary professional courtesy applies.
