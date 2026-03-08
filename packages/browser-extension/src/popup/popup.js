// Soupz Kitchen Bridge — Side Panel Controller
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const statusDot    = $('statusDot');
    const statusText   = $('statusText');
    const pairForm     = $('pairForm');
    const connPanel    = $('connectedPanel');
    const pairBtn      = $('pairBtn');
    const disconnectBtn = $('disconnectBtn');
    const otpInput     = $('otpInput');
    const hostInput    = $('hostInput');
    const portInput    = $('portInput');
    const errorMsg     = $('errorMsg');
    const hostnameText = $('hostnameText');
    const captureBtn   = $('captureBtn');
    const domBtn       = $('domBtn');
    const summaryBtn   = $('summaryBtn');
    const inspectBtn   = $('inspectBtn');
    const receiptView  = $('receiptView');
    const closeReceipt = $('closeReceipt');
    const receiptItems = $('receiptItems');
    const receiptUrl   = $('receiptUrl');
    const receiptTime  = $('receiptTime');
    const toast        = $('toast');
    const themeToggle  = $('themeToggle');

    // ── Theme Switcher ────────────────────────
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('theme-kitchen');
            document.body.classList.toggle('theme-brutal');
            const isKitchen = document.body.classList.contains('theme-kitchen');
            themeToggle.textContent = isKitchen ? 'Switch to Brutal' : 'Switch to Kitchen';
            // Save preference
            try { chrome.storage.local.set({ theme: isKitchen ? 'kitchen' : 'brutal' }); } catch {}
        });
    }

    // Load saved theme
    try {
        chrome.storage.local.get(['theme'], (res) => {
            if (res.theme === 'brutal') {
                document.body.classList.remove('theme-kitchen');
                document.body.classList.add('theme-brutal');
                if (themeToggle) themeToggle.textContent = 'Switch to Kitchen';
            }
        });
    } catch {}

    let isInspecting = false;

    // ── Toast helper ──────────────────────────
    function showToast(msg, duration) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration || 2000);
    }

    // ── UI State ──────────────────────────────
    function updateUI(connected, hostname) {
        if (statusDot) statusDot.className = 'dot ' + (connected ? 'on' : 'off');
        if (statusText) statusText.textContent = connected ? 'Connected' + (hostname ? ' · ' + hostname : '') : 'Not connected';
        if (pairForm) pairForm.style.display = connected ? 'none' : 'flex';
        if (connPanel) connPanel.style.display = connected ? 'flex' : 'none';
        if (hostname && hostnameText) hostnameText.textContent = '🖥️ ' + hostname;
    }

    function showError(msg) {
        if (!errorMsg) return;
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
        setTimeout(() => { if (errorMsg) errorMsg.style.display = 'none'; }, 5000);
    }

    // ── Init: check connection status ─────────
    try {
        chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
            if (chrome.runtime.lastError) { updateUI(false); return; }
            if (response) updateUI(response.connected, response.hostname);
            else updateUI(false);
        });
    } catch { updateUI(false); }

    // ── Listen for live status updates ────────
    try {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'status') updateUI(msg.connected, msg.hostname);
            if (msg.type === 'element_selected') {
                isInspecting = false;
                if (inspectBtn) inspectBtn.classList.remove('active');
                showToast('Element: ' + (msg.selector || msg.tag));
            }
        });
    } catch {}

    // ── Pair button ───────────────────────────
    if (pairBtn) {
        pairBtn.addEventListener('click', () => {
            const code = (otpInput?.value || '').trim();
            const host = (hostInput?.value || '').trim() || 'localhost';
            const port = (portInput?.value || '').trim() || '7533';

            if (!code || code.length < 6) {
                showError('Enter the 6-8 digit pairing code');
                return;
            }

            pairBtn.disabled = true;
            pairBtn.textContent = '⏳ Connecting...';
            if (errorMsg) errorMsg.style.display = 'none';

            try {
                chrome.runtime.sendMessage({ type: 'pair', host, port, code }, (response) => {
                    pairBtn.disabled = false;
                    pairBtn.textContent = '🔗 Connect';

                    if (chrome.runtime.lastError) {
                        showError('Extension error — reload and try again');
                        return;
                    }
                    if (response?.ok) {
                        updateUI(true, host);
                        showToast('🟢 Connected!');
                    } else {
                        showError(response?.error || 'Invalid or expired code');
                    }
                });
            } catch {
                pairBtn.disabled = false;
                pairBtn.textContent = '🔗 Connect';
                showError('Extension error — reload extension');
            }
        });
    }

    // ── Disconnect ────────────────────────────
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            try { chrome.runtime.sendMessage({ type: 'disconnect' }); } catch {}
            updateUI(false);
            if (otpInput) otpInput.value = '';
            if (receiptView) receiptView.style.display = 'none';
            showToast('Disconnected');
        });
    }

    // ── Action: Screenshot ────────────────────
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            try {
                chrome.runtime.sendMessage({ type: 'manual_capture' });
                showToast('📸 Snapshot sent');
            } catch { showError('Capture failed'); }
        });
    }

    // ── Action: DOM ───────────────────────────
    if (domBtn) {
        domBtn.addEventListener('click', () => {
            try {
                chrome.runtime.sendMessage({ type: 'manual_dom' });
                showToast('🔍 DOM sent');
            } catch { showError('DOM extraction failed'); }
        });
    }

    // ── Action: Page Receipt ──────────────────
    if (summaryBtn) {
        summaryBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) { showToast('No active tab'); return; }
                chrome.tabs.sendMessage(tab.id, { type: 'get_page_summary' }, (summary) => {
                    if (chrome.runtime.lastError || !summary) {
                        showToast('Could not read page');
                        return;
                    }
                    showReceipt(summary);
                });
            } catch { showToast('Could not read page'); }
        });
    }

    // ── Action: Inspect ───────────────────────
    if (inspectBtn) {
        inspectBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) return;
                isInspecting = !isInspecting;
                inspectBtn.classList.toggle('active', isInspecting);
                chrome.tabs.sendMessage(tab.id, { type: isInspecting ? 'start_inspect' : 'stop_inspect' });
                showToast(isInspecting ? '🎯 Click an element' : 'Inspect off');
            } catch { showToast('Cannot inspect this page'); }
        });
    }

    // ── Receipt renderer ──────────────────────
    function showReceipt(summary) {
        if (!receiptView || !receiptItems) return;
        if (receiptUrl) receiptUrl.textContent = summary.url || '';
        if (receiptTime) receiptTime.textContent = new Date().toLocaleString();

        const rows = [
            ['LINKS', summary.stats?.links ?? '?'],
            ['IMAGES', summary.stats?.images ?? '?'],
            ['BUTTONS', summary.stats?.buttons ?? '?'],
            ['INPUTS', summary.stats?.inputs ?? '?'],
            ['HEADINGS', summary.stats?.headings ?? '?'],
            ['---'],
            ['IMG NO ALT', summary.accessibility?.imagesWithoutAlt ?? '?'],
            ['INP NO LABEL', summary.accessibility?.inputsWithoutLabel ?? '?'],
        ];

        receiptItems.innerHTML = rows.map(r => {
            if (r[0] === '---') return '<div class="receipt-divider"></div>';
            return '<div class="receipt-row"><span>' + r[0] + '</span><span class="val">' + r[1] + '</span></div>';
        }).join('');

        receiptView.style.display = 'block';
    }

    if (closeReceipt) {
        closeReceipt.addEventListener('click', () => {
            if (receiptView) receiptView.style.display = 'none';
        });
    }

    // ── OTP auto-format ───────────────────────
    if (otpInput) {
        otpInput.addEventListener('input', () => {
            otpInput.value = otpInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        });
        otpInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && pairBtn) pairBtn.click();
        });
    }
})();
