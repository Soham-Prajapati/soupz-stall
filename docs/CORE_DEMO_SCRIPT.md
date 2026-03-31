# Soupz Core Console — 5-Min Demo Script

**Goal:** record a concise video that explains what Soupz is, pairs a device, shows the /core cockpit orchestrating a deep task, and highlights live preview + archives.

## 0: Setup (off camera)
1. Run `npx soupz` on laptop so the daemon prints a pairing QR / code.
2. Start a Vite dev server (e.g., `npm run dev`) inside the repo so the live preview iframe has something to show.
3. Open the dashboard (`soupz.vercel.app`) and keep `/core` tab ready but unpaired.

## 1: Hook (0:00–0:45)
- Cold open on the /core page: “This is Soupz Core Console, a cockpit that lets me run my laptop’s AI agents from my phone.”
- Highlight the agent dropdown (Gemini, Copilot, etc.) and mention the new auto detection (“It knows exactly which CLIs are installed and refuses to run if Copilot isn’t available, so no more mystery failures.”)
- Briefly mention `_soupz_output` archives and the promise of reviewing every run.

## 2: Pairing & Live Preview (0:45–1:30)
- Click “Pair Device” (or use the QR handoff). Show the deep-link auto-filling the code.
- Once paired, point out the status bar now showing the connected machine plus the **Preview** badge (pulled from the detected dev server).
- Open the preview in a new tab to prove you can view the running app from the phone/browser.
- Back in /core, tap the new Preview toggle so the live iframe sits beside chat—viewers can watch the UI update as the run progresses.

## 3: Launch Deep Orchestration (1:30–3:30)
- Paste the “Deep Multi-Agent Stress Prompt” preset.
- Enable “AI planner” and pick `deep (parallel)` mode.
- Narrate what happens: planner plan appears, specialists queue up, verification, synthesis. Use the new agent lanes (if the UI shows them) or mention that the daemon stream is now archived to `.soupz/output/<timestamp>`.
- While the task runs, explain the philosophy: Soupz decomposes tasks, routes them to whatever provider is free (Gemini, Copilot, Codex, Kiro), retries when a CLI disappears, and keeps the entire conversation mobile-friendly.

## 4: Inspect Results (3:30–4:30)
- Scroll through the task output in /core. Highlight the structured worker sections and the verification step.
- Switch to the Git panel to show the diff viewer with per-file pills and syntax colors.
- Show the new “Generate Message” streaming UI (it now actually streams text instead of failing silently).
- Mention that you can drag a file from the explorer straight into chat as an `@path` reference.

## 5: Wrap & Call-to-Action (4:30–5:00)
- Summarize: “One command (`npx soupz-cockpit`), pair from anywhere, run your laptop’s agents, review `_soupz_output` for every task, and keep building even when Copilot tokens are gone.”
- Flash the repo URL / npm name, encourage viewers to try the `/core` cockpit and send feedback.
