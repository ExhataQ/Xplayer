// ==============================================================================
// UTILITIES
// ==============================================================================

// Pure helpers with no dependencies: HTML escaping and id generation.

// A value that is not a string (a number, an object) is turned into text first, so one odd lyric line cannot throw.
// The first such value is logged once, so its source can be found.
let warnedNonString = false;
export function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') {
        if (!warnedNonString) {
            warnedNonString = true;
            console.warn('escapeHtml: got a non-string value', typeof text, text);
        }
        text = String(text);
    }
    return text.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

export function escapeHtmlAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function generateLongId(prefix) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return prefix + result;
}

export function generateConsistentId(prefix, name) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let h = 0;
    for (let i = 0; i < name.length; i++) {
        h = ((h << 5) - h + name.charCodeAt(i)) | 0;
    }
    let val = Math.abs(h);
    let result = '';
    for (let i = 0; i < 12; i++) {
        val = (val * 1103515245 + 12345) >>> 0;
        result += chars[val % chars.length];
    }
    return prefix + result;
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        escapeHtml,
        escapeHtmlAttr,
        generateLongId,
        generateConsistentId
    });
}
