# Soupz Core Console — 5-Min Demo Script

**Goal:** Record a concise video that explains what Soupz is, pairs a device, shows the /core cockpit orchestrating a deep task, and highlights live preview + archives.

## 0: Setup (off-camera)
1. **Ensure all agents are un-authenticated** (if testing setup flow) or **all ready** (if testing execution).
2. Run `npx soupz` on laptop. **Deterministic check:** Verify "Pairing code: [9-char]" is visible.
3. Start a Vite dev server (e.g., `npm run dev`) inside the repo.
4. Open the dashboard (`soupz.vercel.app/connect`) and keep the input field empty.

---

## 1: Hook & Connect (0:00–1:00)
- **Action:** Point at the laptop terminal. “This is my local AI setup—Gemini, Copilot, and Claude are all here, but I want to use them from my phone.”
- **Action:** Scan the QR code or type the 9-char code on the phone.
- **Narration:** “With one command, I have a remote cockpit. No open ports, just local execution.”
- **Fallback:** If QR scan fails, type manually. If connection fails, check `SOUPZ_ENABLE_FREE_TUNNELS=1` and retry.
- **Clarification:** Cloudflare quick tunnels used by Soupz do not require paid plans or account signup for basic use.
- **Alternative path:** If you do not want Cloudflare, use ngrok or Tailscale Funnel and set `SOUPZ_TUNNEL_URL` to that public daemon URL.

---

## 2: The Cockpit (/core) (1:00–2:00)
- **Action:** Navigate to `/core`. 
- **Action:** Point at the status bar. “It knows exactly what's running. Gemini is ready, Copilot is ready.”
- **Action:** Enable **Preview** toggle. Show the Vite app running in the side-pane.
- **Narration:** “This isn't just a chat; it's a workspace. I have the terminal, the git panel, and a live preview of my dev server, all in one browser tab.”

---

## 3: Multi-Agent Execution (2:00–4:00)
- **Action:** Paste a complex prompt: *“Analyze the current system architecture and propose a security hardening plan for the file system API.”*
- **Action:** Select **Deep** mode.
- **Action:** Watch the **AI Planner** kick in. “The planner is decomposing the task. It's assigning the audit to Gemini and the hardening plan to Copilot.”
- **Narration:** “Soupz orchestrates multiple agents in parallel. If Copilot hits a rate limit, the system automatically falls back to Gemini or another available agent.”
- **Fallback:** If a CLI agent hangs, use the **Cancel** button and switch to **Single Agent** mode to show a faster recovery.

---

## 4: Inspect & Commit (4:00–4:45)
- **Action:** Scroll through the synthesis output.
- **Action:** Open the **Git** panel. Show the diff.
- **Action:** Click “Generate Commit Message.”
- **Narration:** “I can review the changes, see the diff with full syntax highlighting, and commit—all from my phone while I'm away from my desk.”

---

## 5: Wrap (4:45–5:00)
- **Narration:** “Local-first, multi-agent, and mobile-ready. That’s Soupz Cockpit. Run `npx soupz` to get started.”
- **Action:** Close with the repo/URL on screen.

---

## 🛠️ Fallback Matrix (If things go wrong live)

| Scenario | Fallback Action |
|---|---|
| **Tunnel Connection Timeout** | Refresh the page. Use the local IP if on the same Wi-Fi. |
| **Avoid Cloudflare** | Use ngrok or Tailscale Funnel, then export `SOUPZ_TUNNEL_URL=https://your-public-url` before `npx soupz`. |
| **Agent Rate Limit** | Soupz will auto-retry with a different provider. Narrate this as a feature! |
| **Dev Server Not Detected** | Manually enter the port (e.g., `5173`) in the Preview settings. |
| **STT/Voice Errors** | Use the keyboard. Mention that browser permissions vary. |
| **WebSocket Disconnect** | Watch the status bar. It will auto-reconnect with exponential backoff. |
