// ==============================================================================
// PLAYER STATE VARIABLES
// ==============================================================================

// Single source of truth for every
// storage key the app uses (reading and writing: core/storage.js). Values are unchanged from
// what each key already was, so existing saved data keeps working as-is.
const STORAGE_KEYS = {
    FAVORITES: 'favorites',
    PLAY_HISTORY: 'playHistory',
    RECENTLY_PLAYED: 'recentlyPlayed',
    SEARCH_HISTORY: 'searchHistory',
    RIGHT_PANEL_COLLAPSED: 'rightPanelCollapsed',
    LEFT_PANEL_COLLAPSED: 'leftPanelCollapsed',
    VIRTUAL_SCROLL_THRESHOLD: 'virtualScrollThreshold',
    MINIMIZE_ON_CLOSE: 'minimizeOnClose',
    HIDE_RIGHT_PANEL_LYRICS: 'hideRightPanelLyrics',
    FOLDER_PINNED_ITEMS: 'folderPinnedItems',
    EXTENDED_METADATA_ENABLED: 'extendedMetadataEnabled',
    CUSTOM_SYNCED_LYRICS: 'customSyncedLyrics',
    CUSTOM_LYRICS: 'customLyrics',
    SMART_SHUFFLE_SETTINGS: 'smartShuffleSettings',
    PLAYLISTS: 'playlists',
    PLAYED_ITEM_ORDER: 'playedItemOrder',
    PINNED_ITEMS: 'pinnedItems',
    PANEL_WIDTHS: 'panelWidths',
    FOLDERS: 'folders',
    EXPANDED_FOLDERS: 'expandedFolders',
    AUDIO_PLAYBACK_SETTINGS: 'audioPlaybackSettings'
};

function getSongById(id) {
    return typeof SONGS_DATA !== 'undefined' ? SONGS_DATA.find((s) => s.id === id) : null;
}

// Shared debounce helper. Replaces the many hand-rolled
// "clearTimeout(x); x = setTimeout(fn, ms)" pairs scattered across src/js/.
// debounced(...args) resets the pending call on every invocation (last-call-wins
// args), firing fn after `delay` ms of silence. debounced.cancel() cancels any
// pending call without firing it, for call sites that need to cancel from
// outside the function that scheduled it (e.g. a mouseleave handler canceling
// a hover-triggered show). debounced.pending() reports whether a call is queued.
// Only ever applied where a site was confirmed to be a genuine debounce
// (same fixed action, reset-on-repeat semantics) — NOT applied to throttle
// patterns (immediate-run + trailing-pending flag) or to timers whose slot is
// reused for two different callbacks, since those aren't the same behavior.
function debounce(fn, delay) {
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

// Shared cached DOM lookup. Plain getElementById(id) was called
// repeatedly for the same id within a single file/module in several places (e.g.
// 'subhero-search-input' 5x in 08h-panel-search.js, 'notification-badge' 5x in
// 06j-notification-system.js). Caches by id, but verifies the cached element is still
// el.isConnected (still attached to the document) before reusing it -- if the element
// was removed/replaced since the last lookup, it transparently re-queries instead of
// returning a stale reference. This sidesteps needing to individually prove every call
// site's element is never removed/recreated; only applied where a file was confirmed to
// repeat the same id lookup, not applied blindly everywhere getElementById appears.
const _cachedElById = {};
function getCachedEl(id) {
    const cached = _cachedElById[id];
    if (cached && cached.isConnected) return cached;
    const el = document.getElementById(id);
    if (el) _cachedElById[id] = el;
    return el;
}

let playbackQueue = [];
let currentQueueIndex = -1;
let isShuffled = false;
let shuffleMode = 'normal';
let repeatMode = 0;
let currentView = 'all-songs';
let lastPlaybackListId = 'all-songs';
let searchQuery = '';
let lastPlayedSong = null;
let lastPlayedSongStartTime = 0;
let updateExternalScrollbarFn = function () {};
let playbackHistoryStack = [];
let historyNavigationIndex = -1;
let isManualPlay = false;
let isPrevNavigation = false;
let leftPanelFilterMode = 'all';
let currentOpenFolderId = null;
let currentOpenFolderName = '';
let folderNavigationStack = [];

let previousRightPanelState = {
    wasActive: false,
    wasCollapsed: false,
    wasTab: 'tags'
};

let lyricsPreScrollTop = 0;
let lyricsPreView = null;

let leftPanelCollapsed = storageRead(STORAGE_KEYS.LEFT_PANEL_COLLAPSED) === 'true';

let rightPanelCollapsed = storageRead(STORAGE_KEYS.RIGHT_PANEL_COLLAPSED) === 'true';
if (storageRead(STORAGE_KEYS.RIGHT_PANEL_COLLAPSED) === null) {
    rightPanelCollapsed = false;
    storageWriteBool(STORAGE_KEYS.RIGHT_PANEL_COLLAPSED, false);
}

// ==============================================================================
// EXTENDED METADATA FIELDS
// ==============================================================================
const EXTENDED_METADATA_FIELDS = [
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
// PLAYER ICON CONSTANTS
// ==============================================================================
const PLAY_ICON_HTML = '<img src="icons/play.svg" alt="" class="player-svg-icon">';
const PAUSE_ICON_HTML = '<img src="icons/pause.svg" alt="" class="player-svg-icon">';
// ==============================================================================
// DOM ELEMENT REFERENCES
// ==============================================================================
let audioElement = document.getElementById('audio');

function getActiveAudioElement() {
    return gaplessActiveElement;
}

function getInactiveAudioElement() {
    return gaplessActiveElement === audioElement
        ? gaplessAudioElement
        : audioElement;
}
const playButton = document.getElementById('play-btn');
const shuffleButton = document.getElementById('shuffle-btn');
const repeatButton = document.getElementById('repeat-btn');
const repeatOneIndicator = document.getElementById('repeat-one');
const currentTimeDisplay = document.getElementById('current-time');
const totalTimeDisplay = document.getElementById('total-time');
const searchInput = document.getElementById('search-input');
const songListElement = document.getElementById('song-list');
const rightPanelElement = document.getElementById('right-panel');
const leftPanelElement = document.getElementById('left-panel');
const tagsContentElement = document.getElementById('tags-content');
const MIN_PLAY_TIME_TO_SAVE = 5;
