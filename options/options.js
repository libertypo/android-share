const defaultOrder = [
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

const platformNames = {
    'share-x': 'X (Twitter)',
    'share-bluesky': 'Bluesky',
    'share-mastodon': 'Mastodon',
    'share-whatsapp': 'WhatsApp',
    'share-telegram': 'Telegram',
    'share-linkedin': 'LinkedIn',
    'share-facebook': 'Facebook',
    'share-reddit': 'Reddit',
    'share-system': 'System Share',
    'share-save': 'Print/PDF',
    'share-print': 'Print',
    'share-text': 'Save Text',
    'share-markdown': 'Markdown Link',
    'share-read-later': 'Read Later',
    'share-custom': 'Custom Service'
};

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('status');
    const templateInput = document.getElementById('custom-template');
    const platformList = document.getElementById('platform-list');
    const securitySelect = document.getElementById('security-level');

    // Load settings
    const data = await browser.storage.local.get(['customTemplate', 'platformOrder', 'hiddenPlatforms', 'debugLogging', 'securityLevel']);

    if (data.customTemplate) templateInput.value = data.customTemplate;
    if (data.securityLevel) {
        securitySelect.value = data.securityLevel;
    } else {
        // Default to Strict as previously implemented, or Moderate as per nuance request
        securitySelect.value = 'strict';
    }
    const logToggle = document.getElementById('debug-logging-toggle');
    logToggle.checked = !!data.debugLogging;

    logToggle.addEventListener('change', () => {
        browser.storage.local.set({ debugLogging: logToggle.checked });
        showStatus(logToggle.checked ? 'Logging enabled' : 'Logging disabled');
        if (logToggle.checked) {
            Logger.info('Manual logging enabled by user');
        }
    });

    // Log Management
    document.getElementById('view-logs').addEventListener('click', async () => {
        const logViewer = document.getElementById('log-viewer');
        const content = await Logger.getExport();
        logViewer.textContent = content;
        logViewer.style.display = 'block';
    });

    document.getElementById('clear-logs').addEventListener('click', async () => {
        if (confirm('Clear all stored logs?')) {
            await Logger.clear();
            document.getElementById('log-viewer').textContent = 'Logs cleared.';
            showStatus('Logs wiped');
        }
    });

    document.getElementById('download-logs').addEventListener('click', async () => {
        const content = await Logger.getExport();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `smart_share_debug_${new Date().toISOString().split('T')[0]}.log`;
        link.click();
        URL.revokeObjectURL(url);
    });

    const order = data.platformOrder || defaultOrder;
    const hidden = data.hiddenPlatforms || [];

    // Render platforms
    function renderList() {
        while (platformList.firstChild) {
            platformList.removeChild(platformList.firstChild);
        }
        order.forEach(id => {
            const div = document.createElement('div');
            div.className = 'platform-item';
            div.draggable = true;
            div.dataset.id = id;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !hidden.includes(id);

            const label = document.createElement('span');
            label.textContent = platformNames[id] || id;

            div.appendChild(checkbox);
            div.appendChild(label);

            // Drag and drop events
            div.addEventListener('dragstart', () => div.classList.add('dragging'));
            div.addEventListener('dragend', () => div.classList.remove('dragging'));

            platformList.appendChild(div);
        });
    }

    platformList.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(platformList, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (afterElement == null) {
            platformList.appendChild(dragging);
        } else {
            platformList.insertBefore(dragging, afterElement);
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.platform-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    renderList();

    // Save Logic
    document.getElementById('save-template').addEventListener('click', () => {
        const candidate = (templateInput.value || '').trim();
        if (candidate && !ASCommon.isValidCustomTemplate(candidate)) {
            showStatus('Invalid template: use an https URL and include {url}.', 'error');
            return;
        }
        browser.storage.local.set({ customTemplate: candidate });
        showStatus('Template saved!', 'success');
    });

    document.getElementById('save-order').addEventListener('click', () => {
        const items = [...platformList.querySelectorAll('.platform-item')];
        const newOrder = items.map(i => i.dataset.id);
        const newHidden = items.filter(i => !i.querySelector('input').checked).map(i => i.dataset.id);

        browser.storage.local.set({
            platformOrder: newOrder,
            hiddenPlatforms: newHidden,
            securityLevel: securitySelect.value
        });
        showStatus('Settings saved!', 'success');
    });

    function showStatus(msg, type = 'success') {
        status.textContent = msg;
        status.className = type === 'error' ? 'status-error' : 'status-success';
        setTimeout(() => { status.textContent = ''; status.className = ''; }, 2000);
    }
});
