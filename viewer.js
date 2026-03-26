document.addEventListener('DOMContentLoaded', async () => {
    const contentEl = document.getElementById('content');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const toast = document.getElementById('toast');

    const showToast = (msg) => {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    };

    try {
        const { viewerText, viewerTitle } = await browser.storage.local.get(['viewerText', 'viewerTitle']);

        if (!viewerText || !viewerText.elements) {
            contentEl.textContent = "No readable content found. Extraction may have failed on this specific page.";
            return;
        }

        contentEl.innerHTML = ''; // Clear loading

        // Add Header
        const header = document.createElement('div');
        header.style.marginBottom = '24px';
        header.style.borderBottom = '1px solid rgba(128,128,128,0.2)';
        header.style.paddingBottom = '16px';
        const h1 = document.createElement('h1');
        h1.style.margin = '0 0 8px 0';
        h1.style.fontSize = '24px';
        h1.textContent = viewerText.header.title;

        const sourceDiv = document.createElement('div');
        sourceDiv.style.fontSize = '13px';
        sourceDiv.style.opacity = '0.6';
        sourceDiv.textContent = `Source: ${viewerText.header.url}`;

        const dateDiv = document.createElement('div');
        dateDiv.style.fontSize = '12px';
        dateDiv.style.opacity = '0.5';
        dateDiv.textContent = `Extracted: ${viewerText.header.date}`;

        header.appendChild(h1);
        header.appendChild(sourceDiv);
        header.appendChild(dateDiv);
        contentEl.appendChild(header);

        // Render Article Elements
        let plainTextBuffer = `${viewerText.header.title}\n${viewerText.header.url}\n\n`;

        viewerText.elements.forEach(el => {
            if (el.type === 'image') {
                const img = document.createElement('img');
                img.src = el.src;
                img.style.display = 'block';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.margin = '24px auto';
                img.style.borderRadius = '8px';
                img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                contentEl.appendChild(img);
                plainTextBuffer += `[IMAGE: ${el.src}]\n\n`;
            } else if (el.type === 'text') {
                const p = document.createElement(el.tag || 'p');
                p.textContent = el.content;
                // Add some basic styling based on tags
                if (el.tag?.startsWith('H')) {
                    p.style.marginTop = '1.5em';
                    p.style.fontWeight = '700';
                }
                contentEl.appendChild(p);
                plainTextBuffer += `${el.content}\n\n`;
            }
        });

        copyBtn.onclick = () => {
            navigator.clipboard.writeText(plainTextBuffer);
            showToast("Text copied to clipboard!");
        };

        downloadBtn.onclick = () => {
            const blob = new Blob([plainTextBuffer], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = viewerTitle || 'article.txt';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 100);
            showToast("Download started!");
        };

        // Clear sensitive storage
        browser.storage.local.remove(['viewerText', 'viewerTitle']);
    } catch (err) {
        contentEl.textContent = "Error loading content: " + err.message;
    }
});
