// ==============================================================================
// UTILITIES
// ==============================================================================

// Pure helpers with no dependencies: HTML escaping and id generation.

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function escapeHtmlAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function generateLongId(prefix) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return prefix + result;
}

function generateConsistentId(prefix, name) {
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
