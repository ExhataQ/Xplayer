// ==============================================================================
// STATE GHOST LIST
// ==============================================================================
// Counters and slots for the ghost-list placeholders (declared in 02-ghost-list.js).
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

function setCurrentSearchSessionId(value) {
    currentSearchSessionId = value;
}

function setNextSearchItemSlotId(value) {
    nextSearchItemSlotId = value;
}

function setNextFavoriteSlotId(value) {
    nextFavoriteSlotId = value;
}

function setNextHistorySlotId(value) {
    nextHistorySlotId = value;
}

function setHistoryGhostSlots(value) {
    historyGhostSlots = value;
}
