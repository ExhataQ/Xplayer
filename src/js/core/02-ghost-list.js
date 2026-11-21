// ==============================================================================
// GHOST LIST SYSTEM (POSITION-BASED SLOTS)
// ==============================================================================
export const ghostLists = {
    'all-songs': [],
    recent: [],
    search: [],
    'search-items': [],
    playlists: [],
    artists: [],
    albums: [],
    favorites: [],
    history: []
};

export let currentSearchSessionId = null;
export let nextSearchItemSlotId = 1;
export let nextFavoriteSlotId = 1;

export let activeSlotHighlights = {
    'all-songs': null,
    recent: null,
    search: null,
    playlists: null,
    artists: null,
    albums: null,
    favorites: null,
    history: null
};

export let historyGhostSlots = [];
export let nextHistorySlotId = 1;

export function initHistoryGhostSlots() {
    const history = getPlayHistory();
    historyGhostSlots = [];
    for (let i = 0; i < history.length; i++) {
        historyGhostSlots.push({
            slotId: `History${String(nextHistorySlotId).padStart(5, '0')}`,
            songId: history[i].id
        });
        nextHistorySlotId++;
    }
}

export function addHistoryGhostSlot(songId) {
    const slotEntry = {
        slotId: `History${String(nextHistorySlotId).padStart(5, '0')}`,
        songId: songId
    };
    historyGhostSlots.push(slotEntry);
    nextHistorySlotId++;
    return slotEntry.slotId;
}

export function removeHistoryGhostSlot(slotIndex) {
    if (slotIndex < historyGhostSlots.length) {
        historyGhostSlots[slotIndex] = null;
    }
}

export function getHistoryGhostSlotId(slotIndex) {
    if (slotIndex < historyGhostSlots.length && historyGhostSlots[slotIndex]) {
        return historyGhostSlots[slotIndex].slotId;
    }
    return null;
}

export function rebuildGhostListFromMain(listId, songs) {
    const ghostList = ghostLists[listId];
    if (!ghostList) return;

    for (let i = 0; i < ghostList.length; i++) {
        if (i < songs.length) {
            if (listId === VIEWS.ALL_SONGS) {
                ghostList[i] = `AllSongs${String(i + 1).padStart(5, '0')}`;
            } else {
                ghostList[i] = songs[i].id;
            }
        } else {
            ghostList[i] = null;
        }
    }

    for (let i = ghostList.length; i < songs.length; i++) {
        if (listId === VIEWS.ALL_SONGS) {
            ghostList.push(`AllSongs${String(i + 1).padStart(5, '0')}`);
        } else {
            ghostList.push(songs[i].id);
        }
    }
}

export function getGhostSlotId(listId, songId, occurrenceIndex = 0) {
    const ghostList = ghostLists[listId];
    if (!ghostList) return null;

    if (listId === VIEWS.ALL_SONGS) {
        if (typeof songId === 'number') {
            return songId;
        }
        return null;
    }

    let foundCount = 0;

    for (let i = 0; i < ghostList.length; i++) {
        if (ghostList[i] === songId) {
            if (foundCount === occurrenceIndex) {
                return i;
            }
            foundCount++;
        }
    }
    return null;
}

export function clearGhostList(listId) {
    if (ghostLists[listId]) {
        ghostLists[listId] = [];
    }
    activeSlotHighlights[listId] = null;
}

export function initGhostSlots(listId, songs, prefix) {
    ghostLists[listId] = [];
    for (let i = 0; i < songs.length; i++) {
        ghostLists[listId].push(`${prefix}-${String(i + 1).padStart(5, '0')}`);
    }
}

// Names other files call or read by name (inline handlers, other modules).
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        initHistoryGhostSlots,
        addHistoryGhostSlot,
        removeHistoryGhostSlot,
        getHistoryGhostSlotId,
        rebuildGhostListFromMain,
        getGhostSlotId,
        clearGhostList,
        initGhostSlots,
        ghostLists
    });
}

// Variables other files read and assign by name: the accessors read and write this file's own variables.
if (typeof registerLegacyState === 'function') {
    registerLegacyState({
        currentSearchSessionId: [() => currentSearchSessionId, (value) => { currentSearchSessionId = value; }],
        nextSearchItemSlotId: [() => nextSearchItemSlotId, (value) => { nextSearchItemSlotId = value; }],
        nextFavoriteSlotId: [() => nextFavoriteSlotId, (value) => { nextFavoriteSlotId = value; }],
        activeSlotHighlights: [() => activeSlotHighlights, (value) => { activeSlotHighlights = value; }],
        historyGhostSlots: [() => historyGhostSlots, (value) => { historyGhostSlots = value; }],
        nextHistorySlotId: [() => nextHistorySlotId, (value) => { nextHistorySlotId = value; }]
    });
}
