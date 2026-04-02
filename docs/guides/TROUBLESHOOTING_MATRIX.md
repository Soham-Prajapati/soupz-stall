# Troubleshooting Matrix (by Provider)

*Updated: April 3, 2026*

This matrix provides specific remediation steps for common issues encountered when using different AI providers within Soupz.

## 🔗 Universal Troubleshooting Steps
1. **Restart the local daemon**: `npx soupz` (or `npm run dev:web` in dev mode).
2. **Refresh the browser UI**: `Cmd+Shift+R` (hard refresh).
3. **Check CLI presence**: Run `/api/system/check-clis` in the Core Console.
4. **Update CLIs**: Ensure the underlying CLI tools (`gh`, `gemini`, `claude`, `ollama`) are up to date.

---

## 💎 Gemini (`gemini`)
| Issue | Symptom | Remediation |
|---|---|---|
| **Quota Exhaustion** | 429 Too Many Requests | Switch to a different provider or wait for the quota to reset. Gemini free tier has rate limits. |
| **Authentication Error** | `gcloud auth login` required | Run `gcloud auth application-default login` in your terminal. |
| **Model Not Found** | Error in stderr | Run `gemini list-models` (manually) or `/api/models/refresh` to re-probe. |

---

## 🤖 GitHub Copilot (`copilot`)
| Issue | Symptom | Remediation |
|---|---|---|
| **Authentication Failed** | `gh auth login` required | Run `gh auth login` and ensure the Copilot extension is installed. |
| **No Access** | `Your account is not authorized` | Ensure your GitHub account has an active Copilot subscription or is part of a trial. |
| **Tool Failures** | Errors when using `gh copilot --allow-all-tools` | Some tools might be restricted by your organization's policy. Check your GitHub settings. |

---

## 📜 Codex (`codex`)
| Issue | Symptom | Remediation |
|---|---|---|
| **Legacy Access** | `gh copilot` fallback | Codex is often used as a specialist model through Copilot. Ensure Copilot is correctly configured. |
| **Slow Streaming** | Chunks arrive in large bursts | Normal for some Codex models. Check network latency or switch to a `fast` tier model. |

---

## 🦞 Claude Code (`claude-code`)
| Issue | Symptom | Remediation |
|---|---|---|
| **Not Installed** | `claude` not found | Install with `npm install -g @anthropic-ai/claude-code`. |
| **Subscription Required** | `Pro subscription needed` | Claude Code is a premium provider. Ensure you have an active Anthropic account with sufficient balance/subscription. |
| **Timeout** | CLI hangs | Claude Code often runs extensive file reads. Increase the timeout in `src/session/index.js` if necessary. |

---

## 🦙 Ollama (`ollama`)
| Issue | Symptom | Remediation |
|---|---|---|
| **Daemon Not Running** | `Connection refused` | Ensure the Ollama app or server is running locally (`ollama serve`). |
| **Model Not Downloaded** | `Model 'x' not found` | Run `ollama pull qwen2.5:1.5b` (or your preferred model) in your terminal. |
| **High Resource Use** | Laptop fan noise / system lag | Ollama runs models locally. Use smaller models (e.g., `1.5b` or `3b`) if your hardware is struggling. |

---

## 🪐 Kiro (`kiro-cli`)
| Issue | Symptom | Remediation |
|---|---|---|
| **Key Missing** | `KIRO_API_KEY` not set | Ensure the API key is in your local `.env` or set in your environment. |
| **Regional Outage** | 503 Service Unavailable | Check Kiro's status page or switch to a fallback provider like Gemini or Copilot. |

---

## 📡 Remote Connectivity (Pairing)
| Issue | Symptom | Remediation |
|---|---|---|
| **Tunnel Creation Failed** | Code generated, but UI says `Unreachable` | Ensure `SOUPZ_ENABLE_FREE_TUNNELS=1`. Check if your network/firewall blocks SSH-based tunnels. |
| **OTP Mismatch** | `Invalid code` | Codes rotate every few minutes. Ensure you are using the *current* code from the CLI output. |
| **Supabase Relay Lag** | Messages take seconds to appear | Check your internet connection or switch to the direct local URL (`localhost:7534`) if you are on the same machine. |
