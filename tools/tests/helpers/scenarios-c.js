'use strict';

// Event-bus call-sequence scenarios owned by Agent C: lyrics, metadata and panels (08*, 11, 12, 18-21).
// Format and workflow: see helpers/sequence-suite.js.
// Spy only on UI functions that live in D's files; keep scenarios small (one reaction each).

// EB-C1: every place that redraws the lyrics view after a song's lyrics changed.
// Each case runs twice: with the Lyrics view open (the redraw must happen) and with another
// view open (it must not, except at the two call sites that never had that guard).
const LYRICS_SPY = ['renderLyricsView', 'renderTrackLyricsBox', 'showNotification'];
const QUEUE = 'playbackQueue = [SONGS_DATA[0]]; currentQueueIndex = 0; window.__sid = SONGS_DATA[0].id; ';
const TEXTAREA = "const ta = document.createElement('textarea'); ta.id = 'lyrics-editor-textarea'; ta.value = 'la la'; document.body.appendChild(ta); ";
const VARIANT = "window.__vid = addSyncedLyricsVariant(window.__sid, '[00:01.00]hi\\n[00:02.00]yo', 0).id; ";
const WAIT = ' await new Promise((r) => setTimeout(r, 100));';

const CASES = {
    'save plain lyrics from the editor (saveLyricsForSong)': { setup: TEXTAREA, run: 'saveLyricsForSong(window.__sid);' },
    'clear lyrics from the editor (clearLyricsForSong)': { setup: '', run: 'clearLyricsForSong(window.__sid);' },
    'save lyrics with the editor Save button (saveLyricsFromEditor)': { setup: TEXTAREA, run: 'saveLyricsFromEditor();' },
    'clear lyrics with the editor Clear button (clearLyricsForCurrentSong)': { setup: '', run: 'clearLyricsForCurrentSong();' },
    'pick a synced variant (selectSyncedVariant)': { setup: VARIANT, run: 'selectSyncedVariant(window.__vid);' },
    'rename a synced variant (renameSyncedVariant)': { setup: VARIANT + "window.prompt = () => 'Renamed';", run: 'renameSyncedVariant(window.__vid);' },
    'delete a synced variant (deleteSyncedVariant)': { setup: VARIANT + 'window.showConfirmDialog = async () => true;', run: 'deleteSyncedVariant(window.__vid);' + WAIT },
    'switch plain/synced display mode (setLyricsDisplayMode)': { setup: '', run: "setLyricsDisplayMode('plain');" },
    'clear synced lyrics (clearSyncedLyricsForCurrentSong)': { setup: '', run: 'clearSyncedLyricsForCurrentSong();' },
    'save pasted LRC text (saveLrcPaste)': {
        setup: "const ta = document.createElement('textarea'); ta.id = 'lrc-paste-textarea'; ta.value = '[00:01.00]hi\\n[00:02.00]yo'; document.body.appendChild(ta);",
        run: 'saveLrcPaste();'
    },
    'import an LRC file (importLrcFile)': {
        setup: "window.__inputs = []; const mk = document.createElement.bind(document); document.createElement = (t, o) => { const e = mk(t, o); if (t === 'input') window.__inputs.push(e); return e; };",
        run: "importLrcFile(); window.__inputs[0].onchange({ target: { files: [new File(['[00:01.00]hi\\n[00:02.00]yo'], 'a.lrc')] } });" + WAIT
    },
    'save the sync editor as a new variant (saveSyncEditor)': {
        setup: "syncEditorState = { songId: window.__sid, lines: [{ text: 'hi', time: 1 }, { text: 'yo', time: 2 }], offset: 0 };",
        run: 'saveSyncEditor();'
    },
    'delete the saved lyrics of the playing song (deleteSavedLyricsEntry)': {
        setup: "setLyricsForSong(window.__sid, 'saved text');",
        run: 'deleteSavedLyricsEntry(SONGS_DATA[0].url);'
    },
    'remove all saved lyrics (removeAllSavedLyrics)': {
        setup: "setLyricsForSong(window.__sid, 'saved text'); window.showConfirmDialog = async () => true;",
        run: 'await removeAllSavedLyrics();'
    },
    'load the playing song into the right panel (updateAlbumArt)': { setup: '', run: 'updateAlbumArt();' },
    'apply online lyrics to a song (applyOnlineLyricsToSong)': { setup: '', run: "applyOnlineLyricsToSong(window.__sid, 'some lyrics', 'plain');" }
};

