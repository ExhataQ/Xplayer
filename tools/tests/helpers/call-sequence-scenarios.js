'use strict';

// Scenarios for tools/tests/events-wiring.test.js's "same calls, same order" tests.
//
// Each scenario runs real app code in the page with some UI functions wrapped in spies,
// and records which of them were called, in order. The expected sequences in the test
// file were MEASURED ON THE CODE AS IT WAS BEFORE the event-bus conversion, then the
// converted code was required to match - so a subscriber that drops, adds or reorders a
// call fails here even when the final DOM looks fine (several UI functions call each
// other internally, which hides a missing call from DOM-only assertions).
//
//   spy    - global function names to wrap (names that don't exist are skipped)
//   setup  - code run BEFORE the spies are installed (page state, fixtures)
//   run    - code run with the spies installed (the thing being measured)
//
// All code strings run in the page's global scope (new Function), so they can read and
// assign the app's globals such as currentView.

const SCENARIOS = {
    'recents: save a song while the portable Recent panel is open': {
        spy: ['updateRecentCount', 'renderPortableRecentlyPlayed'],
        setup: "document.getElementById('recently-played-content').classList.add('active');",
        run: 'saveToRecentlyPlayed(SONGS_DATA[0]);'
    },
    'history: record a play while the History view is showing': {
        spy: ['renderHistoryView'],
        setup: 'currentView = VIEWS.HISTORY;',
        run: 'saveToPlayHistory(SONGS_DATA[0], 4000);'
    },
    'pinned: pin then unpin an item': {
        spy: ['showNotification', 'renderLeftPanelMainList', 'renderLeftPanelVisibleItems', 'updateScrollbarById'],
        setup: '',
        run: "togglePinItem('playlist-zz', 'Zed'); togglePinItem('playlist-zz', 'Zed');"
    },
    'pinned: move a played item to the top': {
        spy: ['renderPlaylistsView', 'renderAlbumLeftPanelItems', 'renderArtistLeftPanelItems', 'renderLeftPanelMainList', 'renderLeftPanelVisibleItems', 'updateScrollbarById'],
        setup: "createPlaylist('A'); createPlaylist('B'); window.__older = getPlaylists()[1].id;",
        run: "movePlayedItemToTop('playlist-' + window.__older);"
    },
    'pinned: pin then unpin inside a folder': {
        spy: ['showNotification', 'renderFolderContents', 'renderLeftPanelMainList', 'renderLeftPanelVisibleItems', 'updateScrollbarById'],
        setup: '',
        run: "togglePinItemInFolder('folder-q', 'playlist-zz', 'Zed'); togglePinItemInFolder('folder-q', 'playlist-zz', 'Zed');"
    },
    'playlists: create, add a song, remove it, delete': {
        spy: ['renderPlaylistsView', 'renderLeftPanelMainList', 'renderLeftPanelVisibleItems', 'updateScrollbarById', 'showNotification'],
        setup: '',
        run: 'const p = createPlaylist("S"); addSongToPlaylist(1, p.id); removeSongFromPlaylist(1, p.id); deletePlaylist(p.id);'
    },
    'search history: delete an entry while the Search History view is showing': {
        spy: ['renderSearchHistoryView', 'showNotification'],
        setup: "saveSearchToHistory('q', 'sess-1', 2); currentView = VIEWS.SEARCH_HISTORY;",
        run: "deleteSearchHistoryEntry('sess-1');"
    },
    'playback settings: turn gapless on then off': {
        spy: ['prepareGaplessNextTrack', 'clearGaplessPreload', 'applyTrackVolume'],
        setup: '',
        run: "setAudioPlaybackSetting('gaplessEnabled', true); setAudioPlaybackSetting('gaplessEnabled', false);"
    },
    // The "clear" flows below start with `await showConfirmDialog(...)`. The scenarios replace
    // it with an instant "yes" so the real function runs end to end. Anything that happens in
    // a setTimeout (e.g. updateExternalScrollbar after 100ms) is waited for explicitly.
    'search history: clear all while the Search History view is showing': {
        spy: ['renderSearchHistoryView', 'showNotification'],
        setup: "window.showConfirmDialog = async () => true; saveSearchToHistory('q', 's1', 1); currentView = VIEWS.SEARCH_HISTORY;",
        run: 'await clearSearchHistory();'
    },
    'recents: clear while the Recent view is showing and the portable panel is open': {
        spy: ['updateRecentCount', 'renderRecentlyPlayed', 'updateExternalScrollbar', 'renderPortableRecentlyPlayed', 'showNotification'],
        setup: "window.showConfirmDialog = async () => true; saveToRecentlyPlayed(SONGS_DATA[0]); currentView = VIEWS.RECENT; document.getElementById('recently-played-content').classList.add('active');",
        run: 'await clearRecentlyPlayed(); await new Promise((r) => setTimeout(r, 300));'
    },
    'history: clear while the History view is showing': {
        spy: ['showHeroSection', 'updateHeroSection', 'renderHistoryView', 'updateExternalScrollbar', 'showNotification'],
        setup: "window.showConfirmDialog = async () => true; saveToPlayHistory(SONGS_DATA[0], 4000); currentView = VIEWS.HISTORY;",
        run: 'await clearPlayHistory(); await new Promise((r) => setTimeout(r, 300));'
    },
    'playlists: delete through the confirm flow': {
        spy: ['renderPlaylistsView', 'renderLeftPanelMainList', 'renderLeftPanelVisibleItems', 'updateScrollbarById', 'showNotification'],
        setup: "window.showConfirmDialog = async () => true; window.__pid = createPlaylist('Doomed').id;",
        run: 'await deletePlaylistAndClose(window.__pid);'
    },
    'library rebuild: the UI refresh after the song list was replaced': {
        spy: ['updateQueueDisplay', 'updateAlbumArt', 'updateAllCounts', 'updateLeftPanelCounts', 'renderPlaylistsView', 'renderAlbumLeftPanelItems', 'renderArtistLeftPanelItems', 'renderLeftPanelMainList', 'renderSongsList', 'setupHeroSection'],
        setup: 'currentView = VIEWS.ALL_SONGS;',
        run: "emit('library:rebuilt', { songs: [] });"
    }
};

// Runs one scenario in a Playwright page and returns the recorded call sequence.
// `runOverride` lets the probe run the ORIGINAL inline code (before the conversion) for
// scenarios whose original form can't be called directly.
async function measure(page, scenario, runOverride) {
    return page.evaluate(
        async ({ spy, setup, run }) => {
            const seen = [];
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            await new AsyncFunction(setup)();
            for (const name of spy) {
                if (typeof window[name] !== 'function') continue;
                const real = window[name];
                window[name] = (...args) => {
                    seen.push(name);
                    return real.apply(window, args);
                };
            }
            await new AsyncFunction(run)();
            return seen;
        },
        { spy: scenario.spy, setup: scenario.setup, run: runOverride || scenario.run }
    );
}

module.exports = { SCENARIOS, measure };
