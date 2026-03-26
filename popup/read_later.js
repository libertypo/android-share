document.addEventListener('DOMContentLoaded', async () => {
    const listEl = document.getElementById('list');
    const clearBtn = document.getElementById('clear-btn');

    const render = (items = []) => {
        listEl.replaceChildren();
        if (items.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'No articles in your list.';
            listEl.appendChild(emptyState);
            return;
        }

        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'list-item';
            const safeUrl = ASCommon.isAllowedShareUrl(item.url) ? item.url : '';

            const a = document.createElement('a');
            a.className = 'item-title';
            a.href = safeUrl || '#';
            a.textContent = item.title || item.url;
            a.target = "_blank";
            a.rel = 'noopener noreferrer';

            const meta = document.createElement('div');
            meta.className = 'item-meta';
            const date = new Date(item.timestamp).toLocaleString();
            meta.textContent = `Added: ${date}`;

            li.appendChild(a);
            li.appendChild(meta);

            // Swipe to remove (simple tap-hold simulation)
            li.onclick = (e) => {
                if (e.target !== a) {
                    if (safeUrl) {
                        browser.tabs.create({ url: safeUrl });
                    }
                }
            };

            listEl.appendChild(li);
        });
    };

    const load = async () => {
        const { readLater = [] } = await browser.storage.local.get('readLater');
        render(readLater);
    };

    clearBtn.addEventListener('click', async () => {
        if (confirm("Clear your reading list?")) {
            await browser.storage.local.set({ readLater: [] });
            load();
        }
    });

    load();
});
