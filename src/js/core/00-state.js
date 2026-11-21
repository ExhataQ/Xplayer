// ==============================================================================
// PLAYER STATE VARIABLES
// ==============================================================================

// Every storage key the app uses (read and written through core/storage.js). The values are the names
// the data is saved under, so changing one loses what people have saved.
export const STORAGE_KEYS = {
    FAVORITES: 'favorites',
    PLAY_HISTORY: 'playHistory',
    RECENTLY_PLAYED: 'recentlyPlayed',
    SEARCH_HISTORY: 'searchHistory',
    RIGHT_PANEL_COLLAPSED: 'rightPanelCollapsed',
    LEFT_PANEL_COLLAPSED: 'leftPanelCollapsed',
    VIRTUAL_SCROLL_THRESHOLD: 'virtualScrollThreshold',
    MINIMIZE_ON_CLOSE: 'minimizeOnClose',
    FOLDER_PINNED_ITEMS: 'folderPinnedItems',
    EXTENDED_METADATA_ENABLED: 'extendedMetadataEnabled',
    CUSTOM_SYNCED_LYRICS: 'customSyncedLyrics',
    CUSTOM_LYRICS: 'customLyrics',
    SMART_SHUFFLE_SETTINGS: 'smartShuffleSettings',
    RATINGS: 'ratings',
    RATING_SETTINGS: 'ratingSettings',
    DUPLICATE_DECISIONS: 'duplicateDecisions',
    PLAYLISTS: 'playlists',
    PLAYED_ITEM_ORDER: 'playedItemOrder',
    PINNED_ITEMS: 'pinnedItems',
    PANEL_WIDTHS: 'panelWidths',
    FOLDERS: 'folders',
    EXPANDED_FOLDERS: 'expandedFolders',
    AUDIO_PLAYBACK_SETTINGS: 'audioPlaybackSettings',
    EQUALIZER_SETTINGS: 'equalizerSettings',
    STARTUP_BACKGROUND: 'startupBackground',
    VOLUME: 'volume',
    LAST_SONG: 'lastSong'
};

// Callers look songs up by id constantly (every artist, album and playlist build). The index is rebuilt when the
// array is replaced or its length changes, and any entry that no longer matches is re-checked the slow way.
let songIndex = { source: null, length: -1, byId: null };
export function getSongById(id) {
    if (typeof SONGS_DATA === 'undefined') return null;
    if (songIndex.source !== SONGS_DATA || songIndex.length !== SONGS_DATA.length || !songIndex.byId) {
        const byId = new Map();
        for (const s of SONGS_DATA) if (s && !byId.has(s.id)) byId.set(s.id, s);
        songIndex = { source: SONGS_DATA, length: SONGS_DATA.length, byId };
    }
    const hit = songIndex.byId.get(id);
    if (hit && hit.id === id) return hit;
    const found = SONGS_DATA.find((s) => s.id === id);
    if (found) songIndex.byId.set(id, found);
    return found;
}

// Shared debounce: debounced(...args) restarts the wait on every call (the last arguments win) and runs fn after `delay` ms
// of silence. debounced.cancel() drops a pending call without running it; debounced.pending() says whether one is waiting.
// The delay is fixed when it is created, and it is not a throttle.
export function debounce(fn, delay) {
    let timerId = null;
    function debounced(...args) {
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(() => {
            timerId = null;
            fn(...args);
        }, delay);
    }
    debounced.cancel = function () {
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }
    };
    debounced.pending = function () {
        return timerId !== null;
    };
    return debounced;
}

// getElementById with a cache by id. The cached element is reused only while it is still in the document (isConnected);
// if it was removed or replaced, the id is looked up again, so a stale element is never returned.
export const _cachedElById = {};
export function getCachedEl(id) {
    const cached = _cachedElById[id];
    if (cached && cached.isConnected) return cached;
    const el = document.getElementById(id);
    if (el) _cachedElById[id] = el;
    return el;
}

