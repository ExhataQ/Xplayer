// Where the person's own OpenRouter key lives (plan PE-02, decision DP6).
//
// The key is encrypted with Electron's safeStorage (Windows DPAPI) and saved in the user's data
// folder, never in the repository and never in the page. The page can only learn whether a key is
// set and its last four characters. If the system cannot encrypt, the key is refused rather than
// saved as plain text.

const fs = require('fs');
const path = require('path');

const KEY_FORMAT = /^[\x21-\x7e]{16,300}$/;

function createKeyStore({ file, safeStorage }) {
    function read() {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            return data && typeof data.cipher === 'string' ? data : null;
        } catch (e) {
            return null;
        }
    }

    function set(key) {
        const value = typeof key === 'string' ? key.trim() : '';
        if (!KEY_FORMAT.test(value)) return { ok: false, error: 'bad-key' };
        if (!safeStorage || !safeStorage.isEncryptionAvailable()) return { ok: false, error: 'encryption-unavailable' };
        const cipher = safeStorage.encryptString(value).toString('base64');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ cipher, last4: value.slice(-4) }), 'utf8');
        fs.renameSync(tmp, file);
        return { ok: true };
    }

    // For the main process only: never send this to the page.
    function get() {
        const data = read();
        if (!data || !safeStorage || !safeStorage.isEncryptionAvailable()) return null;
        try {
            return safeStorage.decryptString(Buffer.from(data.cipher, 'base64'));
        } catch (e) {
            return null;
        }
    }

    function status() {
        const data = read();
        return { hasKey: !!data, last4: data && data.last4 ? data.last4 : '' };
    }

    function clear() {
        try {
            fs.unlinkSync(file);
        } catch (e) {
            // Intentionally silent: no file means no key.
        }
        return { ok: true };
    }

    return { set, get, status, clear };
}

module.exports = { createKeyStore };
