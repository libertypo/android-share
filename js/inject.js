/**
 * This script runs in the actual page execution context (Main World).
 * This is necessary because Content Scripts run in an "Isolated World"
 * and cannot directly override native APIs like navigator.share.
 */
(function () {
    if (navigator.share) {
        const nativeShare = navigator.share.bind(navigator);

        navigator.share = async (data) => {
            // Dispatch a custom event for the content script to pick up
            const event = new CustomEvent('extension_intercepted_share', {
                detail: {
                    title: data.title,
                    text: data.text,
                    url: data.url
                }
            });

            window.dispatchEvent(event);

            // We return a promise that resolves immediately to avoid the 
            // website waiting for the native Android menu.
            return Promise.resolve();
        };

        console.log("Another Share Extension: navigator.share intercepted.");
    }
})();
