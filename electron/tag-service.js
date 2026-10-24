// The one place that reads and writes audio tags. Callers use read, write and writeMany; the backend behind them can change
// (today the Python/mutagen script in metadata-editor.js) without touching the UI or the callers.
//
// writeMany returns, for every file, the values that were in the file before the write ("previous"), so a journal can undo it.
// A file whose tags cannot be read is not written: saving over tags we could not read could lose them.
// A failed file says why in `error`; when the backend itself is not available (no Python, no mutagen) it also sets `reason`
// ('no-python' | 'no-mutagen' | 'failed', see electron/metadata-editor.js) so the screen can tell that apart from one bad file.

const pythonBackend = require('./metadata-editor');

function createTagService(backend = pythonBackend) {
    const read = (fileUrl) => backend.getAudioMetadata(fileUrl);

    const write = (fileUrl, metadata, coverPath = '') => backend.saveAudioMetadata(fileUrl, metadata, coverPath);

    async function writeMany(items) {
        const results = [];
        for (const item of Array.isArray(items) ? items : []) {
            const fileUrl = item?.fileUrl;
            try {
                const before = await read(fileUrl);
                if (!before?.success) {
                    results.push({ fileUrl, success: false, error: before?.error || 'Could not read the current tags', ...(before?.reason ? { reason: before.reason } : {}) });
                    continue;
                }
                const saved = await write(fileUrl, item.metadata || {}, item.coverPath || '');
                results.push(saved?.success
                    ? { fileUrl, success: true, metadata: saved.metadata, previous: before.metadata, skipped: saved.skipped || [] }
                    : { fileUrl, success: false, error: saved?.error || 'Failed to save metadata', ...(saved?.reason ? { reason: saved.reason } : {}) });
            } catch (error) {
                results.push({ fileUrl, success: false, error: error?.message || 'Failed to save metadata' });
            }
        }
        return results;
    }

    return { read, write, writeMany };
}

module.exports = { createTagService };
