document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const storageKey = params.get('key');
    const img = document.getElementById('print-image');

    const triggerPrint = () => {
        window.focus();
        setTimeout(() => window.print(), 1000); // 1s buffer for Android rendering
    };

    if (storageKey) {
        try {
            // DB_NAME must match popup.js exactly: SS_BUFFER_DB
            const openReq = indexedDB.open('SS_BUFFER_DB', 1);
            openReq.onsuccess = () => {
                const db = openReq.result;
                const tx = db.transaction('images', 'readonly');
                const store = tx.objectStore('images');
                const getReq = store.get(storageKey);

                getReq.onsuccess = () => {
                    const blob = getReq.result;
                    if (blob instanceof Blob) {
                        img.src = URL.createObjectURL(blob);
                        img.onload = triggerPrint;

                        // Cleanup after 1 min or immediately after load
                        setTimeout(() => {
                            const delTx = db.transaction('images', 'readwrite');
                            delTx.objectStore('images').delete(storageKey);
                        }, 60000);
                    }
                };
            };
        } catch (err) {
            console.error("Print retrieval failed", err);
        }
    }
});
