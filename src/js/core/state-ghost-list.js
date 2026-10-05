// ==============================================================================
// STATE GHOST LIST
// ==============================================================================
// Counters and slots for the ghost-list placeholders (declared in 02-ghost-list.js).
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

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

// Classic scripts and inline handlers still call these by name; registered until the final flip.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        setCurrentSearchSessionId,
        setNextSearchItemSlotId,
        setNextFavoriteSlotId,
        setNextHistorySlotId,
        setHistoryGhostSlots
    });
}