export let playbackQueue = [];
export let currentQueueIndex = -1;
export let isShuffled = false;
export let shuffleMode = 'normal';
export let repeatMode = 0;
export let currentView = 'all-songs';
export let lastPlaybackListId = 'all-songs';
export let searchQuery = '';
export let lastPlayedSong = null;
export let lastPlayedSongStartTime = 0;
export let playbackHistoryStack = [];
export let historyNavigationIndex = -1;
export let isManualPlay = false;
export let isPrevNavigation = false;
export let leftPanelFilterMode = 'all';
export let currentOpenFolderId = null;
export let currentOpenFolderName = '';
export let folderNavigationStack = [];

export let lyricsPreScrollTop = 0;
export let lyricsPreView = null;

export let leftPanelCollapsed = storageRead(STORAGE_KEYS.LEFT_PANEL_COLLAPSED) === 'true';

export let rightPanelCollapsed = storageRead(STORAGE_KEYS.RIGHT_PANEL_COLLAPSED) === 'true';
if (storageRead(STORAGE_KEYS.RIGHT_PANEL_COLLAPSED) === null) {
    rightPanelCollapsed = false;
    storageWriteBool(STORAGE_KEYS.RIGHT_PANEL_COLLAPSED, false);
}

// ==============================================================================
// EXTENDED METADATA FIELDS
// ==============================================================================
export const EXTENDED_METADATA_FIELDS = [
    {
        key: 'albumArtist',
        label: 'Album Artist',
        group: 'People',
        defaultOn: true
    },
    {
        key: 'conductor',
        label: 'Conductor',
        group: 'People',
        defaultOn: true
    },
    {
        key: 'remixer',
        label: 'Remixer',
        group: 'People',
        defaultOn: true
    },
    {
        key: 'discNumber',
        label: 'Disc Number',
        group: 'Structure',
        defaultOn: true
    },
    {
        key: 'discTotal',
        label: 'Disc Total',
        group: 'Structure',
        defaultOn: true
    },
    {
        key: 'trackTotal',
        label: 'Track Total',
        group: 'Structure',
        defaultOn: true
    },
    {
        key: 'label',
        label: 'Label',
        group: 'Publishing',
        defaultOn: true
    },
    {
        key: 'copyright',
        label: 'Copyright',
        group: 'Publishing',
        defaultOn: false
    },
    {
        key: 'isrc',
        label: 'ISRC',
        group: 'Identifiers',
        defaultOn: false
    },
    {
        key: 'musicBrainzTrackId',
        label: 'MusicBrainz Track ID',
        group: 'Identifiers',
        defaultOn: false
    },
    {
        key: 'musicBrainzAlbumId',
        label: 'MusicBrainz Album ID',
        group: 'Identifiers',
        defaultOn: false
    },
    {
        key: 'musicBrainzArtistId',
        label: 'MusicBrainz Artist ID',
        group: 'Identifiers',
        defaultOn: false
    },
    {
        key: 'musicBrainzReleaseGroupId',
        label: 'MusicBrainz Release Group ID',
        group: 'Identifiers',
        defaultOn: false
    },
    {
        key: 'bitrate',
        label: 'Bitrate',
        group: 'Technical',
        defaultOn: false
    },
    {
        key: 'sampleRate',
        label: 'Sample Rate',
        group: 'Technical',
        defaultOn: false
    },
    {
        key: 'channels',
        label: 'Channels',
        group: 'Technical',
        defaultOn: false
    },
    {
        key: 'bpm',
        label: 'BPM',
        group: 'Technical',
        defaultOn: true
    },
    {
        key: 'encoder',
        label: 'Encoder',
        group: 'Technical',
        defaultOn: false
    },
    {
        key: 'replayGainTrack',
        label: 'ReplayGain (Track)',
        group: 'Technical',
        defaultOn: false
    },
    {
        key: 'replayGainAlbum',
        label: 'ReplayGain (Album)',
        group: 'Technical',
        defaultOn: false
    },
    {
        key: 'comment',
        label: 'Comment',
        group: 'Misc',
        defaultOn: true
    },
    {
        key: 'lyrics',
        label: 'Lyrics',
        group: 'Misc',
        defaultOn: false,
        hidden: true
    },
    {
        key: 'language',
        label: 'Language',
        group: 'Misc',
        defaultOn: false
    },
    {
        key: 'rating',
        label: 'Rating',
        group: 'Misc',
        defaultOn: false
    },
    {
        key: 'playCount',
        label: 'Play Count',
        group: 'Misc',
        defaultOn: false
    },
    {
        key: 'titleSort',
        label: 'Title Sort',
        group: 'Sort',
        defaultOn: false
    },
    {
        key: 'artistSort',
        label: 'Artist Sort',
        group: 'Sort',
        defaultOn: false
    },
    {
        key: 'albumSort',
        label: 'Album Sort',
        group: 'Sort',
        defaultOn: false
    }
];

