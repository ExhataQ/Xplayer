// ==============================================================================
// CONSTANTS
// ==============================================================================
const MAX_RECENT_SONGS = 50;

const MAX_HISTORY_ENTRIES = 500;

const MAX_SEARCH_HISTORY = 20;

function getStoredJson(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
        return fallback;
    }
}

