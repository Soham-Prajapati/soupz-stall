# OPENAI.md — Soupz Agents Expectations for ChatGPT

This repo already has persona manifests for Gemini (`.gemini.md`) and Claude (`CLAUDE.md`). This note is the dedicated operating profile for OpenAI models working on Soupz. Skim this before every session and pair it with `AUDIT_AND_USP.md` + `TODO_TERMINALS.md` so we never stomp on the shared timeline.

## 1. Boot Checklist (do this first)
1. Read `AUDIT_AND_USP.md` for the up-to-date product truth and non-negotiable UX rules.
2. Read `TODO_TERMINALS.md`, lock any task you touch by flipping `[ ]` → `[/]`, and clear the lock when you are done.
3. Glance at `.gemini.md` and `CLAUDE.md` for architecture references so our answers never drift.
4. Update `last-output.html` using the tab/panel recipe inside `.gemini.md` after every material change.

## 2. Style & Communication Rules
- English only. Succinct, honest, and specific. No hype, no fake screenshots, no "it probably works" language.
- Never invent working features. If we stub something, say it is stubbed and describe the real plan.
- Respect existing naming: the orchestrator persona is `soupz-orchestrator`, the product is Soupz Stall.

## 3. UI & UX Guardrails
- Keep every UI element functional. No ghost buttons, no dead navigation, no decorative panels.
- Honor the 12-theme system (CSS vars only, no inline hardcoded colors). Switch themes via the runtime switcher.
- Prefer borders to shadows, keep spacing on the 8/16/24 grid, and stick to font weights 400/500/600.
- All dropdowns/menus must remain keyboard-friendly and scroll-safe (no overflowing menus on mobile).

## 4. Logic & Data Integrity
- Git metadata must come from the real repo (`git rev-parse`, `git status`), never from hardcoded strings.
- File trees, diffs, and status indicators must respect the currently selected workspace root.
- When talking to the daemon, always pass the active `root` so cross-folder editing stays accurate.
- Error states should be explicit and traceable—log them to the console and bubble useful copy to the UI.

## 5. Testing & Verification
- Run `node --check` on backend files you touch, and `npx vite build` / targeted tests for frontend work when feasible.
- If you can’t run a check, explain why and list the commands the human should run.
- Never stage/commit code unless the user explicitly asks. When asked, use their configured git identity, no AI attribution.

## 6. Source of Truth Inventory
| Purpose | File |
|---------|------|
| Product positioning & promises | `AUDIT_AND_USP.md` |
| Active terminal tasks           | `TODO_TERMINALS.md` |
| Gemini runtime contract         | `.gemini.md` |
| Claude runtime contract         | `CLAUDE.md` |
| Pending logic work              | `LOGIC_PENDING_TODO.md` |
| Tests & review notes            | `tests/` directory |

Keep this doc in sync if expectations change. If something conflicts, defer to `AUDIT_AND_USP.md` or an explicit user instruction.