// ==============================================================================
// DOM ELEMENT REFERENCES
// ==============================================================================
export let audioElement = document.getElementById('audio');

export const playButton = document.getElementById('play-btn');
export const shuffleButton = document.getElementById('shuffle-btn');
export const repeatButton = document.getElementById('repeat-btn');
export const repeatOneIndicator = document.getElementById('repeat-one');
export const currentTimeDisplay = document.getElementById('current-time');
export const totalTimeDisplay = document.getElementById('total-time');
export const searchInput = document.getElementById('search-input');
export const songListElement = document.getElementById('song-list');
export const rightPanelElement = document.getElementById('right-panel');
export const leftPanelElement = document.getElementById('left-panel');
export const tagsContentElement = document.getElementById('tags-content');
export const MIN_PLAY_TIME_TO_SAVE = 5;

// Names other files call or read by name (inline handlers, other modules).
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getSongById,
        debounce,
        getCachedEl,
        STORAGE_KEYS,
        EXTENDED_METADATA_FIELDS,
        playButton,
        shuffleButton,
        repeatButton,
        repeatOneIndicator,
        currentTimeDisplay,
        totalTimeDisplay,
        searchInput,
        songListElement,
        rightPanelElement,
        leftPanelElement,
        tagsContentElement,
        MIN_PLAY_TIME_TO_SAVE
    });
}

// Variables other files read and assign by name: the accessors read and write this file's own variables.
if (typeof registerLegacyState === 'function') {
    registerLegacyState({
        playbackQueue: [() => playbackQueue, (value) => { playbackQueue = value; }],
        currentQueueIndex: [() => currentQueueIndex, (value) => { currentQueueIndex = value; }],
        isShuffled: [() => isShuffled, (value) => { isShuffled = value; }],
        shuffleMode: [() => shuffleMode, (value) => { shuffleMode = value; }],
        repeatMode: [() => repeatMode, (value) => { repeatMode = value; }],
        currentView: [() => currentView, (value) => { currentView = value; }],
        lastPlaybackListId: [() => lastPlaybackListId, (value) => { lastPlaybackListId = value; }],
        searchQuery: [() => searchQuery, (value) => { searchQuery = value; }],
        lastPlayedSong: [() => lastPlayedSong, (value) => { lastPlayedSong = value; }],
        lastPlayedSongStartTime: [() => lastPlayedSongStartTime, (value) => { lastPlayedSongStartTime = value; }],
        playbackHistoryStack: [() => playbackHistoryStack, (value) => { playbackHistoryStack = value; }],
        historyNavigationIndex: [() => historyNavigationIndex, (value) => { historyNavigationIndex = value; }],
        isManualPlay: [() => isManualPlay, (value) => { isManualPlay = value; }],
        isPrevNavigation: [() => isPrevNavigation, (value) => { isPrevNavigation = value; }],
        leftPanelFilterMode: [() => leftPanelFilterMode, (value) => { leftPanelFilterMode = value; }],
        currentOpenFolderId: [() => currentOpenFolderId, (value) => { currentOpenFolderId = value; }],
        currentOpenFolderName: [() => currentOpenFolderName, (value) => { currentOpenFolderName = value; }],
        folderNavigationStack: [() => folderNavigationStack, (value) => { folderNavigationStack = value; }],
        lyricsPreScrollTop: [() => lyricsPreScrollTop, (value) => { lyricsPreScrollTop = value; }],
        lyricsPreView: [() => lyricsPreView, (value) => { lyricsPreView = value; }],
        leftPanelCollapsed: [() => leftPanelCollapsed, (value) => { leftPanelCollapsed = value; }],
        rightPanelCollapsed: [() => rightPanelCollapsed, (value) => { rightPanelCollapsed = value; }],
        audioElement: [() => audioElement, (value) => { audioElement = value; }]
    });
}
