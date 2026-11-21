// Lyrics view. The engine draws the lyrics page (js/ui/04g, 11a, 19) and
// its Write editor (js/lyrics/18) in the shell's view host; lyrics.css and lyrics-editors.css skin them; this file adds what
// the engine does not have, the mode bar:
//
//   [song title, artist]                      Find | Many songs | Write | Sync
//
// Find is the engine's page; Batch (lyrics-many.js) and Sync (sync-editor.js) are drawn here and need no playing song: Sync has its own audio
// and its own list of songs. There is no View: the lyrics are read in the right panel and in its full-size mode. Write is the engine's
// editor: it appends it to <body> as an overlay, the bridge moves it into the page (adoptLyricsEditors) and the skin makes it fill it, so all
// four are modes of one panel. Nothing here touches an engine element.

import { tabs, el, confirmDialog } from '../../components/index.js';
import { adoptLyricsEditors } from '../../adapter/engine-view.js';
import { isPlaying } from '../../adapter/store.js';
import { notifyProgress, openNotificationTarget } from '../../shell/notify.js';
import { createFinderNotice } from './lyrics-finder-notice.js';
import { mountManySongs } from './lyrics-many.js';
import { activeSyncSongId, discardSyncChanges, mountSyncEditor, syncMounted, syncUnsaved } from './sync-editor.js';
import { inToolWindow, toolWindowButton } from '../../shell/tool-popout.js';
import { confirmDialogOpen, engineAction, engineConfirm, engineEvent, engineView, lyricsEditorDirty, lyricsEditors, nowPlaying, watchLyricsEditors } from '../../adapter/engine-api.js';

const MODE_OF_VIEW = { 'online-lyrics': 'find', 'smart-lyrics': 'batch' };
// Find without a song playing is the engine's manual search: empty fields, and a result can be saved to any song.
const OPEN = {
    find: () => engineAction(nowPlaying() ? 'openOnlineLyricsView' : 'openOnlineLyricsSearchView'),
    batch: () => engineAction('openSmartLyricsFinder'),
    write: () => engineAction('openLyricsEditor')
};

let stop = () => {};
let finderWatch = null;

// One notification for the Many songs finder. It outlives the view: the run goes on when the person leaves Lyrics, so this is
// subscribed once, the first time Lyrics is shown, and never stopped. The click opens the finder page as it is: openSmartLyricsFinder
// would clear the results, so the page is shown with the engine's switchView instead.
function watchFinder() {
    if (finderWatch) return;
    finderWatch = engineEvent('smartLyrics:progress', createFinderNotice({
        notifyProgress,
        stop: () => engineAction('stopSmartLyricsFinder'),
        open: () => {
            whenClosed(closeEditors(), () => {
                openNotificationTarget({ view: 'lyrics' });
                engineAction('switchView', 'smart-lyrics');
            });
        }
    }));
}

// Waits for the engine's own "Discard Sync?" dialog (it answers when the person clicks). Resolves true when the editor closed (Discard) and
// false when it stays open (Keep Editing, Escape). The adapter reports the editors' class changes and the dialog coming and going.
function waitForSyncEditor() {
    return new Promise((resolve) => {
        let done = false;
        let stopWatching = () => {};
        const finish = (closed) => {
            if (done) return;
            done = true;
            stopWatching();
            clearTimeout(giveUp);
            resolve(closed);
        };
        const check = () => {
            if (!lyricsEditors().sync) return finish(true);
            if (confirmDialogOpen()) return; // still asking
            // The dialog is gone but the editor is open: the engine closes it a moment after the dialog (its answer is a promise), so look again.
            setTimeout(() => finish(!lyricsEditors().sync), 80);
        };
        stopWatching = watchLyricsEditors(check);
        const giveUp = setTimeout(() => finish(false), 10 * 60 * 1000); // a dialog nobody answers must not hold a navigation forever
    });
}

