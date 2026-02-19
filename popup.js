const PLATFORMS = PLATFORMS_DATA;
const RESERVED_INTRO = "\n\n\n";

// Utils
var TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
    '_ga', '_gl', 'yclid', 'ref', 'source', 'original_referrer'
];

function cleanUrl(urlStr) {
    if (!urlStr || urlStr.startsWith('file://')) return { url: '' };
    try {
        const url = new URL(urlStr);
        TRACKING_PARAMS.forEach(p => url.searchParams.delete(p));
        return { url: url.toString() };
    } catch (e) { return { url: urlStr }; }
}

const MODERATE_PROTECTION_LIST = ['bank', 'paypal', 'stripe', 'gov', 'mil', 'healthcare'];
const PRIVACY_PROTECTION_LIST = [...MODERATE_PROTECTION_LIST, 'ledger', 'trezor', 'coinbase', 'binance', 'mychart', 'epic', 'police', 'interpol', 'proton.me', 'tutanota', 'bitwarden', '1password', 'lastpass'];

function isRestrictedUrl(url, level = 'strict') {
    if (!url) return true;
    const coreRestricted = ['about:', 'moz-extension:', 'view-source:', 'chrome:', 'file:'].some(p => url.startsWith(p)) ||
        url.includes('addons.mozilla.org');

    if (coreRestricted) return true;

    try {
        const domain = new URL(url).hostname.toLowerCase();
        const list = level === 'moderate' ? MODERATE_PROTECTION_LIST : PRIVACY_PROTECTION_LIST;
        return list.some(p => domain.includes(p));
    } catch (e) {
        return true;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.className = 'toast'; }, 2000);
}

document.addEventListener('DOMContentLoaded', async () => {
    const titleEl = document.getElementById('article-title');
    const urlEl = document.getElementById('article-url');
    const grid = document.getElementById('share-grid');


    let selectedText = "";

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const securityData = await browser.storage.local.get('securityLevel');
    const secLevel = securityData.securityLevel || 'strict';

    const articleTitle = (tab.title || 'Unknown').split(/[/\\]/).pop();
    titleEl.textContent = articleTitle;
    const articleUrl = cleanUrl(tab.url || '').url;
    urlEl.textContent = articleUrl || "Unknown Source";

    // Try to get selection
    try {
        if (!isRestrictedUrl(tab.url, secLevel)) {
            const res = await browser.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.getSelection().toString().trim() });
            selectedText = res[0]?.result || "";
        }
    } catch (e) { }

    // Share Actions
    const getShareUrl = (id, t, u, q) => {
        const qPart = q ? `"${q}" — ` : "";
        const text = encodeURIComponent(`${RESERVED_INTRO}${qPart}${t}`);
        const urlPart = u ? `&url=${encodeURIComponent(u)}` : "";

        const templates = {
            'share-x': `https://x.com/intent/post?text=${text}${urlPart}`,
            'share-bluesky': `https://bsky.app/intent/compose?text=${text}${u ? ` ${u}` : ""}`,
            'share-whatsapp': `https://wa.me/?text=${text}${u ? `\n\n${u}` : ""}`,
            'share-telegram': `https://t.me/share/url?text=${text}${urlPart}`
        };
        return templates[id] || `https://x.com/intent/post?text=${text}${urlPart}`;
    };

    document.getElementById('open-settings')?.addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL("options/options.html") });
        window.close();
    });

    document.getElementById('open-read-later')?.addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL("popup/read_later.html") });
        window.close();
    });

    // Infinite scroll check
    const INFINITE_SCROLL_SITES = [
        'facebook.com', 'x.com', 'twitter.com', 'instagram.com',
        'reddit.com', 'linkedin.com', 'bluesky.app', 'tiktok.com',
        'pinterest.com', 'threads.net', 'mastodon', 'bsky.social'
    ];
    const isInfiniteScroll = INFINITE_SCROLL_SITES.some(site => tab.url.toLowerCase().includes(site));

    // Render Grid
    const hidden = (await browser.storage.local.get('hiddenPlatforms')).hiddenPlatforms || [];
    Object.keys(PLATFORMS).forEach(id => {
        // Only show Screenshot buttons in the popup. All other tools are in the FAB.
        if (id !== 'share-screenshot' && id !== 'share-screenshot-full') return;

        if (hidden.includes(id)) return;

        // Disable Full Page screenshot on social media (Infinite Scrollers)
        if (id === 'share-screenshot-full' && isInfiniteScroll) {
            console.log("[Another Share] Disabling Full Page screenshot for infinite scrolling site.");
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'share-btn';
        btn.id = id;
        btn.dataset.platform = id.replace('share-', '');
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'icon-wrapper';
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(PLATFORMS[id].icon, 'image/svg+xml');
            if (doc.documentElement && !doc.querySelector('parsererror')) {
                iconWrapper.appendChild(doc.documentElement);
            }
        } catch (e) { /* ignore */ }
        btn.appendChild(iconWrapper);
        btn.title = PLATFORMS[id].title;

        btn.addEventListener('click', async () => {
            if (isRestrictedUrl(tab.url, secLevel)) {
                showToast("Screenshots not allowed on this page", "error");
                return;
            }

            try {
                const isFull = id === 'share-screenshot-full';
                showToast(isFull ? "Capturing full page... stay still" : "Capturing...");

                const response = await browser.runtime.sendMessage({
                    action: "capturePage",
                    full: isFull,
                    openTab: false,
                    tabId: tab.id
                });

                if (response && response.error) {
                    showToast("Capture failed: " + response.error, "error");
                    return;
                }

                const finalDataUrl = response.dataUrl;
                const overlay = document.getElementById('capture-overlay');
                const preview = document.getElementById('capture-preview');

                if (overlay && preview) {
                    preview.src = finalDataUrl;
                    overlay.classList.add('active');
                    setupOverlayButtons(finalDataUrl, overlay);
                }
            } catch (err) {
                showToast("Capture failed", "error");
            }
        });
        grid.appendChild(btn);
    });
});

