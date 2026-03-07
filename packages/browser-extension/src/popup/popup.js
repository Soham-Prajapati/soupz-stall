// Popup controller — Kitchen Bridge
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
const inspectBtn = document.getElementById('inspectBtn');
const receiptView = document.getElementById('receiptView');
const closeReceipt = document.getElementById('closeReceipt');
const receiptItems = document.getElementById('receiptItems');
const receiptUrl = document.getElementById('receiptUrl');
const receiptTime = document.getElementById('receiptTime');

let isInspecting = false;

function updateUI(connected, hostname) {
    statusDot.className = `dot ${connected ? 'on' : 'off'}`;
    statusText.textContent = connected ? `Connected to ${hostname || 'Kitchen'}` : 'Not paired';
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

// Listen for status changes
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'status') updateUI(msg.connected, msg.hostname);
    if (msg.type === 'element_selected') {
        isInspecting = false;
        inspectBtn.classList.remove('active');
        // Show selected element in a receipt or just console
        console.log('Selected:', msg.selector);
    }
});

// Pair button
pairBtn.addEventListener('click', async () => {
    const code = otpInput.value.trim();
    const host = hostInput.value.trim() || 'localhost';
    const port = portInput.value.trim() || '7533';

    if (!code || code.length < 6) {
        showError('Enter the order number (6-8 digits)');
        return;
    }

    pairBtn.disabled = true;
    pairBtn.textContent = '🔄 Starting stove...';
    errorMsg.style.display = 'none';

    chrome.runtime.sendMessage({ type: 'pair', host, port, code }, (response) => {
        pairBtn.disabled = false;
        pairBtn.textContent = '🔗 Connect to Kitchen';

        if (response?.ok) {
            updateUI(true, host);
        } else {
            showError(response?.error || 'Pairing failed. Check code.');
        }
    });
});

disconnectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'disconnect' });
    updateUI(false);
    otpInput.value = '';
    receiptView.style.display = 'none';
});

document.getElementById('captureBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'manual_capture' });
});

document.getElementById('domBtn').addEventListener('click', async () => {
    // Send DOM to server
    chrome.runtime.sendMessage({ type: 'manual_dom' });
});

document.getElementById('summaryBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'get_page_summary' }, (summary) => {
            if (summary) {
                showReceipt(summary);
            }
        });
    }
});

inspectBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    isInspecting = !isInspecting;
    inspectBtn.classList.toggle('active', isInspecting);

    chrome.tabs.sendMessage(tab.id, { 
        type: isInspecting ? 'start_inspect' : 'stop_inspect' 
    });
});

function showReceipt(summary) {
    receiptUrl.textContent = summary.url;
    receiptTime.textContent = new Date().toLocaleString();
    
    const items = [
        { label: 'LINKS', value: summary.stats.links },
        { label: 'IMAGES', value: summary.stats.images },
        { label: 'BUTTONS', value: summary.stats.buttons },
        { label: 'INPUTS', value: summary.stats.inputs },
        { label: 'HEADINGS', value: summary.stats.headings },
        { label: '---', value: '---' },
        { label: 'IMG NO ALT', value: summary.accessibility.imagesWithoutAlt },
        { label: 'INP NO LBL', value: summary.accessibility.inputsWithoutLabel },
    ];

    receiptItems.innerHTML = items.map(item => `
        <div class="receipt-row">
            <span>${item.label}</span>
            <span>${item.value}</span>
        </div>
    `).join('');

    receiptView.style.display = 'block';
}

closeReceipt.addEventListener('click', () => {
    receiptView.style.display = 'none';
});
