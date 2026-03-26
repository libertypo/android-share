const SOCIAL_PATTERNS = [
    { name: 'X', pattern: /x\.com\/intent\/post|twitter\.com\/intent\/tweet/i, id: 'share-x' },
    { name: 'WhatsApp', pattern: /wa\.me|api\.whatsapp\.com\/send/i, id: 'share-whatsapp' },
    { name: 'Telegram', pattern: /t\.me\/share\/url/i, id: 'share-telegram' },
    { name: 'Mastodon', pattern: /mastodonshare\.com/i, id: 'share-mastodon' },
    { name: 'LinkedIn', pattern: /linkedin\.com\/sharing\/share-offsite/i, id: 'share-linkedin' },
    { name: 'Facebook', pattern: /facebook\.com\/sharer/i, id: 'share-facebook' },
    { name: 'Reddit', pattern: /reddit\.com\/submit/i, id: 'share-reddit' }
];

// UI State
let shareSheet = null;

function injectShareHijacker() {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('js/inject.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
}

function setGridStatusMessage(grid, message, color = '') {
    const status = document.createElement('div');
    status.style.gridColumn = '1 / -1';
    status.style.textAlign = 'center';
    status.style.padding = '20px';
    status.style.opacity = '0.5';
    if (color) {
        status.style.color = color;
    }
    status.textContent = message;
    grid.replaceChildren(status);
}

function setConnectionErrorMessage(grid) {
    const wrapper = document.createElement('div');
    wrapper.style.gridColumn = '1 / -1';
    wrapper.style.textAlign = 'center';
    wrapper.style.padding = '20px';

    const title = document.createElement('div');
    title.style.color = '#ff3b30';
    title.style.marginBottom = '12px';
    title.textContent = 'Connection Error';

    const detail = document.createElement('div');
    detail.style.fontSize = '13px';
    detail.style.opacity = '0.7';
    detail.style.marginBottom = '20px';
    detail.textContent = 'The background script is not responding. Try refreshing the page.';

    wrapper.appendChild(title);
    wrapper.appendChild(detail);
    grid.replaceChildren(wrapper);
}

function createShareSheet() {
    if (shareSheet) return shareSheet;

    const container = document.createElement('div');
    container.id = 'as-share-sheet-root';
    const shadow = container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            position: fixed;
            left: 0;
            width: 100%;
            z-index: 2147483647;
            pointer-events: none;
            bottom: 0;
            display: none;
        }
        .overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        .overlay.active { opacity: 1; pointer-events: auto; }
        .sheet {
            position: fixed;
            bottom: -100%;
            left: 0;
            width: 100%;
            height: auto;
            background: #ffffff;
            transition: bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 -4px 15px rgba(0,0,0,0.1);
            border-radius: 20px 20px 0 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1a1a1b;
            padding-bottom: env(safe-area-inset-bottom, 20px);
            pointer-events: auto;
        }
        @media (prefers-color-scheme: dark) {
            .sheet { background: #1c1c1e; color: #ffffff; }
        }
        .sheet.active { bottom: 0; }
        .header {
            padding: 16px;
            text-align: center;
            border-bottom: 1px solid rgba(0,0,0,0.1);
            position: relative;
        }
        .header h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .close-btn {
            position: absolute; right: 16px; top: 12px;
            background: rgba(128,128,128,0.15);
            border: none; border-radius: 50%; width: 28px; height: 28px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            color: inherit; font-size: 18px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            padding: 20px;
            padding-top: 10px;
            max-height: 40vh;
            overflow-y: auto;
        }
        .tools-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            padding: 20px;
            padding-bottom: 5px;
            border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        .section-header {
            padding: 12px 20px 0;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #8a8a8e;
            letter-spacing: 0.5px;
        }
        .item {
            display: flex; flex-direction: column; align-items: center;
            text-decoration: none; color: inherit; font-size: 11px;
            gap: 8px; cursor: pointer;
        }
        .icon {
            width: 48px; height: 48px;
            background: rgba(128,128,128,0.1);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.1s;
        }
        .icon.tool-icon {
            background: rgba(0, 122, 255, 0.1);
            color: #007aff;
        }
        .item:active .icon { transform: scale(0.9); }
        .privacy-badge {
            text-align: center; font-size: 10px; color: #8a8a8e;
            padding: 10px; opacity: 0.7;
        }
    `;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const sheetEl = document.createElement('div');
    sheetEl.className = 'sheet';

    const header = document.createElement('div');
    header.className = 'header';
    const heading = document.createElement('h3');
    heading.textContent = 'Clean Share';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    header.appendChild(heading);
    header.appendChild(closeBtn);

    const toolsHeader = document.createElement('div');
    toolsHeader.className = 'section-header';
    toolsHeader.textContent = 'Tools';

    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'tools-grid';

    const shareHeader = document.createElement('div');
    shareHeader.className = 'section-header';
    shareHeader.textContent = 'Share to';

    const grid = document.createElement('div');
    grid.className = 'grid';

    const privacyBadge = document.createElement('div');
    privacyBadge.className = 'privacy-badge';
    privacyBadge.textContent = 'Privacy First • Trackers Scrubbed';

    sheetEl.appendChild(header);
    sheetEl.appendChild(toolsHeader);
    sheetEl.appendChild(toolsGrid);
    sheetEl.appendChild(shareHeader);
    sheetEl.appendChild(grid);
    sheetEl.appendChild(privacyBadge);

    shadow.appendChild(style);
    shadow.appendChild(overlay);
    shadow.appendChild(sheetEl);
    (document.body || document.documentElement).appendChild(container);

    let closeTimer;
    const close = () => {
        sheetEl.classList.remove('active');
        overlay.classList.remove('active');
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            container.style.display = 'none';
            // Also reset grid to prevent stale state if re-opened quickly
            // But showShareSheet handles grid reset.
        }, 300);
    };

    overlay.onclick = close;
    closeBtn.onclick = close;

    shareSheet = {
        container,
        overlay,
        sheet: sheetEl,
        grid,
        toolsGrid,
        close
    };
    return shareSheet;
}

function showShareSheet(title, url, text) {
    const sheetObj = createShareSheet();
    setGridStatusMessage(sheetObj.grid, 'Loading Platforms...');
    sheetObj.container.style.display = 'block';

    // 1. Animate Sheet
    if (!sheetObj.container.parentNode) {
        (document.body || document.documentElement).appendChild(sheetObj.container);
    }

    requestAnimationFrame(() => {
        sheetObj.sheet.classList.add('active');
        sheetObj.overlay.classList.add('active');
    });

    // 2. Populate Platforms Grid
    browser.runtime.sendMessage({ action: "getPlatforms" })
        .then(response => {
            if (!response || !response.platforms) {
                Logger.error("Failed to get platforms from background.");
                setGridStatusMessage(sheetObj.grid, 'Error loading platforms.', '#ff3b30');
                return;
            }

            const platforms = response.platforms;
            sheetObj.grid.replaceChildren();
            sheetObj.toolsGrid.replaceChildren();

            Object.keys(platforms).forEach(id => {
                const item = document.createElement('div');
                item.className = 'item';

                // Tool styling
                const isTool = ['share-text', 'share-save', 'share-print', 'share-system', 'share-markdown', 'share-read-later'].includes(id);
                const iconClass = isTool ? 'icon tool-icon' : 'icon';

                const iconWrapper = document.createElement('div');
                iconWrapper.className = iconClass;
                // Safe parsing of trusted SVG string to avoid innerHTML warning
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(platforms[id].icon, 'text/html');
                    const svgNode = doc.querySelector('svg');
                    if (svgNode) {
                        iconWrapper.appendChild(svgNode);
                    }
                } catch (e) { /* ignore invalid svg */ }

                const span = document.createElement('span');
                span.textContent = platforms[id].title;

                item.appendChild(iconWrapper);
                item.appendChild(span);
                item.onclick = async (e) => {
                    e.stopPropagation();
                    if ("vibrate" in navigator) navigator.vibrate(30);

                    // Close immediately for perceived responsiveness
                    sheetObj.close();

                    if (id === 'share-system') {
                        try {
                            if (navigator.share) {
                                await navigator.share({
                                    title: title,
                                    url: url,
                                    text: text
                                });
                            } else {
                                alert("System share not supported on this browser.");
                            }
                        } catch (err) {
                            Logger.error("System share failed:", err);
                        }
                        return;
                    }

                    if (id === 'share-text') {
                        try {
                            const articleText = extractArticleText();
                            browser.runtime.sendMessage({
                                action: "saveTextFile",
                                text: articleText,
                                filename: `article_${Date.now()}.txt`
                            });
                        } catch (e) { alert("Extraction failed"); }
                        return;
                    }

                    if (id === 'share-save') {
                        browser.runtime.sendMessage({ action: "performSavePdf" });
                        showContentToast("Use the print dialog to save as PDF");
                        return;
                    }

                    if (id === 'share-print') {
                        browser.runtime.sendMessage({ action: "performPrint" });
                        return;
                    }

                    if (id === 'share-markdown') {
                        const mdLink = `[${title}](${url})`;
                        try {
                            await navigator.clipboard.writeText(mdLink);
                            showContentToast("Markdown link copied!");
                        } catch (err) {
                            showContentToast("Clipboard Error");
                        }
                        return;
                    }

                    if (id === 'share-read-later') {
                        browser.runtime.sendMessage({
                            action: "addToReadLater",
                            item: { title, url, timestamp: Date.now() }
                        });
                        showContentToast("Saved to Read Later");
                        return;
                    }

                    // Standard Social Share
                    try {
                        browser.runtime.sendMessage({
                            action: "performShare",
                            platformId: id,
                            title: title,
                            url: url,
                            text: text
                        });
                    } catch (e) {
                        Logger.error("Share failed to trigger:", e);
                    }
                };

                if (isTool) {
                    sheetObj.toolsGrid.appendChild(item);
                } else {
                    sheetObj.grid.appendChild(item);
                }
            });
        })
        .catch(err => {
            Logger.error("Error in showShareSheet:", err);
            setConnectionErrorMessage(sheetObj.grid);
        });
}

// Toast Notification
function showContentToast(message) {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '24px',
        fontSize: '14px',
        zIndex: 2147483647,
        opacity: 0,
        transition: 'opacity 0.3s'
    });
    document.body.appendChild(el);

    // Animate in
    requestAnimationFrame(() => el.style.opacity = 1);

    // Animate out
    setTimeout(() => {
        el.style.opacity = 0;
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// Listen for intercepted Navigator Share
window.addEventListener('extension_intercepted_share', (e) => {
    Logger.info("Intercepted navigator.share call.");
    showShareSheet(e.detail.title, e.detail.url, e.detail.text);
});

// Floating Action Button (FAB) UI
let fab = null;

function createFAB() {
    if (fab) return fab;

    const container = document.createElement('div');
    container.id = 'as-fab-root';
    const shadow = container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 2147483646;
            pointer-events: auto;
        }
        .fab {
            width: 44px;
            height: 44px;
            background: rgba(0, 96, 223, 0.9);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: grab;
            transition: transform 0.2s, background 0.2s, opacity 0.3s;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
            backdrop-filter: blur(4px);
            touch-action: none;
        }
        .fab:active { cursor: grabbing; }
        @media (prefers-color-scheme: dark) {
            .fab { background: rgba(0, 100, 255, 0.8); }
        }
        .fab.scaling { transform: scale(0.9); background: #0060df; }
        .fab svg { width: 22px; height: 22px; pointer-events: none; }
    `;

    const fabEl = document.createElement('div');
    fabEl.className = 'fab';
    const parser = new DOMParser();
    const fabSvgDoc = parser.parseFromString('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>', 'text/html');
    const fabSvg = fabSvgDoc.querySelector('svg');
    if (fabSvg) {
        fabEl.appendChild(fabSvg);
    }

    let isDragging = false;
    let startX, startY;
    let initialX, initialY;
    let hasMoved = false;

    // Load persisted position
    browser.storage.local.get('fabPosition').then(res => {
        if (res.fabPosition) {
            container.style.bottom = 'auto';
            container.style.right = 'auto';
            container.style.left = res.fabPosition.x + 'px';
            container.style.top = res.fabPosition.y + 'px';
        }
    });

    const onMove = (e) => {
        if (!isDragging) return;
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved = true;
            fabEl.classList.remove('scaling');
        }

        container.style.bottom = 'auto';
        container.style.right = 'auto';
        container.style.left = (initialX + dx) + 'px';
        container.style.top = (initialY + dy) + 'px';
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);

        if (!hasMoved) {
            // It was a tap
            if ("vibrate" in navigator) navigator.vibrate(30);
            const metadata = getMetadata();
            // Don't pass description as 'text' to avoid unwanted threading on short-form platforms
            showShareSheet(metadata.title, metadata.url, "");
        } else {
            // Save position
            const rect = container.getBoundingClientRect();
            browser.storage.local.set({ fabPosition: { x: rect.left, y: rect.top } });
        }
        fabEl.classList.remove('scaling');
    };

    const onStart = (e) => {
        isDragging = true;
        hasMoved = false;
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;

        const rect = container.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        fabEl.classList.add('scaling');

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    };

    fabEl.addEventListener('mousedown', onStart);
    fabEl.addEventListener('touchstart', onStart, { passive: false });

    shadow.appendChild(style);
    shadow.appendChild(fabEl);
    (document.body || document.documentElement).appendChild(container);

    fab = { container, fabEl };
}

