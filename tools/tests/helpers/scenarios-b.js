'use strict';

// Event-bus call-sequence scenarios owned by Agent B: playback and selection (10*, 13-17).
// Format and workflow: see helpers/sequence-suite.js.
// Spy only on UI functions that live in D's files; keep scenarios small (one reaction each).
//
// The headless page has no real audio. Scenarios that reach audioElement.play() stub it in
// "setup" (window.audioElement is a plain element, so the stub is an own property).

const STUB_PLAY = 'audioElement.play = () => Promise.resolve();';
const ONE_SONG_QUEUE = "setPlaybackQueue([{ song: SONGS_DATA[0], listId: VIEWS.ALL_SONGS, ghostSlot: 0 }]); setCurrentQueueIndex(0);";
const TWO_SONG_QUEUE = "setPlaybackQueue([{ song: SONGS_DATA[0], listId: VIEWS.ALL_SONGS, ghostSlot: 0 }, { song: SONGS_DATA[1], listId: VIEWS.ALL_SONGS, ghostSlot: 1 }]); setCurrentQueueIndex(0);";
const OPEN_PORTABLE = "document.getElementById('recently-played-content').classList.add('active');";

const ENDED_SPY = ['updateSubheroPlayButton', 'renderRecentlyPlayed', 'renderPortableRecentlyPlayed'];
const MODE_SPY = ['updateSubheroShuffleButton', 'renderSongsList', 'renderRecentlyPlayed'];
const REPEAT_ONE = 'setRepeatMode(2); setRepeatFunctionalityActive(true);';

const SYNC_SPY = ['updateLeftPanelCounts', 'renderLeftPanelVisibleItems', 'updateAllCounts', 'renderFavoritesView', 'updateHeroSongCount', 'renderPlaylistsView', 'renderFoldersView', 'renderAlbumLeftPanelItems', 'renderArtistLeftPanelItems', 'refreshCurrentView', 'reapplySelectionState', 'renderHistoryView', 'renderPlaylistDetailView', 'renderAlbumDetailView', 'renderArtistDetailView', 'updateScrollbarById', 'updateSelectionHighlight', 'updateActiveHighlight'];
const PLAYLIST_VIEW = "const p = createPlaylist('P'); addSongToPlaylist(1, p.id); currentView = 'playlist-' + p.id;";
const ALBUM_VIEW = 'currentView = getAlbums()[0].id;';
const ARTIST_VIEW = 'currentView = getArtists()[0].id;';
const AFTER_TIMERS = ' await new Promise((r) => setTimeout(r, 120));';

