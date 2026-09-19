// ==============================================================================
// GHOST LIST SYSTEM (POSITION-BASED SLOTS)
// ==============================================================================
const ghostLists = {
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

let currentSearchSessionId = null;
let nextSearchItemSlotId = 1;
let nextFavoriteSlotId = 1;

let activeSlotHighlights = {
    'all-songs': null,
    recent: null,
    search: null,
    playlists: null,
    artists: null,
    albums: null,
    favorites: null,
    history: null
};

let historyGhostSlots = [];
let nextHistorySlotId = 1;

function initHistoryGhostSlots() {
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

function addHistoryGhostSlot(songId) {
    const slotEntry = {
        slotId: `History${String(nextHistorySlotId).padStart(5, '0')}`,
        songId: songId
    };
    historyGhostSlots.push(slotEntry);
    nextHistorySlotId++;
    return slotEntry.slotId;
}

function removeHistoryGhostSlot(slotIndex) {
    if (slotIndex < historyGhostSlots.length) {
        historyGhostSlots[slotIndex] = null;
    }
}

function getHistoryGhostSlotId(slotIndex) {
    if (slotIndex < historyGhostSlots.length && historyGhostSlots[slotIndex]) {
        return historyGhostSlots[slotIndex].slotId;
    }
    return null;
}

function rebuildGhostListFromMain(listId, songs) {
    const ghostList = ghostLists[listId];
    if (!ghostList) return;

    for (let i = 0; i < ghostList.length; i++) {
        if (i < songs.length) {
            if (listId === 'all-songs') {
                ghostList[i] = `AllSongs${String(i + 1).padStart(5, '0')}`;
            } else {
                ghostList[i] = songs[i].id;
            }
        } else {
            ghostList[i] = null;
        }
    }

    for (let i = ghostList.length; i < songs.length; i++) {
        if (listId === 'all-songs') {
            ghostList.push(`AllSongs${String(i + 1).padStart(5, '0')}`);
        } else {
            ghostList.push(songs[i].id);
        }
    }
}

function getGhostSlotId(listId, songId, occurrenceIndex = 0) {
    const ghostList = ghostLists[listId];
    if (!ghostList) return null;

    if (listId === 'all-songs') {
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

function clearGhostList(listId) {
    if (ghostLists[listId]) {
        ghostLists[listId] = [];
    }
    activeSlotHighlights[listId] = null;
}

function initGhostSlots(listId, songs, prefix) {
    ghostLists[listId] = [];
    for (let i = 0; i < songs.length; i++) {
        ghostLists[listId].push(`${prefix}-${String(i + 1).padStart(5, '0')}`);
    }
}