// Closes whichever editor is open. Returns true (closed or none was open), false (it stays open: the person chose to keep editing), or a
// Promise of one of them while the engine's "Discard Sync?" dialog is waiting for an answer.
function closeEditors({ keepSync = false } = {}) {
    const open = lyricsEditors();
    if (open.write) {
        if (lyricsEditorDirty() && !engineConfirm('Discard unsaved lyrics?')) return false;
        engineAction('closeLyricsEditor');
    }
    if (open.sync) {
        engineAction('attemptCancelSyncEditor');
        if (lyricsEditors().sync) return waitForSyncEditor();
    }
    // The Sync editor of this page keeps its songs while it is away, but timing that is not saved would be lost for good if the person walked off
    // by accident, so leaving it asks first. `keepSync`: the editor stays (a move from Sync to Sync, the Sync window button).
    const unsaved = keepSync || !syncMounted() ? [] : syncUnsaved();
    if (unsaved.length) {
        const one = unsaved.length === 1;
        return confirmDialog({
            title: 'Leave Sync?',
            message: one ? `"${unsaved[0]}" has timing that is not saved. If you leave now it is discarded.` : `${unsaved.length} songs have timing that is not saved. If you leave now it is discarded.`,
            confirmLabel: 'Discard and leave',
            cancelLabel: 'Keep editing',
            destructive: true
        }).then((leave) => {
            if (leave) discardSyncChanges();
            return Boolean(leave);
        });
    }
    return true;
}

// Runs `then` once the editors are closed (now, or after the dialog's answer) and `otherwise` when they stay open. Returns what it returns,
// or a Promise of it when it had to wait.
function whenClosed(closed, then, otherwise = () => false) {
    if (closed && typeof closed.then === 'function') return closed.then((ok) => (ok ? then() : otherwise()));
    return closed ? then() : otherwise();
}

/**
 * The shell calls this before it leaves the view. An editor that stays open keeps its keyboard shortcuts alive, so it is closed.
 * Returns false to stay (unsaved lyrics: the person said no), or a Promise of true/false while the Sync editor asks "Discard Sync?":
 * the shell carries out the change the person asked for when the answer is Discard (it used to forget it, and the click did nothing).
 */
export function leaveLyrics() {
    return whenClosed(closeEditors(), () => {
        stop();
        return true;
    });
}

/**
 * Puts the mode bar above the engine page that is already in `host`. Safe to call again: the previous bar is removed first.
 * options.chosen: the person picked Lyrics in the rail or a menu. With a song playing that opens the Sync tool;
 * with nothing playing, or when the engine opened its own lyrics page, it goes to Find.
 */
