// Popup controller — OTP pairing flow
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const pairForm = document.getElementById('pairForm');
const actions = document.getElementById('actions');
const pairBtn = document.getElementById('pairBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const otpInput = document.getElementById('otpInput');
const hostInput = document.getElementById('hostInput');
const portInput = document.getElementById('portInput');
const errorMsg = document.getElementById('errorMsg');
const hostnameText = document.getElementById('hostnameText');

function updateUI(connected, hostname) {
    statusDot.className = `dot ${connected ? 'on' : 'off'}`;
    statusText.textContent = connected ? `Connected to ${hostname || 'server'}` : 'Not paired';
    pairForm.style.display = connected ? 'none' : 'block';
    actions.style.display = connected ? 'flex' : 'none';
    if (hostname) hostnameText.textContent = `🖥️ ${hostname}`;
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    setTimeout(() => { errorMsg.style.display = 'none'; }, 5000);
}

// Check status on popup open
chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response) {
        updateUI(response.connected, response.hostname);
    }
});

// Also check storage for hostname
chrome.storage.local.get(['connected', 'hostname'], (data) => {
    if (data.connected) updateUI(true, data.hostname);
});

// Listen for status changes
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'status') updateUI(msg.connected, msg.hostname);
});

// Pair button
pairBtn.addEventListener('click', async () => {
    const code = otpInput.value.trim();
    const host = hostInput.value.trim() || 'localhost';
    const port = portInput.value.trim() || '7533';

    if (!code || code.length < 6) {
        showError('Enter the pairing code from your laptop (6-8 digits)');
        return;
    }

    pairBtn.disabled = true;
    pairBtn.textContent = '🔄 Pairing...';
    errorMsg.style.display = 'none';

    chrome.runtime.sendMessage({ type: 'pair', host, port, code }, (response) => {
        pairBtn.disabled = false;
        pairBtn.textContent = '🔗 Pair Device';

        if (response?.ok) {
            updateUI(true, host);
        } else {
            showError(response?.error || 'Pairing failed. Check code and try again.');
        }
    });
});

// Enter key on OTP input triggers pair
otpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pairBtn.click();
});

disconnectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'disconnect' });
    updateUI(false);
    otpInput.value = '';
});

document.getElementById('captureBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'manual_capture' });
});

document.getElementById('domBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'get_page_summary' }, (summary) => {
            console.log('Page summary:', summary);
        });
    }
});

document.getElementById('summaryBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'get_page_summary' }, (summary) => {
            if (summary) {
                alert(`📋 ${summary.title}\n\n` +
                    `Links: ${summary.stats.links}\n` +
                    `Images: ${summary.stats.images}\n` +
                    `Buttons: ${summary.stats.buttons}\n` +
                    `Inputs: ${summary.stats.inputs}\n` +
                    `Headings: ${summary.stats.headings}\n\n` +
                    `⚠️ Images without alt: ${summary.accessibility.imagesWithoutAlt}\n` +
                    `⚠️ Inputs without label: ${summary.accessibility.inputsWithoutLabel}`
                );
            }
        });
    }
});
