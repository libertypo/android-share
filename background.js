// Verified Background Script Start
console.log("[Another Share] Background script initializing...");

// From js/platforms.js

const DEFAULT_PLATFORM_ORDER = [
    'share-system',
    'share-save',
    'share-print',
    'share-text',
    'share-markdown',
    'share-read-later',
    'share-x',
    'share-bluesky',
    'share-mastodon',
    'share-whatsapp',
    'share-telegram',
    'share-linkedin',
    'share-facebook',
    'share-reddit',
    'share-custom'
];

const CUSTOM_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"></path><path d="M12 3v18"></path></svg>';

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

async function getConfiguredPlatforms() {
    const settings = await browser.storage.local.get(['platformOrder', 'hiddenPlatforms', 'customTemplate']);
    const configured = { ...PLATFORMS_DATA };
    const customTemplate = (settings.customTemplate || '').trim();

    if (ASCommon.isValidCustomTemplate(customTemplate)) {
        configured['share-custom'] = {
            title: 'Custom',
            icon: CUSTOM_ICON,
            template: customTemplate
        };
    }

    const hidden = new Set(settings.hiddenPlatforms || []);
    const preferredOrder = Array.isArray(settings.platformOrder) && settings.platformOrder.length > 0
        ? settings.platformOrder
        : DEFAULT_PLATFORM_ORDER;

    const availableIds = Object.keys(configured);
    const orderedIds = [
        ...preferredOrder.filter((id) => availableIds.includes(id)),
        ...availableIds.filter((id) => !preferredOrder.includes(id))
    ];

    const platforms = {};
    orderedIds.forEach((id) => {
        if (!hidden.has(id)) {
            platforms[id] = configured[id];
        }
    });

    return platforms;
}



// Content script message listener
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(response => {
        if (response !== undefined) sendResponse(response);
    });
    return true; // Keep message channel open for async response
});



async function handleMessage(message, sender) {
    // Security check
    if (sender.tab) {
        const settings = await browser.storage.local.get('securityLevel');
        const level = settings.securityLevel || 'strict';
        if (ASCommon.isSensitiveUrl(sender.tab.url, level)) {
            console.warn("[Another Share] Blocked request from sensitive site:", sender.tab.url);
            return { error: "Sensitive site" };
        }
    } else if (message.tabId) {
        const targetTab = await browser.tabs.get(message.tabId).catch(() => null);
        if (targetTab && targetTab.url) {
            const settings = await browser.storage.local.get('securityLevel');
            const level = settings.securityLevel || 'strict';
            if (ASCommon.isSensitiveUrl(targetTab.url, level)) {
                console.warn("[Another Share] Blocked request from sensitive site:", targetTab.url);
                return { error: "Sensitive site" };
            }
        }
    }

    console.log("[Another Share] Message received in background:", message.action);

    if (message.action === "getPlatforms") {
        return { platforms: await getConfiguredPlatforms() };
    }

    if (message.action === "ping") {
        return { pong: true };
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

    if (message.action === "performSavePdf") {
        const tabId = sender.tab ? sender.tab.id : message.tabId;
        if (!tabId) return;
        browser.scripting.executeScript({
            target: { tabId: tabId },
            func: () => window.print()
        });
        return { success: true };
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
        const contextTabId = sender.tab ? sender.tab.id : message.tabId;
        const pureId = platformId.replace("share-", "");
        const cleanedUrl = ASCommon.cleanUrl(url);
        const config = PLATFORMS_DATA[platformId];

        if (platformId === 'share-custom') {
            const { customTemplate } = await browser.storage.local.get('customTemplate');
            if (!ASCommon.isValidCustomTemplate(customTemplate || '')) {
                return { error: 'No custom template configured' };
            }
            const targetUrl = ASCommon.expandCustomTemplate(customTemplate.trim(), title, cleanedUrl);
            if (!ASCommon.isAllowedShareUrl(targetUrl)) {
                return { error: 'Custom template URL protocol is not allowed' };
            }
            browser.tabs.create({ url: targetUrl });
            return { success: true };
        }

        if (platforms[pureId]) {
            if (config && config.limit && text && text.length > config.limit - 50) {
                const chunks = chunkText(text, platformId, title, cleanedUrl);
                if (chunks.length > 1) {
                    browser.tabs.create({ url: platforms[pureId](title, cleanedUrl, chunks[0].text) });
                    if (contextTabId) {
                        browser.tabs.sendMessage(contextTabId, {
                            action: "notifyThread",
                            message: `Thread Started! ${chunks.length} parts created. Part 1 opened. Part 2 copied to clipboard.`
                        });
                        browser.scripting.executeScript({
                            target: { tabId: contextTabId },
                            func: (t) => navigator.clipboard.writeText(t),
                            args: [chunks[1].text]
                        });
                    }
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
});
