const VERSION = window.__CROP_ASSET_VERSION__ || '20241005T0900';
window.__CROP_ASSET_VERSION__ = VERSION;

const withVersion = (path) => {
    if (!VERSION) {
        return path;
    }
    return path.includes('?') ? `${path}&v=${VERSION}` : `${path}?v=${VERSION}`;
};

function waitForCardDesigner(timeout = 10000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            if (window.cardDesigner) {
                resolve(window.cardDesigner);
                return;
            }
            if (Date.now() - start > timeout) {
                resolve(null);
                return;
            }
            requestAnimationFrame(check);
        };
        check();
    });
}

(async () => {
    try {
        const designer = await waitForCardDesigner();
        if (!designer) {
            console.warn('[CropLoader] CardDesigner not found, crop module skipped.');
            return;
        }
        const { CropManager } = await import(withVersion('./core/CropManager.js'));
        new CropManager(designer);
    } catch (error) {
        console.warn('[CropLoader] Failed to initialize crop module:', error);
    }
})();
