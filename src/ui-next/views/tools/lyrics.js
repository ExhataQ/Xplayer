// Lyrics view (tasks D-01, D-02 and D-03, agent D). Strategy S3 (decision D16): the engine draws the lyrics page (js/ui/04g, 11a, 19) and
// its two editors (js/lyrics/18, 11c-11g) in the shell's view host; lyrics.css and lyrics-editors.css skin them; this file adds what
// the engine does not have, the mode bar:
//
//   [song title, artist]                      View | Find | Many songs | Write | Sync
//
// View, Find and Many songs are the engine's three pages (Many songs is its multi-song finder, which needs no playing song). Write and Sync are its two editors: the engine appends them to <body> as overlays, the
// bridge moves them into the page (adoptLyricsEditors) and the skin makes them fill it, so all four are modes of one panel.
// Nothing here touches an engine element.

import { tabs, el } from '../../components/index.js';
import { adoptLyricsEditors } from '../../adapter/engine-view.js';
import { isPlaying } from '../../adapter/store.js';
import { mountAiLyricsBar } from '../../shell/ai-slots.js';
import { engineAction, engineConfirm, engineEvent, engineView, lyricsEditorDirty, lyricsEditors, nowPlaying, watchLyricsEditors } from '../../adapter/engine-api.js';

const MODE_OF_VIEW = { lyrics: 'view', 'online-lyrics': 'find', 'smart-lyrics': 'batch' };
// Find without a song playing is the engine's manual search: empty fields, and a result can be saved to any song.
const OPEN = {
    view: () => engineAction('switchView', 'lyrics'),
    find: () => engineAction(nowPlaying() ? 'openOnlineLyricsView' : 'openOnlineLyricsSearchView'),
    batch: () => engineAction('openSmartLyricsFinder'),
    write: () => engineAction('openLyricsEditor'),
    sync: () => engineAction('openSyncEditor')
};

let stop = () => {};

// Closes whichever editor is open. Returns false when it stays open: the person chose to keep editing, or the engine's own dialog
// ("Discard Sync?", shown when timings would be lost) is waiting for an answer.
function closeEditors() {
    const open = lyricsEditors();
    if (open.write) {
        if (lyricsEditorDirty() && !engineConfirm('Discard unsaved lyrics?')) return false;
        engineAction('closeLyricsEditor');
    }
    if (open.sync) {
        engineAction('attemptCancelSyncEditor');
        if (lyricsEditors().sync) return false;
    }
    return true;
}

/** The shell calls this before it leaves the view. An editor that stays open keeps its keyboard shortcuts alive, so it is closed. */
export function leaveLyrics() {
    if (!closeEditors()) return false;
    stop();
    return true;
}

/**
 * Puts the mode bar above the engine page that is already in `host`. Safe to call again: the previous bar is removed first.
 * options.chosen: the person picked Lyrics in the rail or a menu. With a song playing that opens the Sync tool (PC-07, brief 4.1);
 * with nothing playing, or when the engine opened its own lyrics page, it stays on the View page.
 */
export function mountLyricsModes(host, options = {}) {
    stop();
    host.querySelector(':scope > .lyrics-bar')?.remove();

    const title = el('span', { class: 'lyrics-bar__title', dir: 'auto' });
    const artist = el('span', { class: 'lyrics-bar__artist', dir: 'auto' });
    const modes = tabs({
        label: 'Lyrics mode',
        items: [{ id: 'view', label: 'View' }, { id: 'find', label: 'Find' }, { id: 'batch', label: 'Many songs' }, { id: 'write', label: 'Write' }, { id: 'sync', label: 'Sync' }],
        value: 'view',
        onChange: (mode) => go(mode)
    });
    const hint = el('p', { class: 'lyrics-bar__hint', role: 'status' });
    const bar = el('div', { class: 'lyrics-bar' }, el('div', { class: 'lyrics-bar__song' }, title, artist), el('div', { class: 'lyrics-bar__modes' }, modes.el), hint);
    mountAiLyricsBar(bar); // Agent E: the Translate controls (original / translated, translate now, auto-translate); nothing when AI is not set up

    // Leaves an open editor (asking first when something would be lost), then opens `mode`. Returns without opening when the person
    // chose to keep editing. The sync editor asks with the engine's own dialog, which answers later: the person picks the tab again.
    function go(mode) {
        if (!closeEditors()) return paint();
        OPEN[mode]();
        paint();
    }

    function paint() {
        adoptLyricsEditors(host);
        const song = nowPlaying();
        const editors = lyricsEditors();
        const view = engineView();
        const mode = editors.sync ? 'sync' : editors.write ? 'write' : MODE_OF_VIEW[view] || '';
        title.textContent = song ? song.title : '';
        artist.textContent = song ? song.artist : '';
        for (const id of ['write', 'sync']) modes.setDisabled(id, !song && !editors[id]);
        if (mode) modes.setValue(mode);
        else for (const tab of modes.el.querySelectorAll('.tab')) tab.setAttribute('aria-selected', 'false');
        host.dataset.lyricsMode = mode || view;
        host.dataset.playing = String(isPlaying()); // the sync editor's play button is drawn by CSS from this
        hint.hidden = !(song && mode === 'view' && !song.hasLyrics && !song.hasSynced && !song.instrumental);
        hint.textContent = hint.hidden ? '' : 'No lyrics for this song yet. Find them online, write them, or import an .lrc file.';
    }

    const live = () => (bar.isConnected ? paint() : stop());
    const offs = ['view:changed', 'lyrics:changed', 'queue:indexChanged', 'playback:stateChanged'].map((name) => engineEvent(name, live));
    offs.push(watchLyricsEditors(live));
    stop = () => {
        for (const off of offs) off();
        stop = () => {};
    };
    host.prepend(bar);
    paint();
    if (options.chosen && nowPlaying() && !lyricsEditors().sync && !lyricsEditors().write) go('sync');
}
