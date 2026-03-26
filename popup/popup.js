const TOOL_IDS = new Set([
    'share-system',
    'share-save',
    'share-print',
    'share-text',
    'share-markdown',
    'share-read-later'
]);

function isRestrictedUrl(url, level = 'strict') {
    if (!url) return true;
    const coreRestricted = ['about:', 'moz-extension:', 'view-source:', 'chrome:', 'file:'].some((prefix) => url.startsWith(prefix)) ||
        url.includes('addons.mozilla.org');

    return coreRestricted || ASCommon.isSensitiveUrl(url, level);
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 2000);
}

function parseSvgIcon(markup) {
    if (!markup) return null;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(markup, 'text/html');
        return doc.querySelector('svg');
    } catch (e) {
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const titleEl = document.getElementById('article-title');
    const urlEl = document.getElementById('article-url');
    const gridEl = document.getElementById('share-grid');
    const counterEl = document.getElementById('char-counter');

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
        showToast('No active tab', 'error');
        return;
    }

    const { securityLevel = 'strict' } = await browser.storage.local.get('securityLevel');
    const safeTitle = (tab.title || 'Unknown').split(/[/\\]/).pop();
    const safeUrl = ASCommon.cleanUrl(tab.url || '');

    titleEl.textContent = safeTitle;
    urlEl.textContent = safeUrl || 'Unknown Source';

    let selectedText = '';
    if (!isRestrictedUrl(tab.url, securityLevel)) {
        try {
            const result = await browser.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.getSelection().toString().trim()
            });
            selectedText = result[0]?.result || '';
        } catch (e) {
            selectedText = '';
        }
    }

    counterEl.textContent = String(selectedText.length);

    const platformResponse = await browser.runtime.sendMessage({ action: 'getPlatforms' });
    const platforms = platformResponse?.platforms || {};

    if (!Object.keys(platforms).length) {
        const emptyState = document.createElement('div');
        emptyState.style.gridColumn = '1 / -1';
        emptyState.style.textAlign = 'center';
        emptyState.style.opacity = '0.7';
        emptyState.style.padding = '12px';
        emptyState.textContent = 'No platforms enabled.';
        gridEl.replaceChildren(emptyState);
    }

    const onShare = async (platformId) => {
        if (platformId === 'share-system') {
            if (!navigator.share) {
                showToast('System share not supported here', 'error');
                return;
            }
            try {
                await navigator.share({ title: safeTitle, url: safeUrl, text: selectedText });
                window.close();
            } catch (e) {
                showToast('System share cancelled', 'warn');
            }
            return;
        }

        if (platformId === 'share-print') {
            await browser.runtime.sendMessage({ action: 'performPrint', tabId: tab.id });
            window.close();
            return;
        }

        if (platformId === 'share-save') {
            await browser.runtime.sendMessage({ action: 'performSavePdf', tabId: tab.id });
            showToast('Use print dialog to save as PDF');
            window.close();
            return;
        }

        if (platformId === 'share-markdown') {
            try {
                await navigator.clipboard.writeText(`[${safeTitle}](${safeUrl})`);
                showToast('Markdown link copied');
            } catch (e) {
                showToast('Clipboard blocked', 'error');
            }
            return;
        }

        if (platformId === 'share-read-later') {
            await browser.runtime.sendMessage({
                action: 'addToReadLater',
                item: { title: safeTitle, url: safeUrl, timestamp: Date.now() }
            });
            showToast('Saved to Read Later');
            return;
        }

        if (platformId === 'share-text') {
            try {
                const extraction = await browser.tabs.sendMessage(tab.id, { action: 'extractText' });
                if (!extraction?.text) {
                    showToast('Could not extract article text', 'error');
                    return;
                }
                await browser.runtime.sendMessage({
                    action: 'saveTextFile',
                    text: extraction.text,
                    filename: `article_${Date.now()}.txt`
                });
                window.close();
            } catch (e) {
                showToast('Extraction failed', 'error');
            }
            return;
        }

        await browser.runtime.sendMessage({
            action: 'performShare',
            platformId,
            title: safeTitle,
            url: safeUrl,
            text: selectedText,
            tabId: tab.id
        });
        window.close();
    };

    Object.keys(platforms).forEach((id) => {
        const entry = platforms[id];
        const button = document.createElement('button');
        button.className = 'share-btn';
        button.id = id;
        button.dataset.platform = id.replace('share-', '');
        button.title = entry.title;

        const icon = document.createElement('span');
        icon.className = 'icon-wrapper';
        const svg = parseSvgIcon(entry.icon);
        if (svg) {
            icon.appendChild(svg);
        } else {
            icon.textContent = entry.title.slice(0, 1).toUpperCase();
        }

        button.appendChild(icon);
        button.addEventListener('click', () => onShare(id));

        if (TOOL_IDS.has(id)) {
            button.classList.add('tool-btn');
        }

        gridEl.appendChild(button);
    });

    document.getElementById('open-settings')?.addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL('options/options.html') });
        window.close();
    });

    document.getElementById('open-read-later')?.addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL('popup/read_later.html') });
        window.close();
    });
});
