# Edge Case Testing Checklist

Manual test scenarios for validating Soupz under non-ideal conditions.
Run these before any release or demo.

---

## IDE Mode: Tab & File Management

- [ ] Open 20+ files in IDE mode, verify tab LRU auto-closes oldest when limit exceeded
- [ ] Open a file, edit it, switch tabs, switch back -- edits should persist
- [ ] Open a binary file (image, .woff) -- should show error or "unsupported" rather than crash
- [ ] Open a file > 1MB -- should show a size warning or refuse gracefully (MAX_FILE_SIZE = 1MB)
- [ ] Rapidly switch between 10 tabs -- no flicker, no empty editor flash (skeleton should show)
- [ ] Open same file in two tabs -- should reuse existing tab, not duplicate

## WebSocket Stability

- [ ] Disconnect daemon mid-stream (kill the process) -- dashboard should show reconnect indicator
- [ ] WS reconnects with exponential backoff (check network tab for timing)
- [ ] Send a prompt, kill daemon, restart daemon -- reconnect should happen, old order shows as failed
- [ ] Open 20+ browser tabs to same daemon -- connections 21+ should be rejected (max 20/IP)
- [ ] Leave dashboard idle for 30+ minutes -- heartbeat ping/pong should keep connection alive
- [ ] Switch WiFi networks mid-session -- should detect disconnect and reconnect

## Order Concurrency & Queuing

- [ ] Send 6 orders simultaneously -- first 5 run, 6th queues (MAX_CONCURRENT_ORDERS = 5)
- [ ] Send 6 orders, cancel 1 running -- queued order should start
- [ ] Send an order, disconnect, reconnect -- order should still be running/visible
- [ ] Submit a very long prompt (10,000+ chars) -- should not crash or truncate silently
- [ ] Submit empty prompt -- should be rejected with clear error

## Agent Availability & Routing

- [ ] Use only Copilot (no other agents installed) -- all flows should be fully functional
- [ ] Use only Ollama (local models only) -- should work for basic prompts
- [ ] Use only Gemini -- should work for all prompt types
- [ ] No agents installed at all -- should show clear "install an agent" guidance, not crash
- [ ] Rate limit an agent (send many rapid prompts) -- should trigger 5-min cooldown and fallback
- [ ] Verify Claude Code shows as "Premium (optional)" not as required

## Mobile & Responsive

- [ ] Run `npm run snapshot:mobile` and review generated 360/390/430 captures for layering and overflow regressions
- [ ] Open dashboard on 360px width (small phone) -- all views should be usable
- [ ] Test ConnectPage on mobile -- OTP input should be touch-friendly, no overflow
- [ ] Test SimpleMode (chat) on mobile -- keyboard should not obscure input
- [ ] Test BuilderMode on mobile -- preview panel should stack below chat
- [ ] Rotate phone landscape/portrait mid-session -- layout should adapt
- [ ] Test swipe gestures if any -- should not conflict with browser back/forward

## Pairing Flow

- [ ] Enter wrong OTP code -- should show error, not crash
- [ ] Enter expired code (wait 5+ minutes) -- should show expiration error
- [ ] Pair from mobile, then pair from desktop -- both should work (multi-session)
- [ ] Scan QR code from camera app -- should open connect page with code pre-filled
- [ ] Daemon generates new code every 5 min -- verify old code stops working

## Builder Mode

- [ ] Test on 360px width -- should be usable (centered layout)
- [ ] Submit a build prompt -- preview should render when complete
- [ ] Cancel a build mid-stream -- should stop cleanly
- [ ] Rapid-fire 3 build prompts -- should queue properly

## Deep/Team Mode

- [ ] Trigger "full review" -- should spawn multiple sub-agents
- [ ] One sub-agent fails -- should not block others or crash synthesis
- [ ] All sub-agents time out -- should report timeout, not hang
- [ ] Deep mode with 1 available agent -- should still work (same agent for all workers)

## Network Conditions (Chrome DevTools Throttling)

- [ ] Slow 3G -- pairing should still work, just slower
- [ ] Slow 3G -- file tree loading should show skeleton
- [ ] Offline -- should show clear offline indicator, not blank screen
- [ ] Switch from offline to online -- should reconnect automatically

## Auth & Session

- [ ] Session token expires (24h) -- should prompt re-pairing, not show stale data
- [ ] Supabase JWT refresh on tab focus -- verify no "unauthorized" flash
- [ ] Open dashboard without pairing (no token) -- should redirect to connect page
- [ ] Multiple browser tabs with same session -- should all receive order updates

## File System Security

- [ ] Path traversal attempt (../../etc/passwd) -- should be blocked (403)
- [ ] Write to a read-only file -- should return error, not crash
- [ ] Create file with special characters in name -- should handle or reject gracefully
- [ ] Read a symlink -- should follow or reject, not crash

## Theming

- [ ] Switch between all 12 themes -- no broken colors, no missing variables
- [ ] Theme persists across page refresh (localStorage)
- [ ] Theme works in both Chat and IDE modes
- [ ] Custom CSS properties (--*-ch) work with Tailwind opacity modifiers

## Performance

- [ ] File tree with 1000+ files (large monorepo) -- should not freeze UI
- [ ] Chat with 200+ messages -- scroll should remain smooth
- [ ] Memory panel with 200 shards -- should not slow down
- [ ] Rapid typing in chat input -- no input lag
- [ ] Multiple concurrent agent streams -- UI stays responsive