export function mountLyricsModes(host, options = {}) {
    watchFinder();
    stop();
    host.querySelector(':scope > .lyrics-bar')?.remove();
    host.querySelector(':scope > .lyrics-many-host')?.remove();
    host.querySelector(':scope > .lyrics-sync-host')?.remove();
    engineAction('setSmartLyricsExternalView', true); // the Batch page is drawn here (lyrics-many.js), so the engine must not draw its own

    // The tabs sit in the middle of the bar; the song's name is not repeated here (the player and the right panel show it).
    const modes = tabs({
        label: 'Lyrics mode',
        items: [{ id: 'find', label: 'Find' }, { id: 'batch', label: 'Batch' }, { id: 'write', label: 'Write' }, { id: 'sync', label: 'Sync' }],
        value: 'find',
        onChange: (mode) => go(mode)
    });
    // Sync apart from the main page, next to the player (shown on the Sync tab). The editor here is closed first.
    const windowButton = toolWindowButton('sync', (open) => whenClosed(closeEditors({ keepSync: true }), open), activeSyncSongId);
    windowButton.hidden = true;
    const bar = el('div', { class: 'lyrics-bar' }, el('div', { class: 'lyrics-bar__modes' }, modes.el), windowButton);
    let many = null; // { node, stop } while the Batch tab is showing
    let syncing = options.mode === 'sync'; // the Sync tab is showing (the editor is drawn here, not by the engine)
    let syncAt = engineView(); // the engine's page when it was entered: Sync stays until the engine moves to another one by itself
    let sync = null; // { node, stop } while it is

    function showMany(on) {
        if (on && !many) {
            const node = el('div', { class: 'lyrics-many-host' });
            host.append(node);
            many = { node, stop: mountManySongs(node) };
        } else if (!on && many) {
            many.stop();
            many.node.remove();
            many = null;
        }
    }

    // The Sync editor keeps its songs and their lines outside the page, so leaving the tab loses nothing and asks nothing.
    function showSync(on, fromPlayer = false) {
        if (on && !sync) {
            const node = el('div', { class: 'lyrics-sync-host' });
            host.append(node);
            sync = { node, stop: mountSyncEditor(node, { fromPlayer, songId: options.songId }) };
        } else if (!on && sync) {
            sync.stop();
            sync.node.remove();
            sync = null;
        }
    }

    // Leaves an open editor (asking first when something would be lost), then opens `mode`. Does not open it when the person chose to keep
    // editing.
    function go(mode, fromPlayer = false) {
        return whenClosed(
            closeEditors({ keepSync: mode === 'sync' }),
            () => {
                syncing = mode === 'sync';
                if (syncing) syncAt = engineView();
                if (syncing) paint(fromPlayer);
                else {
                    OPEN[mode]();
                    paint();
                }
            },
            () => paint()
        );
    }

    function paint(fromPlayer = false) {
        adoptLyricsEditors(host);
        const song = nowPlaying();
        const editors = lyricsEditors();
        const view = engineView();
        if (syncing && (editors.write || view !== syncAt)) syncing = false; // the engine moved to another page by itself
        const mode = syncing ? 'sync' : editors.write ? 'write' : MODE_OF_VIEW[view] || '';
        modes.setDisabled('write', !song && !editors.write);
        if (mode) modes.setValue(mode);
        else for (const tab of modes.el.querySelectorAll('.tab')) tab.setAttribute('aria-selected', 'false');
        host.dataset.lyricsMode = mode || view;
        showMany(mode === 'batch');
        showSync(mode === 'sync', fromPlayer);
        windowButton.hidden = mode !== 'sync' || inToolWindow();
        host.dataset.playing = String(isPlaying()); // the sync editor's play button is drawn by CSS from this
    }

    // The engine's own lyrics page is not a mode here. If it ever comes up while this page is open (the engine switching to it by itself,
    // the old "Back to Lyrics" button), the person is moved on to Find at once, so the main view never shows the lyrics.
    let leaving = false;
    const live = () => {
        if (!bar.isConnected) return stop();
        if (lyricsEditors().sync) return void engineAction('attemptCancelSyncEditor'); // the engine's own Sync overlay is not used: the editor here replaces it
        const idle = !lyricsEditors().write;
        if (idle && !syncing && engineView() === 'lyrics' && !leaving) {
            leaving = true;
            try {
                go('find');
            } finally {
                leaving = false;
            }
            return;
        }
        paint();
    };
    const offs = ['view:changed', 'lyrics:changed', 'queue:indexChanged', 'playback:stateChanged'].map((name) => engineEvent(name, live));
    offs.push(watchLyricsEditors(live));
    stop = () => {
        for (const off of offs) off();
        showMany(false);
        showSync(false);
        stop = () => {};
    };
    host.prepend(bar);
    paint();
    // The engine's own lyrics page (the old View) is not a mode here. Whoever lands on it, from the rail or from the engine, is moved on:
    // to Sync when the rail item was chosen with a song playing, otherwise to Find.
    const idle = !lyricsEditors().sync && !lyricsEditors().write;
    if (syncing) paint(options.mode === 'sync' && options.chosen === true);
    else if (idle && options.chosen && nowPlaying()) go('sync', true);
    else if (idle && engineView() === 'lyrics') go('find');
}
