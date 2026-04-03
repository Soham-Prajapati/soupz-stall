# Soupz Quickstart

## 1. Start the daemon

```bash
npx soupz-cockpit
# alias:
# npx soupz
```

## 2. Pair your browser or phone

- Use the terminal QR code or pairing URL
- Enter the 9-character code on `/code` (legacy alias: `/connect`)

## 3. Verify providers

Open Setup Wizard and make sure these are ready:
- Gemini CLI
- Copilot/Codex via `gh` + `gh-copilot`
- Optional: Claude Code, Kiro

## 4. Build workflow

1. Start in Chat mode for planning.
2. Switch to Code mode for file edits and git.
3. Use deep/team orchestration for complex work.

## 5. Troubleshooting

- If pairing fails, verify daemon URL and token in local storage.
- If an agent is missing, check `/api/agents?detailed=true` readiness.
- If setup install fails, use manual install hints in Setup Wizard.
