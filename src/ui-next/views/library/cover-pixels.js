// cover-pixels: the pixels of a cover image, 32 x 32, for the colors of a list's header (cover-palette.js).
// It reads no engine global, only the page's own canvas and window.desktopApi (like shell/about-settings.js), so it is a view helper, not a bridge.
// A file:// cover cannot be read from a canvas (tainted), so the desktop app hands over a small PNG made by the main process
// (electron/cover-thumb.js); a plain browser, or a cover that is already readable (data:, blob:, same origin), is drawn directly.

const SIZE = 32;

function readPixels(src) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            try {
                const canvas = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
                const context = canvas.getContext('2d', { willReadFrequently: true });
                context.drawImage(image, 0, 0, SIZE, SIZE);
                resolve(context.getImageData(0, 0, SIZE, SIZE).data); // throws for a tainted canvas
            } catch (_) {
                resolve(null);
            }
        };
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

/** RGBA pixels (a Uint8ClampedArray) of the cover at `url`, or null when they cannot be read. Never throws. */
export async function coverPixels(url) {
    if (!url || /^data:image\/gif;base64,R0lGOD/.test(url)) return null;
    const api = window.desktopApi;
    if (/^file:/i.test(url) && api && api.supports('files.readCoverThumb')) {
        let blobUrl = '';
        try {
            const result = await api.files.readCoverThumb(url);
            if (!result || !result.success) return null;
            blobUrl = URL.createObjectURL(new Blob([result.data], { type: 'image/png' }));
            return await readPixels(blobUrl);
        } catch (_) {
            return null;
        } finally {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        }
    }
    return readPixels(url);
}
