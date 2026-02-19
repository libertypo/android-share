/**
 * Privacy-hardened Centralized Logging Facility
 * Features: Circular buffer, sanitization of sensitive data, and device-local storage.
 */
const Logger = {
    MAX_LOGS: 100,
    SYSTEM_NAME: 'Another Share',

    /**
     * Records a log entry if logging is enabled.
     * @param {string} level - info, warn, error
     * @param {string} message - Human-readable message
     * @param {Object} [details] - Optional system details (automatically sanitized)
     */
    _queue: [],
    _isProcessing: false,

    async _record(level, message, details = null) {
        try {
            const { debugLogging } = await browser.storage.local.get('debugLogging');
            if (!debugLogging) return;

            this._queue.push({ level, message, details });
            this._processQueue();
        } catch (e) {
            // fast-fail silently if storage isn't ready
        }
    },

    async _processQueue() {
        if (this._isProcessing || this._queue.length === 0) return;
        this._isProcessing = true;

        try {
            const item = this._queue.shift();
            const { logs = [] } = await browser.storage.local.get('logs');
            console.log(`[Diagnostic] ${item.level.toUpperCase()}: ${item.message}`, item.details || '');

            const sanitizedDetails = item.details ? this._sanitize(item.details) : null;
            const entry = {
                timestamp: new Date().toISOString(),
                level: item.level.toUpperCase(),
                message: item.message,
                details: sanitizedDetails,
                context: (typeof window !== 'undefined' ? (window.location.pathname.split('/').pop() || 'popup') : 'background')
            };

            logs.push(entry);
            if (logs.length > this.MAX_LOGS) logs.shift();
            await browser.storage.local.set({ logs });
        } catch (e) {
            console.error('Logger failed:', e);
        } finally {
            this._isProcessing = false;
            this._processQueue();
        }
    },

    /**
     * Strips URLs, Titles, and Selections from metadata objects
     */
    _sanitize(obj) {
        if (obj instanceof Error) {
            return {
                name: obj.name,
                message: obj.message,
                stack: obj.stack
            };
        }

        if (typeof obj !== 'object' || obj === null) return obj;

        const sensitiveKeys = ['url', 'title', 'text', 'selection', 'originalUrl', 'path'];
        const sanitized = Array.isArray(obj) ? [] : {};

        for (let [key, value] of Object.entries(obj)) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
                sanitized[key] = '[MASKED_FOR_PRIVACY]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this._sanitize(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    },

    info(msg, details) {
        console.info(`[${this.SYSTEM_NAME}] ${msg}`, details || '');
        return this._record('info', msg, details);
    },

    warn(msg, details) {
        console.warn(`[${this.SYSTEM_NAME}] ${msg}`, details || '');
        return this._record('warn', msg, details);
    },

    error(msg, details) {
        console.error(`[${this.SYSTEM_NAME}] ${msg}`, details || '');
        // For errors, we also ensure the detail itself isn't a naked URL string
        const safeDetails = typeof details === 'string' && details.includes('://') ? '[URL_HIDDEN]' : details;
        return this._record('error', msg, safeDetails);
    },

    async clear() {
        await browser.storage.local.remove('logs');
        console.log(`[${this.SYSTEM_NAME}] Logs cleared.`);
    },

    async getExport() {
        const { logs = [] } = await browser.storage.local.get('logs');
        if (logs.length === 0) return "No logs found.";

        return logs.map(l => {
            const detailStr = l.details ? ` | Data: ${JSON.stringify(l.details)}` : '';
            return `[${l.timestamp}] [${l.context}] [${l.level}] ${l.message}${detailStr}`;
        }).join('\n');
    }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}
if (typeof globalThis !== 'undefined') {
    globalThis.Logger = Logger;
} else if (typeof window !== 'undefined') {
    window.Logger = Logger;
}

// Freeze the Logger to prevent runtime tampering
Object.freeze(Logger);
