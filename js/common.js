const ASCommon = (() => {
    const ALLOWED_SHARE_SCHEMES = ['https:'];

    const TRACKING_PARAMS = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
        '_ga', '_gl', 'yclid', 'ref', 'source', 'original_referrer'
    ];

    const MODERATE_PROTECTION_LIST = ['bank', 'paypal', 'stripe', 'gov', 'mil', 'healthcare'];
    const PRIVACY_PROTECTION_LIST = [
        ...MODERATE_PROTECTION_LIST,
        'ledger', 'trezor', 'coinbase', 'binance', 'mychart', 'epic',
        'police', 'interpol', 'proton.me', 'tutanota', 'bitwarden',
        '1password', 'lastpass'
    ];

    function cleanUrl(urlStr) {
        if (!urlStr || urlStr.startsWith('file://')) return '';
        try {
            const url = new URL(urlStr);
            TRACKING_PARAMS.forEach((param) => {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                }
            });
            return url.toString();
        } catch (e) {
            return urlStr;
        }
    }

    function isSensitiveUrl(url, level = 'strict') {
        if (!url) return true;
        try {
            const domain = new URL(url).hostname.toLowerCase();
            const list = level === 'moderate' ? MODERATE_PROTECTION_LIST : PRIVACY_PROTECTION_LIST;
            return list.some((pattern) => domain.includes(pattern));
        } catch (e) {
            return true;
        }
    }

    function isAllowedShareUrl(url) {
        if (!url) return false;
        try {
            const parsed = new URL(url);
            return ALLOWED_SHARE_SCHEMES.includes(parsed.protocol);
        } catch (e) {
            return false;
        }
    }

    function expandCustomTemplate(template, title, url) {
        return template
            .replaceAll('{url}', encodeURIComponent(url || ''))
            .replaceAll('{title}', encodeURIComponent(title || ''));
    }

    function isValidCustomTemplate(template) {
        if (!template || typeof template !== 'string') return false;
        const trimmed = template.trim();
        if (!trimmed.includes('{url}')) return false;

        const probeUrl = expandCustomTemplate(trimmed, 'Title', 'https://example.com');
        return isAllowedShareUrl(probeUrl);
    }

    return {
        ALLOWED_SHARE_SCHEMES,
        TRACKING_PARAMS,
        MODERATE_PROTECTION_LIST,
        PRIVACY_PROTECTION_LIST,
        cleanUrl,
        isSensitiveUrl,
        isAllowedShareUrl,
        expandCustomTemplate,
        isValidCustomTemplate
    };
})();

if (typeof globalThis !== 'undefined') {
    globalThis.ASCommon = ASCommon;
}