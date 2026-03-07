// Soupz Browser Extension — Background Service Worker
// Bridges browser tab data to the Soupz Remote Server via WebSocket
// Uses OTP pairing code for authentication (like iCloud Keychain)

let ws = null;
let serverUrl = '';
let sessionToken = null;
let authenticated = false;

// Connect and authenticate with token
function connectWithToken(url, token) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    serverUrl = url;
    sessionToken = token;
    authenticated = false;

    ws = new WebSocket(url);

    ws.onopen = () => {
        // Send auth immediately on connect
        ws.send(JSON.stringify({ type: 'auth', token: sessionToken, clientType: 'browser-extension' }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'auth_success') {
            authenticated = true;
            chrome.storage.local.set({ connected: true, serverUrl, sessionToken, hostname: msg.hostname });
            broadcastStatus(true, msg.hostname);
            console.log('🫕 Authenticated with Soupz Cloud Kitchen');
            return;
        }

        if (msg.type === 'auth_failed') {
            authenticated = false;
            chrome.storage.local.set({ connected: false, sessionToken: null });
            broadcastStatus(false);
            console.error('🫕 Auth failed:', msg.message);
            return;
        }

        if (msg.type === 'logged_out') {
            authenticated = false;
            chrome.storage.local.set({ connected: false, sessionToken: null });
            broadcastStatus(false);
            return;
        }

        if (authenticated) handleServerMessage(msg);
    };

    ws.onclose = () => {
        const wasAuth = authenticated;
        authenticated = false;
        chrome.storage.local.set({ connected: false });
        broadcastStatus(false);
        // Auto-reconnect if we had a valid session
        if (wasAuth && sessionToken) {
            setTimeout(() => connectWithToken(serverUrl, sessionToken), 5000);
        }
    };

    ws.onerror = () => {
        authenticated = false;
        chrome.storage.local.set({ connected: false });
        broadcastStatus(false);
    };
}

// Pair with a code (one-time), get token, then connect
async function pairWithCode(host, port, code) {
    const baseUrl = `http://${host}:${port}`;

    try {
        const res = await fetch(`${baseUrl}/pair/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!res.ok) {
            return { ok: false, error: data.error || 'Invalid or expired pairing code' };
        }

        // Got token — save it and connect WebSocket
        sessionToken = data.token;
        chrome.storage.local.set({ sessionToken, serverUrl: `ws://${host}:${port}` });
        connectWithToken(`ws://${host}:${port}`, data.token);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: `Could not reach server: ${err.message}` };
    }
}

function broadcastStatus(connected, hostname) {
    chrome.runtime.sendMessage({ type: 'status', connected, hostname }).catch(() => {});
}

// Handle commands from Soupz server
async function handleServerMessage(msg) {
    switch (msg.type) {
        case 'capture_screenshot': {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 80 });
                ws.send(JSON.stringify({
                    type: 'screenshot',
                    requestId: msg.requestId,
                    url: tab.url,
                    title: tab.title,
                    dataUrl,
                }));
            }
            break;
        }

        case 'get_dom': {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => ({
                        html: document.documentElement.outerHTML.substring(0, 50000),
                        title: document.title,
                        url: window.location.href,
                        links: [...document.querySelectorAll('a')].slice(0, 50).map(a => ({
                            text: a.textContent.trim().substring(0, 100),
                            href: a.href,
                        })),
                        images: [...document.querySelectorAll('img')].slice(0, 30).map(img => ({
                            alt: img.alt,
                            src: img.src,
                            width: img.naturalWidth,
                            height: img.naturalHeight,
                        })),
                        headings: [...document.querySelectorAll('h1,h2,h3')].map(h => ({
                            tag: h.tagName,
                            text: h.textContent.trim().substring(0, 200),
                        })),
                    }),
                });
                ws.send(JSON.stringify({
                    type: 'dom_data',
                    requestId: msg.requestId,
                    data: result.result,
                }));
            }
            break;
        }

        case 'navigate': {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && msg.url) {
                await chrome.tabs.update(tab.id, { url: msg.url });
                ws.send(JSON.stringify({ type: 'navigated', requestId: msg.requestId, url: msg.url }));
            }
            break;
        }

        case 'click_element': {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && msg.selector) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (selector) => {
                        const el = document.querySelector(selector);
                        if (el) el.click();
                        return !!el;
                    },
                    args: [msg.selector],
                });
                ws.send(JSON.stringify({ type: 'clicked', requestId: msg.requestId, selector: msg.selector }));
            }
            break;
        }

        case 'evaluate': {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && msg.script) {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: new Function('return (' + msg.script + ')'),
                });
                ws.send(JSON.stringify({
                    type: 'eval_result',
                    requestId: msg.requestId,
                    result: result.result,
                }));
            }
            break;
        }
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'pair') {
        pairWithCode(msg.host, msg.port, msg.code).then(sendResponse);
        return true; // async
    } else if (msg.type === 'reconnect') {
        // Reconnect with saved token
        if (msg.serverUrl && msg.token) {
            connectWithToken(msg.serverUrl, msg.token);
        }
        sendResponse({ ok: true });
    } else if (msg.type === 'disconnect') {
        if (ws && authenticated) {
            ws.send(JSON.stringify({ type: 'logout' }));
        }
        if (ws) ws.close();
        sessionToken = null;
        authenticated = false;
        chrome.storage.local.set({ connected: false, sessionToken: null });
        sendResponse({ ok: true });
    } else if (msg.type === 'get_status') {
        sendResponse({ connected: authenticated, serverUrl, hostname: '' });
    } else if (msg.type === 'manual_capture') {
        handleServerMessage({ type: 'capture_screenshot', requestId: 'manual' });
        sendResponse({ ok: true });
    }
    return true;
});

// Auto-reconnect on extension load if we have a saved session
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['serverUrl', 'sessionToken'], (result) => {
        if (result.serverUrl && result.sessionToken) {
            connectWithToken(result.serverUrl, result.sessionToken);
        }
    });
});

// Also try on service worker startup
chrome.storage.local.get(['serverUrl', 'sessionToken'], (result) => {
    if (result.serverUrl && result.sessionToken) {
        connectWithToken(result.serverUrl, result.sessionToken);
    }
});