const SCENARIOS = {};
for (const [name, c] of Object.entries(CASES)) {
    for (const [label, view] of [['Lyrics view open', 'VIEWS.LYRICS'], ['another view open', 'VIEWS.ALL_SONGS']]) {
        SCENARIOS[`lyrics: ${name}, ${label}`] = {
            spy: LYRICS_SPY,
            setup: QUEUE + 'currentView = ' + view + '; ' + c.setup,
            run: c.run
        };
    }
}

// EB-C3: the search panel (08h). Spies include navigation calls so the position of the
// converted calls relative to them is pinned (the hero, the count and the list order matter).
const SEARCH_SPY = [
    'pushViewToHistory', 'showTracklistHeader', 'setupHeroSection', 'updateHeroCover',
    'renderSongsList', 'reapplyHighlightAfterFilter', 'reapplySelectionAfterFilter',
    'resetLeftPanelActiveState', 'activateLeftPanelItem', 'updateExternalScrollbar',
    'renderLeftPanelMainList', 'updateScrollbarById'
];
const SEARCH_CASES = {
    'main search box: a query is typed': {
        setup: "getCachedEl('search-input').value = 'Song title number 1'; currentView = VIEWS.ALL_SONGS;",
        run: 'performSearchNow();' + WAIT
    },
    'main search box: the same query is edited again (continuing session)': {
        setup: "getCachedEl('search-input').value = 'Song title number 1'; performSearchNow(); await new Promise((r) => setTimeout(r, 300)); getCachedEl('search-input').value = 'Song title number 12';",
        run: 'performSearchNow();' + WAIT
    },
    'main search box: the query is cleared': {
        // The real code reads getCachedEl('all-songs-count'), an id that does not exist in the app, so this
        // branch throws right after the list is redrawn. The scenario records that behavior as it is
        // (try/catch) instead of hiding it; fixing it is not part of the event-bus work.
        setup: "getCachedEl('search-input').value = ''; currentView = VIEWS.SEARCH_ITEMS;",
        run: 'try { performSearchNow(); } catch (e) { /* known: missing #all-songs-count */ }' + WAIT
    },
    'subhero search: text is typed in a song list': {
        setup: "currentView = VIEWS.ALL_SONGS; getCachedEl('subhero-search-input').value = 'Artist 3';",
        run: 'performSubheroSearch();'
    },
    'subhero search: the box is emptied': {
        setup: "currentView = VIEWS.ALL_SONGS; getCachedEl('subhero-search-input').value = '';",
        run: 'performSubheroSearch();'
    },
    'left panel search: the box is emptied': {
        setup: "getCachedEl('left-panel-search-input').value = '';",
        run: 'performLeftPanelSearch();'
    },
    'left panel search: text is typed': {
        setup: "getCachedEl('left-panel-search-input').value = 'zzz';",
        run: 'performLeftPanelSearch();'
    }
};
for (const [name, c] of Object.entries(SEARCH_CASES)) {
    SCENARIOS[`search: ${name}`] = { spy: SEARCH_SPY, setup: c.setup, run: c.run };
}

// EB-C4: the right panel tabs (08d). updateRightPanelHeader and updateInfoButtonVisibility are Agent C's
// own functions; they are spied only to pin where the converted call sits relative to them.
const TAB_SPY = ['updateRightPanelHeader', 'renderPortableRecentlyPlayed', 'updateInfoButtonVisibility', 'updateScrollbarById'];
for (const tab of ['recently-played', 'queue', 'tags']) {
    SCENARIOS[`right panel: switch to the ${tab} tab`] = { spy: TAB_SPY, setup: '', run: `switchRightPanelTab('${tab}');` };
}

module.exports = { SCENARIOS };