function isSensitiveSite(level = 'strict') {
    return ASCommon.isSensitiveUrl(window.location.href, level);
}

// Init features
async function initializeDeviceSpecificFeatures() {
    const settings = await browser.storage.local.get('securityLevel');
    const level = settings.securityLevel || 'strict';

    if (isSensitiveSite(level)) {
        Logger.info("Security: Disabling features on sensitive site (" + level + ").");
        return;
    }

    injectShareHijacker();
    Logger.info("Initializing Mobile FAB and Interceptor.");

    // Create FAB
    if (document.body || document.documentElement) {
        createFAB();
    } else {
        document.addEventListener('DOMContentLoaded', createFAB);
    }

    // Initialize Social Interceptor
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link || !link.href) return;

        for (const entry of SOCIAL_PATTERNS) {
            if (entry.pattern.test(link.href)) {
                Logger.info(`Intercepted ${entry.name} share link click.`);
                e.preventDefault();
                e.stopPropagation();

                const metadata = getMetadata();
                showShareSheet(metadata.title, metadata.url, metadata.description);
                return;
            }
        }
    }, true);
}

initializeDeviceSpecificFeatures();

// Extract metadata
function getMetadata() {
    const getMeta = (name) => {
        return document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
            document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
    };

    return {
        title: getMeta('og:title') || document.title,
        description: getMeta('og:description') || getMeta('description'),
        image: getMeta('og:image'),
        url: ASCommon.cleanUrl(window.location.href),
        siteName: getMeta('og:site_name')
    };
}