const SCENARIOS = {
    // ---- EB-B1: 15e audio events -------------------------------------------------------------
    'audio: play/pause state sync': {
        spy: ['updateSubheroPlayButton'],
        setup: '',
        run: 'syncPlayPauseButtons();'
    },
    'audio ended, repeat one: Recent view and portable panel open': {
        spy: ENDED_SPY,
        setup: `${STUB_PLAY} ${ONE_SONG_QUEUE} ${REPEAT_ONE} currentView = VIEWS.RECENT; ${OPEN_PORTABLE}`,
        run: 'audioElement.onended();'
    },
    'audio ended, repeat one: All Songs view, portable panel closed': {
        spy: ENDED_SPY,
        setup: `${STUB_PLAY} ${ONE_SONG_QUEUE} ${REPEAT_ONE} currentView = VIEWS.ALL_SONGS;`,
        run: 'audioElement.onended();'
    },
    'audio ended: last song of the queue, portable panel open': {
        spy: ENDED_SPY,
        setup: `${STUB_PLAY} ${ONE_SONG_QUEUE} currentView = VIEWS.ALL_SONGS; ${OPEN_PORTABLE}`,
        run: 'audioElement.onended();'
    },
    'audio ended: shuffled queue exhausted, portable panel open': {
        spy: ENDED_SPY,
        setup: `${STUB_PLAY} ${ONE_SONG_QUEUE} setIsShuffled(true); window.getNextShuffledSong = () => null; currentView = VIEWS.ALL_SONGS; ${OPEN_PORTABLE}`,
        run: 'audioElement.onended();'
    },

    // ---- EB-B2: shuffle button (15b), repeat button (15c), next button (15d), smart shuffle (10b) ---
    'shuffle: toggle on then off, repeat off, All Songs view': {
        spy: MODE_SPY,
        setup: 'currentView = VIEWS.ALL_SONGS;',
        run: 'toggleNormalShuffle(); toggleNormalShuffle();'
    },
    'shuffle: toggle on then off, repeat one, All Songs view': {
        spy: MODE_SPY,
        setup: `${REPEAT_ONE} currentView = VIEWS.ALL_SONGS;`,
        run: 'toggleNormalShuffle(); toggleNormalShuffle();'
    },
    'shuffle: toggle on then off, repeat one, Recent view': {
        spy: MODE_SPY,
        setup: `${REPEAT_ONE} currentView = VIEWS.RECENT;`,
        run: 'toggleNormalShuffle(); toggleNormalShuffle();'
    },
    'shuffle: toggle on then off, repeat one, Search view with a query': {
        spy: MODE_SPY,
        setup: `${REPEAT_ONE} currentView = VIEWS.SEARCH; setSearchQuery('Song');`,
        run: 'toggleNormalShuffle(); toggleNormalShuffle();'
    },
    'shuffle: smart shuffle starts (stubbed to a 60-song list)': {
        spy: ['updateSubheroShuffleButton'],
        setup: 'window.getSongsForList = () => new Array(60).fill(SONGS_DATA[0]); window.playCurrentViewFromStart = () => {};',
        run: 'startSmartShuffleFromCurrentView();'
    },
    'repeat button: click while not shuffled': {
        spy: MODE_SPY,
        setup: 'currentView = VIEWS.ALL_SONGS;',
        run: 'repeatButton.onclick();'
    },
    'repeat button: click while shuffled, All Songs view': {
        spy: MODE_SPY,
        setup: 'setIsShuffled(true); currentView = VIEWS.ALL_SONGS;',
        run: 'repeatButton.onclick();'
    },
    'repeat button: click while shuffled, Recent view': {
        spy: MODE_SPY,
        setup: 'setIsShuffled(true); currentView = VIEWS.RECENT;',
        run: 'repeatButton.onclick();'
    },
    'repeat button: click while shuffled, Search view with a query': {
        spy: MODE_SPY,
        setup: "setIsShuffled(true); currentView = VIEWS.SEARCH; setSearchQuery('Song');",
        run: 'repeatButton.onclick();'
    },
    'next button, repeat one: Recent view': {
        spy: ['renderRecentlyPlayed', 'renderPortableRecentlyPlayed'],
        setup: `${STUB_PLAY} ${ONE_SONG_QUEUE} ${REPEAT_ONE} currentView = VIEWS.RECENT; lastPlayedSong = SONGS_DATA[0]; lastPlayedSongStartTime = Date.now() - 600000; ${OPEN_PORTABLE}`,
        run: "document.getElementById('next-btn').onclick();"
    },
    'next button, repeat one: All Songs view': {
        spy: ['renderRecentlyPlayed', 'renderPortableRecentlyPlayed'],
        setup: `${STUB_PLAY} ${ONE_SONG_QUEUE} ${REPEAT_ONE} currentView = VIEWS.ALL_SONGS; lastPlayedSong = SONGS_DATA[0]; lastPlayedSongStartTime = Date.now() - 600000; ${OPEN_PORTABLE}`,
        run: "document.getElementById('next-btn').onclick();"
    },

    // ---- EB-B3: 10c queue, 10d song start, 16 context actions ---------------------------------
    'queue: remove an upcoming song, Recent view': {
        spy: ['renderSongsList', 'renderRecentlyPlayed'],
        setup: `${TWO_SONG_QUEUE} currentView = VIEWS.RECENT;`,
        run: 'removeFromQueue(1);'
    },
    'queue: remove an upcoming song, All Songs view': {
        spy: ['renderSongsList', 'renderRecentlyPlayed'],
        setup: `${TWO_SONG_QUEUE} currentView = VIEWS.ALL_SONGS;`,
        run: 'removeFromQueue(1);'
    },
    'queue: remove an upcoming song, Search view': {
        spy: ['renderSongsList', 'renderRecentlyPlayed'],
        setup: `${TWO_SONG_QUEUE} currentView = VIEWS.SEARCH;`,
        run: 'removeFromQueue(1);'
    },
    'queue: remove an upcoming song, Favorites view': {
        spy: ['renderSongsList', 'renderRecentlyPlayed'],
        setup: `${TWO_SONG_QUEUE} currentView = VIEWS.FAVORITES;`,
        run: 'removeFromQueue(1);'
    },
    'queue: remove the playing song, All Songs view': {
        spy: ['renderSongsList', 'renderRecentlyPlayed', 'updateSubheroPlayButton'],
        setup: `${STUB_PLAY} ${TWO_SONG_QUEUE} currentView = VIEWS.ALL_SONGS;`,
        run: 'removeFromQueue(0);'
    },
    'queue: ignore an out-of-range index': {
        spy: ['renderSongsList', 'renderRecentlyPlayed'],
        setup: `${TWO_SONG_QUEUE} currentView = VIEWS.ALL_SONGS;`,
        run: 'removeFromQueue(9);'
    },
    'song start: playSongFromQueue': {
        spy: ['updateSubheroPlayButton'],
        setup: `${STUB_PLAY} ${TWO_SONG_QUEUE}`,
        run: 'playSongFromQueue(1);'
    },
    'song start: smart shuffle refused on a short list': {
        spy: ['updateSubheroShuffleButton', 'showNotification'],
        setup: "setIsShuffled(true); setShuffleMode('smart'); currentView = VIEWS.ALL_SONGS;",
        run: 'playCurrentViewFromStart();'
    },
    'history: delete an entry from the context menu, History view, portable panel open': {
        spy: ['refreshCurrentViewAfterMutation', 'renderPortableRecentlyPlayed', 'showNotification'],
        setup: `saveToPlayHistory(SONGS_DATA[0], 4000); currentContextSongId = SONGS_DATA[0].id; activeContextMenuSlot = 0; currentView = VIEWS.HISTORY; ${OPEN_PORTABLE}`,
        run: 'deleteHistoryEntry();'
    },
    'history: delete an entry from the context menu, portable panel closed': {
        spy: ['refreshCurrentViewAfterMutation', 'renderPortableRecentlyPlayed', 'showNotification'],
        setup: 'saveToPlayHistory(SONGS_DATA[0], 4000); currentContextSongId = SONGS_DATA[0].id; activeContextMenuSlot = 0; currentView = VIEWS.ALL_SONGS;',
        run: 'deleteHistoryEntry();'
    },

    // ---- EB-B4: 17 selection, favorites and counts ---------------------------------------------
    'favorites: sync after a change, Favorites view': {
        spy: SYNC_SPY,
        setup: 'saveFavorite(1); currentView = VIEWS.FAVORITES;',
        run: 'syncAllUIState();'
    },
    'favorites: sync after a change, All Songs view': {
        spy: SYNC_SPY,
        setup: 'currentView = VIEWS.ALL_SONGS;',
        run: 'syncAllUIState();'
    },
    'favorites: sync after a change, playlist view': {
        spy: SYNC_SPY,
        setup: PLAYLIST_VIEW,
        run: 'syncAllUIState();'
    },
    'favorites: sync after a change, album view': {
        spy: SYNC_SPY,
        setup: ALBUM_VIEW,
        run: 'syncAllUIState();'
    },
    'favorites: sync after a change, artist view': {
        spy: SYNC_SPY,
        setup: ARTIST_VIEW,
        run: 'syncAllUIState();'
    },
    'favorites: sync after a change, History view (no branch)': {
        spy: SYNC_SPY,
        setup: 'currentView = VIEWS.HISTORY;',
        run: 'syncAllUIState();'
    },
    'favorites: toggle on then off from the song row, Favorites view': {
        spy: [...SYNC_SPY, 'refreshCurrentViewAfterMutation', 'showNotification'],
        setup: 'currentView = VIEWS.FAVORITES;',
        run: `toggleFavorite(1); toggleFavorite(1);${AFTER_TIMERS}`
    },
    'songs: library songs changed, All Songs view': {
        spy: SYNC_SPY,
        setup: 'currentView = VIEWS.ALL_SONGS;',
        run: 'onSongsChanged();'
    },
    'songs: library songs changed, playlist view': {
        spy: SYNC_SPY,
        setup: PLAYLIST_VIEW,
        run: 'onSongsChanged();'
    },
    'mutation refresh: Favorites view': {
        spy: SYNC_SPY,
        setup: 'saveFavorite(1); currentView = VIEWS.FAVORITES;',
        run: `refreshCurrentViewAfterMutation();${AFTER_TIMERS}`
    },
    'mutation refresh: All Songs view': {
        spy: SYNC_SPY,
        setup: 'currentView = VIEWS.ALL_SONGS;',
        run: `refreshCurrentViewAfterMutation();${AFTER_TIMERS}`
    },
    'mutation refresh: History view': {
        spy: SYNC_SPY,
        setup: 'saveToPlayHistory(SONGS_DATA[0], 4000); currentView = VIEWS.HISTORY;',
        run: `refreshCurrentViewAfterMutation();${AFTER_TIMERS}`
    },
    'mutation refresh: playlist view': {
        spy: SYNC_SPY,
        setup: PLAYLIST_VIEW,
        run: `refreshCurrentViewAfterMutation();${AFTER_TIMERS}`
    },
    'mutation refresh: album view': {
        spy: SYNC_SPY,
        setup: ALBUM_VIEW,
        run: `refreshCurrentViewAfterMutation();${AFTER_TIMERS}`
    },
    'mutation refresh: artist view': {
        spy: SYNC_SPY,
        setup: ARTIST_VIEW,
        run: `refreshCurrentViewAfterMutation();${AFTER_TIMERS}`
    },
    'mutation refresh: view without a branch (Search)': {
        spy: SYNC_SPY,
        setup: 'currentView = VIEWS.SEARCH;',
        run: `refreshCurrentViewAfterMutation();${AFTER_TIMERS}`
    },
    'left panel counts: virtual list enabled': {
        spy: SYNC_SPY,
        setup: 'leftPanelVirtualState.enabled = true; currentOpenFolderId = null;',
        run: 'updateLeftPanelCounts();'
    },
    'left panel counts: virtual list disabled': {
        spy: SYNC_SPY,
        setup: 'leftPanelVirtualState.enabled = false;',
        run: 'updateLeftPanelCounts();'
    },
    'left panel counts: virtual list enabled but a folder is open': {
        spy: SYNC_SPY,
        setup: "leftPanelVirtualState.enabled = true; currentOpenFolderId = 'folder-x';",
        run: 'updateLeftPanelCounts();'
    },
    // ---- EB-B3 follow-up: 16 add to playlist from the context menu -----------------------------
    'playlist menu: add a song while that playlist is open': {
        spy: ['renderPlaylistDetailView', 'showNotification'],
        setup: "const p = createPlaylist('P'); window.__pid = p.id; currentView = 'playlist-' + p.id;",
        run: 'addToPlaylistFromMenu(1, window.__pid);'
    },
    'playlist menu: add a song that is already in the open playlist': {
        spy: ['renderPlaylistDetailView', 'showNotification'],
        setup: "const p = createPlaylist('P'); window.__pid = p.id; addSongToPlaylist(1, p.id); currentView = 'playlist-' + p.id;",
        run: 'addToPlaylistFromMenu(1, window.__pid);'
    },
    'playlist menu: add a song while another view is open': {
        spy: ['renderPlaylistDetailView', 'showNotification'],
        setup: "const p = createPlaylist('P'); window.__pid = p.id; currentView = VIEWS.ALL_SONGS;",
        run: 'addToPlaylistFromMenu(1, window.__pid);'
    }
};

module.exports = { SCENARIOS };
