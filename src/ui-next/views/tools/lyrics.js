// Lyrics view (task D-01, agent D). Strategy S3 (decision D16): the engine draws the lyrics page (js/ui/04g, 11a, 19) in the
// shell's view host; lyrics.css skins it; this file adds what the engine does not have, the mode bar:
//
//   [song title, artist]            View | Find        Write  Sync
//
// View and Find are the two engine pages (the lyrics, and the online search). Write and Sync open the engine's editors, which are
// overlays today; D-03 turns them into modes of their own and they become tabs then. Nothing here touches an engine element.

import { tabs, button, el } from '../../components/index.js';
import { engineAction, engineEvent, engineView, nowPlaying } from '../../adapter/engine-api.js';

const MODE_OF_VIEW = { lyrics: 'view', 'online-lyrics': 'find' };
const VIEW_OF_MODE = { view: () => engineAction('switchView', 'lyrics'), find: () => engineAction('openOnlineLyricsView') };

let stop = () => {};

/** Puts the mode bar above the engine page that is already in `host`. Safe to call again: the previous bar is removed first. */
export function mountLyricsModes(host) {
    stop();
    host.querySelector(':scope > .lyrics-bar')?.remove();

    const title = el('span', { class: 'lyrics-bar__title', dir: 'auto' });
    const artist = el('span', { class: 'lyrics-bar__artist', dir: 'auto' });
    const modes = tabs({ label: 'Lyrics mode', items: [{ id: 'view', label: 'View' }, { id: 'find', label: 'Find' }], value: 'view', onChange: (id) => VIEW_OF_MODE[id]() });
    const write = button({ label: 'Write', size: 'sm', onClick: () => engineAction('openLyricsEditor') });
    const sync = button({ label: 'Sync', size: 'sm', onClick: () => engineAction('openSyncEditor') });
    const hint = el('p', { class: 'lyrics-bar__hint', role: 'status' });
    const bar = el('div', { class: 'lyrics-bar' }, el('div', { class: 'lyrics-bar__song' }, title, artist), el('div', { class: 'lyrics-bar__modes' }, modes.el), el('div', { class: 'lyrics-bar__editors' }, write, sync), hint);

    const paint = () => {
        const song = nowPlaying();
        const view = engineView();
        const mode = MODE_OF_VIEW[view] || '';
        title.textContent = song ? song.title : '';
        artist.textContent = song ? song.artist : '';
        write.disabled = sync.disabled = !song;
        if (mode) modes.setValue(mode);
        else for (const tab of modes.el.querySelectorAll('.tab')) tab.setAttribute('aria-selected', 'false');
        host.dataset.lyricsMode = mode || view;
        hint.hidden = !(song && mode === 'view' && !song.hasLyrics && !song.hasSynced && !song.instrumental);
        hint.textContent = hint.hidden ? '' : 'No lyrics for this song yet. Find them online, write them, or import an .lrc file.';
    };

    const offs = ['view:changed', 'lyrics:changed', 'queue:indexChanged'].map((name) => engineEvent(name, () => (bar.isConnected ? paint() : stop())));
    stop = () => {
        for (const off of offs) off();
        stop = () => {};
    };
    host.prepend(bar);
    paint();
}
