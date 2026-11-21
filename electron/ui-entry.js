// The page the main window loads. There is one interface: src/ui-next/index.html (the path is relative to the web root, see app-paths.js).
// The old interface was removed; this is the only page the window loads.

const NEXT_ENTRY = 'ui-next/index.html';

function resolveUiEntry() {
    return NEXT_ENTRY;
}

function activeEntry() {
    return NEXT_ENTRY;
}

module.exports = { resolveUiEntry, activeEntry, NEXT_ENTRY };
