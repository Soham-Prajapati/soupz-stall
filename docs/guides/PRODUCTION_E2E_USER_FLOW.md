# Production E2E User Flow and System Architecture

Updated: April 2, 2026
Owner: Product + Platform

## Goal

Define the exact end-to-end user journey and runtime system flow for a production launch.
This document is the source of truth for:
- First-run onboarding from landing page to active coding session.
- Authentication requirements at each step.
- Prompt delivery path (web to daemon, local and remote).
- Reload resilience requirements.
- Remote access expectations without requiring users to manually run Cloudflare.

## 9-Second Clarity Rule (Landing)

A new user must understand, within 9 seconds:
1. What it is: "Run AI coding agents on your own machine. Control them from any browser."
2. First action: "Run npx soupz on your machine."
3. Outcome: "Pair phone/laptop and start prompting immediately."

Landing copy should always include these three ideas above the fold.

## Canonical First-Time User Flow

### 1. Website Entry
- User opens soupz.vercel.app.
- Primary CTA shows command: npx soupz.
- Secondary CTA routes to docs/connect flow.

### 2. Local Daemon Start
- User runs npx soupz.
- Daemon starts on local port (default 7533).
- Daemon generates 9-char one-time pairing code and QR.
- Daemon also computes reachable targets (LAN/tunnel when available).

### 3. Pairing
- User opens /code (or scans QR).
- User enters code.
- Backend validates code and issues daemon session token.
- Frontend persists:
  - daemon token
  - daemon base URL (must be daemon endpoint, never website origin)
  - hostname metadata

### 4. Post-Pair Connect
- UI routes to /dashboard.
- Health check loop verifies daemon connectivity.
- Agent availability probe runs and renders installed/ready/reason states.

### 5. Prompt Execution
- User sends prompt from Chat/IDE/Core Console.
- Dashboard sends POST /api/orders to daemon using stored daemon URL + token.
- Streaming output returns over daemon WebSocket.
- Order status events update UI panels.

## Authentication and Login Requirements

### Required
- Pairing code validation (device pairing).
- Daemon session token for non-local access.

### Optional (product account)
- Supabase login for cross-device profile/settings sync and cloud relay UX.
- User can still run local-only pairing flow without product account in local mode.

### Agent-level auth
- Gemini, Copilot, Codex, Claude, etc. may require their own CLI auth.
- Agent readiness must display explicit reasons (not logged in, extension missing, model unavailable).

## Prompt and Data Flow Architecture

### Local Path (primary)
1. Browser -> daemon REST (/api/orders)
2. Daemon -> CLI subprocesses
3. CLI output -> daemon stream
4. Daemon WebSocket -> browser chunks/events

### Remote Path (paired web/phone)
1. Browser uses stored daemon base URL from pairing.
2. Token-auth REST/WebSocket to daemon.
3. If direct path unavailable, controlled relay fallback can be used where configured.

### Supabase role
- Pairing code discovery and metadata.
- Optional relay and profile persistence.
- Not the primary execution engine for local prompt runtime.

## Remote Access Without Manual Cloudflare Commands

Product requirement: no manual tunnel commands for normal users.

Acceptable production options:
1. Automatic managed tunnel startup by daemon when needed.
2. Built-in relay mode with predictable latency and clear "connected via relay" badge.
3. LAN-first path with automatic fallback to managed remote path.

Not acceptable:
- Asking user to manually run Cloudflare/ngrok commands as required onboarding.

## Reload and Session Resilience Requirements

Reload must never destroy active connection state when token/session is valid.

Required persisted state:
- daemon URL (validated daemon endpoint)
- daemon token and issued-at metadata
- workspace root selection
- chosen mode/theme/agent settings

Required behavior:
- On refresh, app rehydrates daemon URL + token before first health probe.
- Transient availability probe failures do not overwrite last-known-good agent status.
- Same-origin pairing responses must not replace daemon URL with website origin.

## Terminal and Output UX Requirements

- Output panel should be minimal and readable by default.
- Distinguish clearly:
  - terminal sessions
  - worker process lanes
  - synthesis status
- No contradictory status labels across Core Console and Agent Dashboard.

## Source Visibility Policy (Pre-Open-Source)

Until open-source launch decision:
- Public UI should not promote source repository links.
- Docs should focus on usage, setup, and behavior, not internals requiring repo access.
- Keep private implementation details in internal docs.

## Current Risk Areas to Close Before Weekend

1. Connection resilience
- Verify daemon URL/token persistence on all pairing paths.
- Verify reconnect behavior on refresh and network flap.

2. Onboarding clarity
- Ensure 9-second landing message and first action are unambiguous.
- Remove conflicting CTAs that distract from npx soupz + pair.

3. Runtime consistency
- Keep agent detection stable under temporary probe/network failures.
- Ensure installed standalone CLIs are detected reliably.

4. Remote path quality
- Document and enforce automatic remote strategy without manual tunnel commands.

5. Docs quality
- Keep /docs as operationally useful, not placeholder marketing.

## Weekend Go/No-Go Checklist

Go only if all are true:
- Pairing smoke check passes reliably.
- Daemon integration tests are green.
- Dashboard build is green.
- Reload from /core and /dashboard preserves connectivity and agent status.
- New user can complete first prompt without reading source code.

No-Go triggers:
- Connection state lost on reload.
- Agent state flips to all missing while daemon is actually reachable.
- Onboarding requires hidden tribal knowledge.
