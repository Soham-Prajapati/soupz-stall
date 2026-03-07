// Soupz Browser Extension — Content Script
// Injected into every page to provide DOM access to AI agents

(function() {
    // Highlight element on hover when Soupz is inspecting
    let inspecting = false;
    let highlightOverlay = null;

    function createOverlay() {
        highlightOverlay = document.createElement('div');
        highlightOverlay.id = 'soupz-highlight';
        highlightOverlay.style.cssText = `
            position: fixed; pointer-events: none; z-index: 999999;
            border: 2px solid #e94560; background: rgba(233,69,96,0.1);
            border-radius: 4px; transition: all 0.15s ease;
            display: none;
        `;
        document.body.appendChild(highlightOverlay);
    }

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        switch (msg.type) {
            case 'start_inspect':
                inspecting = true;
                if (!highlightOverlay) createOverlay();
                highlightOverlay.style.display = 'block';
                sendResponse({ ok: true });
                break;

            case 'stop_inspect':
                inspecting = false;
                if (highlightOverlay) highlightOverlay.style.display = 'none';
                sendResponse({ ok: true });
                break;

            case 'get_page_summary': {
                const summary = {
                    url: window.location.href,
                    title: document.title,
                    meta: {
                        description: document.querySelector('meta[name="description"]')?.content || '',
                        viewport: document.querySelector('meta[name="viewport"]')?.content || '',
                    },
                    stats: {
                        links: document.querySelectorAll('a').length,
                        images: document.querySelectorAll('img').length,
                        buttons: document.querySelectorAll('button').length,
                        inputs: document.querySelectorAll('input,textarea,select').length,
                        headings: document.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
                    },
                    accessibility: {
                        imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length,
                        inputsWithoutLabel: [...document.querySelectorAll('input:not([type="hidden"])')].filter(
                            el => !el.labels?.length && !el.getAttribute('aria-label')
                        ).length,
                    },
                    colors: getComputedStyle(document.body).backgroundColor,
                    fontSize: getComputedStyle(document.body).fontSize,
                };
                sendResponse(summary);
                break;
            }

            case 'get_visible_text': {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                const texts = [];
                let node;
                while ((node = walker.nextNode()) && texts.length < 200) {
                    const text = node.textContent.trim();
                    if (text.length > 2) texts.push(text);
                }
                sendResponse({ text: texts.join('\n').substring(0, 10000) });
                break;
            }
        }
        return true;
    });

    // Hover highlight during inspect mode
    document.addEventListener('mousemove', (e) => {
        if (!inspecting || !highlightOverlay) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el !== highlightOverlay) {
            const rect = el.getBoundingClientRect();
            highlightOverlay.style.top = rect.top + 'px';
            highlightOverlay.style.left = rect.left + 'px';
            highlightOverlay.style.width = rect.width + 'px';
            highlightOverlay.style.height = rect.height + 'px';
            highlightOverlay.style.display = 'block';
        }
    });

    // Click to select during inspect
    document.addEventListener('click', (e) => {
        if (!inspecting) return;
        e.preventDefault();
        e.stopPropagation();

        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el !== highlightOverlay) {
            const selector = generateSelector(el);
            chrome.runtime.sendMessage({
                type: 'element_selected',
                selector,
                tag: el.tagName,
                text: el.textContent?.trim().substring(0, 200),
                attributes: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])),
            });
            inspecting = false;
            highlightOverlay.style.display = 'none';
        }
    }, true);

    function generateSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).slice(0, 3).join('.');
            if (classes && document.querySelectorAll(`.${classes}`).length === 1) {
                return `.${classes}`;
            }
        }
        // Build path
        const parts = [];
        let current = el;
        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                parts.unshift(`#${current.id}`);
                break;
            }
            const siblings = current.parentElement?.children;
            if (siblings && siblings.length > 1) {
                const index = [...siblings].indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }
            parts.unshift(selector);
            current = current.parentElement;
        }
        return parts.join(' > ');
    }
})();
