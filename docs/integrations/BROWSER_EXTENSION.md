# 🔌 Soupz Cloud Kitchen — Browser Extension

The Soupz Browser Extension is a Chrome MV3 extension that bridges your browser to the Soupz Stall AI agents. It gives your CLI agents the ability to **see**, **navigate**, and **interact** with websites — this is the "AI Vision" system.

---

## Overview

When your AI agent needs to check how a website looks, inspect DOM elements, click buttons, or read page content, it sends commands through the Cloud Kitchen server to the browser extension. The extension executes those commands in the active tab and sends results back.

```
┌──────────────┐     CLI prompts AI     ┌──────────────┐     WebSocket     ┌──────────────────┐
│  soupz-stall │ ──────────────────►   │  AI Agent    │ ──────────────►  │ Cloud Kitchen    │
│  (Terminal)  │                        │  (Copilot/   │                  │ (Remote Server)  │
│              │ ◄──────────────────    │   Gemini)    │ ◄──────────────  │ port 7533        │
│  shows result│     AI responds        │              │    results       │                  │
└──────────────┘                        └──────────────┘                  └────────┬─────────┘
                                                                                  │ WebSocket
                                                                         ┌────────┴─────────┐
                                                                         │ Browser Extension │
                                                                         │ (Chrome Side      │
                                                                         │  Panel)           │
                                                                         │                   │
                                                                         │ • Screenshot      │
                                                                         │ • DOM inspection  │
                                                                         │ • Navigation      │
                                                                         │ • Click elements  │
                                                                         │ • JS evaluation   │
                                                                         └───────────────────┘
```

## Installation

### Load as Unpacked Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select `packages/browser-extension/`
4. Pin the 🫕 icon in your toolbar

### Connect to Kitchen

1. Start `soupz-stall` on your laptop (Cloud Kitchen auto-starts)
2. Click the 🫕 icon → Side Panel opens
3. Type `/cloud-kitchen` in your terminal to see the OTP
4. Enter the 8-digit code in the Side Panel
5. Click "Connect to Kitchen"

The extension stays connected until you close the Side Panel or click "Close Bridge".

## AI Vision Capabilities

### 📸 Screenshot Capture
The AI agent can request a screenshot of the currently active tab.

**Server command**: `capture_screenshot`
**Returns**: PNG data URL of the visible viewport

Use case: AI checks if its generated HTML looks correct, verifies CSS changes, or inspects a live website.

### 🔍 DOM Inspection
The AI agent can request a structured analysis of the page DOM.

**Server command**: `get_dom`
**Returns**:
- First 50KB of HTML
- Page title and URL
- Up to 50 links with text/href
- Up to 30 images with alt/src/dimensions
- All h1-h3 headings

Use case: AI understands page structure without needing to render it.

### 🧭 Navigation
The AI agent can navigate the browser to any URL.

**Server command**: `navigate` with `url` field
**Returns**: Confirmation of navigation

Use case: AI can browse documentation, test deployed apps, or research APIs.

### 🎯 Click Elements
The AI agent can click any element by CSS selector.

**Server command**: `click_element` with `selector` field
**Returns**: Confirmation of click

Use case: AI can interact with web forms, test button flows, or automate browser tasks.

### ⚡ JavaScript Evaluation
The AI agent can execute arbitrary JavaScript in the page context.

**Server command**: `evaluate` with `script` field
**Returns**: The result of the evaluated expression

Use case: AI can extract specific data, manipulate state, or test frontend logic.

## Side Panel Features

When connected, the Side Panel shows:

| Button | Action | Description |
|--------|--------|-------------|
| 📸 Snapshot | `manual_capture` | Captures a screenshot and sends it to the server |
| 🔍 Ingredients | `manual_dom` | Sends DOM structure to the server |
| 📋 Receipt | `get_page_summary` | Shows a styled "receipt" with page stats |
| 🎯 Inspect | `start_inspect` | Enables element picker (click to select) |

### Element Inspector
When you click "Inspect":
1. A red highlight overlay follows your cursor
2. Click any element to select it
3. The extension generates a CSS selector and sends element details
4. The overlay automatically dismisses

### Page Receipt
Shows a styled "kitchen receipt" with:
- Number of links, images, buttons, inputs, headings
- Accessibility issues (images without alt, inputs without labels)
- Current URL and timestamp

## Security

- **OTP Pairing** — same system as mobile app (8-digit code, 5-min expiry)
- **Session Tokens** — 64-char hex, validated on every message
- **Auto-Reconnect** — restores from `chrome.storage.local` on extension reload
- **No External Requests** — all communication is local (localhost/LAN)

## Architecture

### Manifest V3

```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "scripting", "storage", "sidePanel"],
  "host_permissions": ["<all_urls>"],
  "side_panel": { "default_path": "src/popup/popup.html" },
  "background": { "service_worker": "src/background/service-worker.js", "type": "module" },
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["src/content/content.js"] }]
}
```

### File Structure

```
packages/browser-extension/
├── manifest.json              # Chrome MV3 manifest
├── icons/                     # Extension icons (16, 48, 128px)
├── src/
│   ├── background/
│   │   └── service-worker.js  # WebSocket bridge, auth, message routing
│   ├── content/
│   │   └── content.js         # Page injection, inspector, DOM access
│   └── popup/
│       ├── popup.html         # Side Panel UI (glassmorphism theme)
│       └── popup.js           # Pairing, actions, receipt display
```

### Service Worker
- Manages WebSocket connection to Cloud Kitchen server
- Handles OTP pairing via REST API
- Routes server commands to content script
- Auto-reconnects on connection loss
- Stores session in `chrome.storage.local`

### Content Script
- Injected into every page at `document_idle`
- Provides element inspector with hover highlight
- Generates unique CSS selectors for elements
- Extracts page summaries and visible text
- Minimal footprint — only activates when messaged