// Listen for messages from the popup or background
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "notifyThread") {
        showContentToast("🧵 " + request.message);
        return;
    }

    if (request.action === "getMetadata") {
        Logger.info("Content script metadata requested.");
        sendResponse(getMetadata());
    }
    if (request.action === "extractText") {
        sendResponse({ text: extractArticleText() });
    }
});

function extractArticleText() {
    const title = document.title;
    const url = ASCommon.cleanUrl(window.location.href);

    // Find article container
    const article = document.querySelector('article') ||
        document.querySelector('.article-content') ||
        document.querySelector('.post-content') ||
        document.querySelector('#main-content') ||
        document.body;

    const clone = article.cloneNode(true);

    // 1. Sanitize
    const noise = clone.querySelectorAll('script, style, nav, footer, iframe, noscript, .ads, .comments, svg, form, button');
    noise.forEach(el => el.remove());

    // 2. Process Content (Text + Images)
    const elements = [];

    // Recursive walker to extract meaningful blocks
    function walk(node) {
        if (!node) return;

        // Extract Images
        if (node.tagName === 'IMG') {
            const src = node.getAttribute('src');
            // Basic check for real images, skipping tiny icons/trackers
            if (src && !src.includes('data:image/svg') && (node.naturalWidth > 50 || node.width > 50)) {
                elements.push({ type: 'image', src: node.src });
            }
            return;
        }

        // Process containers
        if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'].includes(node.tagName)) {
            // Clean specific element of any late-remaining HTML tag/code
            let text = node.innerText.replace(/<[^>]*>?/gm, '').trim();
            if (text) {
                elements.push({ type: 'text', content: text, tag: node.tagName });
            }
            return;
        }

        // Recursive walk for other containers (divs, sections, etc)
        node.childNodes.forEach(child => walk(child));
    }

    walk(clone);

    return {
        header: { title, url, date: new Date().toLocaleString() },
        elements: elements
    };
}