async function storeImageForPrint(dataUrl) {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('SS_BUFFER_DB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images');
            }
        };
        req.onsuccess = async () => {
            const db = req.result;
            const tx = db.transaction('images', 'readwrite');
            const store = tx.objectStore('images');
            const key = 'print_' + Date.now();

            const response = await fetch(dataUrl);
            const blob = await response.blob();

            const putReq = store.put(blob, key);
            putReq.onsuccess = () => resolve(key);
            putReq.onerror = () => reject(putReq.error);
        };
        req.onerror = () => reject(req.error);
    });
}

function setupOverlayButtons(dataUrl, overlay) {
    const shareBtn = document.getElementById('share-screenshot-btn');
    const printBtn = document.getElementById('print-screenshot');
    const downloadBtn = document.getElementById('download-screenshot');
    const openBtn = document.getElementById('open-screenshot');
    const closeBtn = document.getElementById('close-overlay');

    const onShare = async () => {
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], "screenshot.png", { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: document.title });
                window.close();
            } else { showToast("Sharing not supported", "info"); }
        } catch (e) { showToast("Share failed", "error"); }
    };

    const onPrint = async () => {
        try {
            const key = await storeImageForPrint(dataUrl);
            browser.tabs.create({ url: `popup/print.html?key=${key}` });
            window.close();
        } catch (e) { showToast("Print setup failed", "error"); }
    };

    const onDownload = () => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `screenshot_${Date.now()}.png`;
        a.click();
        showToast("Saving to downloads...");
    };

    const onOpen = () => {
        browser.tabs.create({ url: dataUrl });
        window.close();
    };

    const onClose = () => {
        overlay.classList.remove('active');
        shareBtn.removeEventListener('click', onShare);
        printBtn.removeEventListener('click', onPrint);
        downloadBtn.removeEventListener('click', onDownload);
        openBtn.removeEventListener('click', onOpen);
        closeBtn.removeEventListener('click', onClose);
    };

    shareBtn.addEventListener('click', onShare);
    printBtn.addEventListener('click', onPrint);
    downloadBtn.addEventListener('click', onDownload);
    openBtn.addEventListener('click', onOpen);
    closeBtn.addEventListener('click', onClose);
}
