# Soupz Browser Extension — Documentation

> Let your AI agents see, navigate, and interact with the websites they build. The bridge between Soupz CLI and the browser.

---

## What Is It?

The Soupz Browser Extension is a **Chrome MV3 extension** that gives Soupz AI agents the ability to:

- **See** what's on a web page (screenshot capture, DOM extraction)
- **Navigate** between pages (follow links, go to URLs)
- **Interact** with elements (click buttons, fill forms)
- **Analyze** page quality (accessibility audit, link count, image analysis)
- **Inspect** specific elements (hover to highlight, click to select)

### Why This Exists

AI CLI tools are **blind** — they can generate HTML/CSS/JS but have no way to see the result. When Soupz builds an ecommerce site, neither Copilot nor Gemini can verify that:

- Images match product names
- Buttons are clickable and properly styled
- The layout isn't broken on different screen sizes
- Colors and fonts match the brand guide
- Accessibility standards are met

The browser extension closes this gap by acting as the AI's **eyes into the browser**. When the Design Agency chef (`@designer`) builds a page, the extension can capture a screenshot and send it back so the AI can evaluate its own work.

### Real-World Use Cases

1. **Visual QA** — After building a page, the AI captures a screenshot and checks for layout issues
2. **Image Verification** — Check that product images match product names on an ecommerce site
3. **Accessibility Audit** — Count images without alt text, inputs without labels, color contrast issues
4. **Content Review** — Extract all visible text from a page for content analysis
5. **Navigation Testing** — Verify that all links work and lead to expected pages
6. **Form Testing** — Programmatically fill and submit forms to test workflows
7. **Competitive Analysis** — Capture and analyze competitor websites for the Researcher chef

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Chrome Browser                                │
│                                                                   │
│  ┌───────────────────┐     ┌───────────────────────────────────┐ │
│  │  Extension Popup  │     │         Active Tab                │ │
│  │  (popup.html/js)  │     │                                   │ │
│  │                   │     │  ┌─────────────────────────────┐  │ │
│  │  [📸 Screenshot]  │     │  │     Content Script          │  │ │
│  │  [🔍 Send DOM]    │     │  │     (content.js)            │  │ │
│  │  [📋 Summary]     │     │  │                             │  │ │
│  │  [Disconnect]     │     │  │  • DOM access               │  │ │
│  └────────┬──────────┘     │  │  • Element highlighting     │  │ │
│           │                │  │  • Page summary             │  │ │
│           │ chrome.runtime │  │  • Visible text extraction   │  │ │
│           │                │  │  • CSS selector generation   │  │ │
│           ▼                │  └─────────────────────────────┘  │ │
│  ┌─────────────────────┐   │                                   │ │
│  │  Service Worker     │◄──┤  chrome.scripting.executeScript   │ │
│  │  (background.js)    │───┤  chrome.tabs.captureVisibleTab    │ │
│  │                     │   └───────────────────────────────────┘ │
│  │  • WebSocket client │                                         │
│  │  • Command handler  │                                         │
│  │  • Auto-reconnect   │                                         │
│  └────────┬────────────┘                                         │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │  WebSocket (ws://localhost:7533)
            │
            ▼
   ┌─────────────────────┐
   │  🫕 Soupz Remote    │
   │     Server          │
   │                     │
   │  Receives:          │
   │  • Screenshots      │
   │  • DOM data         │
   │  • Page summaries   │
   │                     │
   │  Sends commands:    │
   │  • capture_screenshot│
   │  • get_dom          │
   │  • navigate         │
   │  • click_element    │
   │  • evaluate         │
   └─────────────────────┘
```

### Three-Layer Architecture

1. **Popup** (`popup.html` + `popup.js`) — The small UI panel that appears when you click the extension icon. Shows connection status, manual action buttons.

2. **Service Worker** (`service-worker.js`) — The background brain that:
   - Maintains a persistent WebSocket connection to the Soupz Remote Server
   - Receives commands from the server (capture screenshot, get DOM, navigate, etc.)
   - Executes those commands using Chrome APIs
   - Sends results back to the server
   - Auto-reconnects on disconnection (5-second retry)

3. **Content Script** (`content.js`) — Injected into every web page:
   - Has full DOM access to the current page
   - Can highlight elements on hover (inspect mode)
   - Generates CSS selectors for clicked elements
   - Extracts page summaries (stats, accessibility, visible text)

---

## WebSocket Protocol

### Server → Extension (Commands)

| Type | Fields | Description |
|------|--------|-------------|
| `capture_screenshot` | `requestId` | Capture visible tab as PNG data URL |
| `get_dom` | `requestId` | Extract structured DOM: HTML (first 50KB), links, images, headings |
| `navigate` | `requestId`, `url` | Navigate active tab to a URL |
| `click_element` | `requestId`, `selector` | Click element matching CSS selector |
| `evaluate` | `requestId`, `script` | Run arbitrary JavaScript in the page context |

### Extension → Server (Responses)

| Type | Fields | Description |
|------|--------|-------------|
| `screenshot` | `requestId`, `url`, `title`, `dataUrl` | PNG screenshot as base64 data URL |
| `dom_data` | `requestId`, `data` | Structured DOM: HTML, links[], images[], headings[] |
| `navigated` | `requestId`, `url` | Confirmation of navigation |
| `clicked` | `requestId`, `selector` | Confirmation of click |
| `eval_result` | `requestId`, `result` | JavaScript evaluation result |

### DOM Data Shape

```json
{
  "html": "<!DOCTYPE html>...",
  "title": "My Ecommerce Store",
  "url": "http://localhost:3000",
  "links": [
    { "text": "Shop Now", "href": "http://localhost:3000/shop" }
  ],
  "images": [
    { "alt": "Black Hoodie", "src": "/images/hoodie.jpg", "width": 400, "height": 400 }
  ],
  "headings": [
    { "tag": "H1", "text": "Welcome to the Store" },
    { "tag": "H2", "text": "Featured Products" }
  ]
}
```

### Page Summary Shape

```json
{
  "url": "http://localhost:3000",
  "title": "My Store",
  "meta": {
    "description": "Best streetwear online",
    "viewport": "width=device-width, initial-scale=1"
  },
  "stats": {
    "links": 42,
    "images": 15,
    "buttons": 8,
    "inputs": 3,
    "headings": 12
  },
  "accessibility": {
    "imagesWithoutAlt": 3,
    "inputsWithoutLabel": 1
  },
  "colors": "rgb(26, 26, 46)",
  "fontSize": "16px"
}
```

---

## Setup & Usage

### Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the folder: `packages/browser-extension/`
5. The Soupz Bridge icon (🫕) appears in the toolbar

### Connecting

1. Start the Soupz Remote Server on your laptop:
   ```bash
   cd packages/remote-server && npm start
   ```
2. Click the Soupz Bridge icon in Chrome
3. Enter the server URL (default: `ws://localhost:7533`)
4. Click **Connect**
5. Green dot = connected ✅

### Manual Actions (from Popup)

| Button | Action |
|--------|--------|
| 📸 **Capture Screenshot** | Sends a screenshot of the current tab to the server |
| 🔍 **Send DOM** | Sends page structure (links, images, headings) to the server |
| 📋 **Page Summary** | Shows quick stats: link count, image count, accessibility issues |

### Programmatic Actions (from Server)

The Soupz server (or any WebSocket client) can send commands to the extension. This is how AI agents interact with the browser:

```javascript
// From the server, tell the extension to capture a screenshot
ws.send(JSON.stringify({
  type: 'capture_screenshot',
  requestId: 'req-001'
}));

// Navigate to a URL
ws.send(JSON.stringify({
  type: 'navigate',
  requestId: 'req-002',
  url: 'http://localhost:3000/products'
}));

// Click a button
ws.send(JSON.stringify({
  type: 'click_element',
  requestId: 'req-003',
  selector: '#add-to-cart'
}));

// Run JavaScript in the page
ws.send(JSON.stringify({
  type: 'evaluate',
  requestId: 'req-004',
  script: 'document.querySelectorAll("img").length'
}));
```

---

## Element Inspector

The content script includes an **inspect mode** that works like Chrome DevTools' element selector:

1. Enable inspect mode (triggered via `start_inspect` message)
2. As you hover over elements, a red highlight overlay follows your mouse
3. Click an element to select it
4. The extension sends back:
   - CSS selector (generated automatically)
   - HTML tag name
   - Text content (first 200 chars)
   - All attributes

### CSS Selector Generation Strategy

The content script generates the most specific, stable selector it can:

1. **ID** — If the element has an `id`, use `#elementId` (most stable)
2. **Unique class** — If the element has classes that uniquely identify it, use `.class1.class2`
3. **Path-based** — Build a path from parent elements using `tag:nth-child(n)` selectors

---

## How AI Agents Use This

### Workflow: Visual QA After Building a Page

```
1. @designer builds an ecommerce page → outputs HTML file
2. User opens the HTML file in Chrome
3. Soupz server sends `capture_screenshot` command
4. Extension captures and returns the screenshot
5. Server forwards screenshot to Gemini (multi-modal) for analysis
6. Gemini reports: "The product image for 'Phantom Hoodie' shows an orange
   t-shirt instead of a hoodie. The cart icon appears twice in the header."
7. @designer gets the feedback and fixes the issues
```

### Workflow: Accessibility Audit

```
1. User navigates to their website in Chrome
2. Soupz server sends `get_dom` command
3. Extension returns structured DOM with images[], links[], headings[]
4. QA Engineer chef analyzes:
   - 3 images without alt text
   - 1 form input without a label
   - No H1 heading found
5. Generates fix recommendations
```

### Workflow: Competitive Analysis

```
1. User navigates to a competitor's website
2. Extension captures screenshot + DOM + visible text
3. Researcher chef analyzes:
   - Pricing structure
   - Feature list
   - Messaging and positioning
   - UX patterns
4. Generates competitive analysis report
```

---

## Security & Privacy

### Permissions Explained

| Permission | Why | Risk Level |
|------------|-----|------------|
| `activeTab` | Capture screenshots of the current tab | Low — only active tab |
| `scripting` | Inject content script and run JavaScript | Medium — can read page content |
| `storage` | Save connection settings | Low — only stores URL |
| `<all_urls>` | Content script runs on all pages | Medium — needed for universal DOM access |

### Privacy Commitments

- **No data sent to third parties** — everything goes to YOUR local Soupz server
- **No tracking or analytics** — zero telemetry
- **No background data collection** — only captures when explicitly commanded
- **Local-only by default** — server runs on localhost

### Risks to Be Aware Of

1. **Sensitive page data** — If you're on a banking site and trigger "Send DOM", the extension sends that page's content to the server. Be mindful of what tab is active.
2. **JavaScript evaluation** — The `evaluate` command can run arbitrary JS in the page. If the server is compromised, this is a risk.
3. **No auth on WebSocket** — Currently, any WebSocket client can connect to the extension's server. Future versions will add authentication.

---

## File Structure

```
packages/browser-extension/
├── manifest.json                    # Chrome MV3 manifest
├── icons/
│   ├── README.md                    # Icon generation instructions
│   ├── icon16.png                   # Toolbar icon (16×16)
│   ├── icon48.png                   # Extensions page (48×48)
│   └── icon128.png                  # Chrome Web Store (128×128)
└── src/
    ├── background/
    │   └── service-worker.js        # WebSocket client, command handler
    ├── content/
    │   └── content.js               # DOM access, element inspector
    └── popup/
        ├── popup.html               # Extension popup UI
        └── popup.js                 # Popup controller
```

---

## Customizing the Extension

### Change the Server URL Default

Edit `service-worker.js` line 4:
```javascript
const DEFAULT_SERVER = 'ws://your-custom-url:7533';
```

### Add New Commands

1. Add a new `case` in `handleServerMessage()` in `service-worker.js`
2. Use Chrome APIs (`chrome.tabs`, `chrome.scripting`, etc.)
3. Send results back via `ws.send(JSON.stringify({...}))`

### Add New Content Script Features

1. Add a new `case` in the `chrome.runtime.onMessage.addListener` in `content.js`
2. Access DOM directly (you're running in the page context)
3. Return data via `sendResponse()`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension not appearing | Check `chrome://extensions/` → Developer mode ON → Load unpacked |
| "Not connected" after clicking Connect | Is the remote server running? (`npm start` in `packages/remote-server`) |
| Screenshots are blank | Chrome can't capture `chrome://` pages or extension pages |
| DOM data is empty | The page might block content scripts (CSP). Try a different page |
| Auto-reconnect not working | Check if the server crashed. Restart it. |
| Permission errors | Reload the extension on `chrome://extensions/` |

---

## Roadmap

- [ ] **Firefox support** — Port to Firefox's MV3 (similar but different APIs)
- [ ] **Auth tokens** — Require authentication before WebSocket accepts commands
- [ ] **Visual diff** — Compare two screenshots and highlight differences
- [ ] **Performance metrics** — Capture Core Web Vitals (LCP, FID, CLS) from the page
- [ ] **Network interception** — Monitor API calls the page makes
- [ ] **Form auto-fill** — AI fills forms with test data for E2E testing
- [ ] **Responsive testing** — Resize viewport and capture at multiple breakpoints
- [ ] **Video recording** — Record user session for UX analysis
- [ ] **AI annotation** — Overlay AI suggestions directly on the page (like a design review)
- [ ] **Chrome Web Store publication** — Package and publish for public install
