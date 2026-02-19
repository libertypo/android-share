// Verified Background Script Start
console.log("[Another Share] Background script initializing...");

// From js/platforms.js


var TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
    '_ga', '_gl', 'yclid', 'ref', 'source', 'original_referrer'
];

function cleanUrl(urlStr) {
    if (!urlStr || urlStr.startsWith('file://')) return '';
    try {
        const url = new URL(urlStr);
        TRACKING_PARAMS.forEach(param => {
            if (url.searchParams.has(param)) url.searchParams.delete(param);
        });
        return url.toString();
    } catch (e) { return urlStr; }
}

var platforms = {
    x: (title, url, quote) => {
        const text = quote ? `"${quote}" — ${title}` : title;
        const webUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}${url ? `&url=${encodeURIComponent(url)}` : ""}`;
        // Android Intent: try com.twitter.android first
        return `intent://post?text=${encodeURIComponent(text)}${url ? `&url=${encodeURIComponent(url)}` : ""}#Intent;scheme=twitter;package=com.twitter.android;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    },
    bluesky: (title, url, quote) => {
        const body = quote ? `"${quote}" — ${title}` : title;
        const text = url ? `${body} ${url}` : body;
        // Use standard HTTPS Deep Link. Android handles "Open in App" or browser fallback naturally.
        return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    },
    mastodon: (title, url, quote) => {
        const body = quote ? `"${quote}" — ${title}` : title;
        const text = url ? `${body} ${url}` : body;
        return `https://mastodonshare.com/?text=${encodeURIComponent(text)}${url ? `&url=${encodeURIComponent(url)}` : ""}`;
    },
    whatsapp: (title, url, quote) => {
        const body = quote ? `"${quote}"\n\n${title}` : title;
        const text = url ? `${body} ${url}` : body;
        const webUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        return `intent://send/?text=${encodeURIComponent(text)}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    },
    telegram: (title, url, quote) => {
        const body = quote ? `"${quote}"\n\n${title}` : title;
        const webUrl = `https://t.me/share/url?text=${encodeURIComponent(body)}${url ? `&url=${encodeURIComponent(url)}` : ""}`;
        return `intent://share/url?text=${encodeURIComponent(body)}${url ? `&url=${encodeURIComponent(url)}` : ""}#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    },
    linkedin: (title, url) => url ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` : "",
    facebook: (title, url) => url ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` : "",
    reddit: (title, url, quote) => {
        const titleText = quote ? `"${quote}" — ${title}` : title;
        const webUrl = `https://www.reddit.com/submit?title=${encodeURIComponent(titleText)}${url ? `&url=${encodeURIComponent(url)}` : ""}`;
        return `intent://www.reddit.com/submit?title=${encodeURIComponent(titleText)}${url ? `&url=${encodeURIComponent(url)}` : ""}#Intent;package=com.reddit.frontpage;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    }
};

// Privacy: Skip sensitive domains
const MODERATE_PROTECTION_LIST = ['bank', 'paypal', 'stripe', 'gov', 'mil', 'healthcare'];
const PRIVACY_PROTECTION_LIST = [...MODERATE_PROTECTION_LIST, 'ledger', 'trezor', 'coinbase', 'binance', 'mychart', 'epic', 'police', 'interpol', 'proton.me', 'tutanota', 'bitwarden', '1password', 'lastpass'];

function isSensitiveSite(url, level = 'strict') {
    if (!url) return true;
    try {
        const domain = new URL(url).hostname.toLowerCase();
        const list = level === 'moderate' ? MODERATE_PROTECTION_LIST : PRIVACY_PROTECTION_LIST;
        return list.some(p => domain.includes(p));
    } catch (e) {
        return true;
    }
}

async function securePurgeStorage() {
    console.log("[Another Share] Purging storage...");
    return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('SS_BUFFER_DB');
        req.onsuccess = () => { console.log("Storage purged."); resolve(); };
        req.onerror = () => { console.error("Purge failed."); resolve(); };
        req.onblocked = () => { console.warn("Purge blocked."); resolve(); };
    });
}

// Content script message listener
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(response => {
        if (response !== undefined) sendResponse(response);
    });
    return true; // Keep message channel open for async response
});

// Save image to IDB
async function saveScreenshotToDB(dataUrlOrBlob) {
    return new Promise((resolve, reject) => {
        const key = 'ss_' + Date.now();
        const openReq = indexedDB.open('SS_BUFFER_DB', 1);
        openReq.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images');
            }
        };
        openReq.onsuccess = () => {
            const db = openReq.result;
            const tx = db.transaction('images', 'readwrite');
            const store = tx.objectStore('images');

            let value = dataUrlOrBlob;
            if (typeof value === 'string' && value.startsWith('data:')) {
                try {
                    const parts = value.split(',');
                    const mime = parts[0].match(/:(.*?);/)[1];
                    const bstr = atob(parts[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) u8arr[n] = bstr.charCodeAt(n);
                    value = new Blob([u8arr], { type: mime });
                } catch (e) { /* fallback to string if conversion fails */ }
            }

            const putReq = store.put(value, key);
            putReq.onsuccess = () => resolve(key);
            putReq.onerror = () => reject(new Error("Storage Failure"));
        };
        openReq.onerror = () => reject(new Error("Database Error"));
    });
}

async function handleMessage(message, sender) {
    // Security check
    if (sender.tab) {
        const settings = await browser.storage.local.get('securityLevel');
        const level = settings.securityLevel || 'strict';
        if (isSensitiveSite(sender.tab.url, level)) {
            console.warn("[Another Share] Blocked request from sensitive site:", sender.tab.url);
            return { error: "Sensitive site" };
        }
    }

    console.log("[Another Share] Message received in background:", message.action);

    if (message.action === "getPlatforms") {
        return { platforms: PLATFORMS_DATA };
    }

    if (message.action === "ping") {
        return { pong: true };
    }

    if (message.action === "capturePage") {
        const tabId = sender.tab ? sender.tab.id : message.tabId;
        if (!tabId) return { error: "No tab" };
        const isFull = !!message.full;

        let originalZoom = 1;
        try {
            // 0. Reset Zoom
            try {
                originalZoom = await browser.tabs.getZoom(tabId);
                if (originalZoom !== 1) {
                    await browser.tabs.setZoom(tabId, 1);
                    await new Promise(r => setTimeout(r, 500)); // Wait for reflow
                }
            } catch (e) { console.warn("[Another Share] Zoom reset failed:", e); }

            // 1. Get dimensions
            const dims = await browser.scripting.executeScript({
                target: { tabId: tabId },
                func: () => ({
                    w: window.innerWidth,
                    h: window.innerHeight,
                    fullH: document.documentElement.scrollHeight,
                    dpr: window.devicePixelRatio
                })
            });
            const { w, h, fullH, dpr } = dims[0].result;

            // Helper to toggle fixed elements
            const toggleFixed = async (hide) => {
                await browser.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (shouldHide) => {
                        if (shouldHide) {
                            // Store original visibility map
                            window._asFixedCache = [];
                            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
                            let node;
                            while (node = walker.nextNode()) {
                                const style = window.getComputedStyle(node);
                                if (style.position === 'fixed' || style.position === 'sticky') {
                                    window._asFixedCache.push({ node, opacity: node.style.opacity });
                                    node.style.opacity = '0'; // Hide visually but keep layout
                                }
                            }
                            // Also hide scrollbars
                            document.documentElement.style.overflow = 'hidden';
                        } else {
                            // Restore
                            if (window._asFixedCache) {
                                window._asFixedCache.forEach(i => i.node.style.opacity = i.opacity);
                                delete window._asFixedCache;
                            }
                            document.documentElement.style.overflow = '';
                        }
                    },
                    args: [hide]
                });
            };

            let finalDataUrl;
            if (isFull && fullH > h) {
                // One-shot attempt first
                await browser.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        window.scrollTo(0, 0);
                        const meta = document.createElement('meta');
                        meta.name = 'viewport';
                        meta.id = 'as-screenshot-temp-meta';
                        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0';
                        document.head.appendChild(meta);
                        document.documentElement.offsetHeight;
                        setTimeout(() => {
                            const m = document.getElementById('as-screenshot-temp-meta');
                            if (m) m.remove();
                        }, 100);
                    }
                });
                await new Promise(r => setTimeout(r, 500));

                try {
                    const oneShot = await browser.tabs.captureVisibleTab(null, {
                        format: 'png',
                        rect: { x: 0, y: 0, width: w, height: Math.min(fullH, 16000) } // Increased limit for modern devices
                    });

                    const img = new Image();
                    await new Promise(r => { img.onload = r; img.src = oneShot; });
                    if (img.height >= (Math.min(fullH, 8000) * dpr) * 0.95) {
                        finalDataUrl = oneShot;
                    } else { throw new Error("Truncated"); }
                } catch (e) {
                    // Fallback to Stitching
                    Logger.info("One-shot failed, switching to stitch mode.");
                    await toggleFixed(true); // Hide headers for clean stitching

                    const canvas = document.createElement('canvas');
                    canvas.width = w * dpr;
                    const MAX_H = 50000; // Sanity cap only
                    canvas.height = Math.min(fullH, MAX_H) * dpr;
                    const ctx = canvas.getContext('2d');
                    let current = 0;

                    try {
                        while (current < Math.min(fullH, MAX_H)) {
                            await browser.scripting.executeScript({
                                target: { tabId: tabId },
                                func: (y) => window.scrollTo(0, y),
                                args: [current]
                            });
                            // Increased delay for heavy sites (BalkanInsight) to load lazy images
                            await new Promise(r => setTimeout(r, 800));

                            const chunk = await browser.tabs.captureVisibleTab(null, {
                                format: 'png',
                                rect: { x: 0, y: 0, width: w, height: h }
                            });
                            const img = new Image();
                            await new Promise(res => { img.onload = res; img.src = chunk; });

                            const remaining = Math.min(fullH, MAX_H) - current;
                            const drawH = Math.min(h, remaining);

                            if (drawH > 0) {
                                ctx.drawImage(img, 0, 0, w * dpr, drawH * dpr, 0, current * dpr, w * dpr, drawH * dpr);
                            }
                            current += h;
                        }
                    } finally {
                        await toggleFixed(false); // Restore
                    }
                }
                await browser.scripting.executeScript({ target: { tabId: tabId }, func: () => window.scrollTo(0, 0) });
            } else {
                // Viewport only
                finalDataUrl = await browser.tabs.captureVisibleTab(null, {
                    format: 'png',
                    rect: { x: 0, y: 0, width: w, height: h }
                });
            }

            if (finalDataUrl && message.openTab) {
                try {
                    const key = await saveScreenshotToDB(finalDataUrl);
                    browser.tabs.create({
                        url: browser.runtime.getURL(`popup/viewer_image.html?key=${key}`),
                        active: true
                    });
                } catch (err) {
                    // If DB fails, try direct data URL (might still fail on Android but it's a last resort)
                    browser.tabs.create({ url: finalDataUrl });
                }
            }

            return { dataUrl: finalDataUrl };
        } catch (err) {
            console.error("[Another Share] Capture failed:", err);
            return { error: err.message };
        } finally {
            try {
                if (originalZoom !== 1) {
                    await browser.tabs.setZoom(tabId, originalZoom);
                }
            } catch (e) { }
        }
    }

    if (message.action === "saveTextFile") {
        const { text, filename } = message;
        if (!text) return;

        try {
            // Firefox Android blocks data: URLs in tabs.create, so we use a viewer page
            await browser.storage.local.set({
                viewerText: text,
                viewerTitle: filename
            });
            browser.tabs.create({
                url: browser.runtime.getURL("popup/viewer.html"),
                active: true
            });
            return { success: true };
        } catch (err) {
            console.error("[Another Share] Text save failed:", err);
            return { error: err.message };
        }
    }

    if (message.action === "performPrint") {
        const tabId = sender.tab ? sender.tab.id : message.tabId;
        if (!tabId) return;
        browser.scripting.executeScript({
            target: { tabId: tabId },
            func: () => window.print()
        });
        return;
    }

    if (message.action === "addToReadLater") {
        const { item } = message;
        if (!item) return;

        try {
            const { readLater = [] } = await browser.storage.local.get('readLater');
            // Avoid duplicates
            if (!readLater.some(i => i.url === item.url)) {
                readLater.unshift(item);
                // Keep only last 20 items
                if (readLater.length > 20) readLater.pop();
                await browser.storage.local.set({ readLater });
            }
            return { success: true };
        } catch (e) {
            console.error("Read Later save failed", e);
            return { error: e.message };
        }
    }

    if (message.action === "performShare") {
        const { platformId, title, url, text } = message;
        const pureId = platformId.replace("share-", "");
        const cleanedUrl = cleanUrl(url);
        const config = PLATFORMS_DATA[platformId];

        if (platforms[pureId]) {
            if (config && config.limit && text && text.length > config.limit - 50) {
                const chunks = chunkText(text, platformId, title, cleanedUrl);
                if (chunks.length > 1) {
                    browser.tabs.create({ url: platforms[pureId](title, cleanedUrl, chunks[0].text) });
                    browser.tabs.sendMessage(sender.tab.id, {
                        action: "notifyThread",
                        message: `Thread Started! ${chunks.length} parts created. Part 1 opened. Part 2 copied to clipboard.`
                    });
                    browser.scripting.executeScript({
                        target: { tabId: sender.tab.id },
                        func: (t) => navigator.clipboard.writeText(t),
                        args: [chunks[1].text]
                    });
                    return;
                }
            }
            const shareUrl = platforms[pureId](title, cleanedUrl, text);
            browser.tabs.create({ url: shareUrl });
        }
        return;
    }
}

function chunkText(quote, platformId, title, url) {
    const config = PLATFORMS_DATA[platformId];
    if (!config || !config.limit) return [{ text: quote }];

    const chunks = [];
    let remaining = quote.trim();
    const urlLen = url ? (config.urlWeight || url.length) : 0;
    let partNum = 1;

    while (remaining.length > 0) {
        const reserved = title.length + (partNum === 1 ? urlLen + 18 : 16);
        const maxChunkLen = config.limit - reserved;

        if (remaining.length <= maxChunkLen) {
            chunks.push(remaining);
            break;
        }

        let cutIdx = maxChunkLen;
        const lastSpace = remaining.lastIndexOf(' ', maxChunkLen);
        if (lastSpace > maxChunkLen * 0.7) cutIdx = lastSpace;

        chunks.push(remaining.substring(0, cutIdx).trim());
        remaining = remaining.substring(cutIdx).trim();
        partNum++;
    }

    return chunks.map((q, i) => {
        const meta = `${title} (${i + 1}/${chunks.length})`;
        return i === 0 ? { text: q, meta } : { text: `"${q}" — ${meta}` };
    });
}

// Lifecycle listeners
browser.runtime.onInstalled.addListener(() => {
    console.log("[Another Share] Extension installed.");
    securePurgeStorage();
});

browser.runtime.onStartup.addListener(() => {
    securePurgeStorage();
});
