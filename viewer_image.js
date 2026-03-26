async function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('active');
    setTimeout(() => t.classList.remove('active'), 2500);
}

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    const img = document.getElementById('screenshot-img');
    const loading = document.getElementById('loading-msg');

    if (!key) {
        loading.innerText = "Error: No image key provided.";
        return;
    }

    try {
        const openReq = indexedDB.open('SS_BUFFER_DB', 1);
        openReq.onsuccess = () => {
            const db = openReq.result;
            const tx = db.transaction('images', 'readonly');
            const store = tx.objectStore('images');
            const getReq = store.get(key);

            getReq.onsuccess = () => {
                const data = getReq.result;
                if (data) {
                    loading.style.display = 'none';
                    img.style.display = 'block';
                    // data could be a Blob or a Data URL
                    if (data instanceof Blob) {
                        img.src = URL.createObjectURL(data);
                    } else {
                        img.src = data;
                    }
                } else {
                    loading.innerText = "Screenshot not found. It may have expired.";
                }
            };
        };
        openReq.onerror = () => {
            loading.innerText = "Failed to open image database.";
        };
    } catch (err) {
        loading.innerText = "Error loading image.";
    }

    document.getElementById('btn-print').onclick = () => {
        window.print();
    };

    document.getElementById('btn-download').onclick = () => {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = `screenshot_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("Saving image...");
    };
});
