// ==============================================================================
// STATE GHOST LIST
// ==============================================================================
// Counters and slots for the ghost-list placeholders (declared in 02-ghost-list.js).
// Setters only: each one assigns a variable that is declared in another file. Listed in core/SETTERS.md.

export function setCurrentSearchSessionId(value) {
    currentSearchSessionId = value;
}

export function setNextSearchItemSlotId(value) {
    nextSearchItemSlotId = value;
}

export function setNextFavoriteSlotId(value) {
    nextFavoriteSlotId = value;
}

export function setNextHistorySlotId(value) {
    nextHistorySlotId = value;
}

export function setHistoryGhostSlots(value) {
    historyGhostSlots = value;
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        setCurrentSearchSessionId,
        setNextSearchItemSlotId,
        setNextFavoriteSlotId,
        setNextHistorySlotId,
        setHistoryGhostSlots
    });
}
