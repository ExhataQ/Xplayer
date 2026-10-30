// Metadata view (task D-04, agent D). Strategy S3 (decision D16): the engine builds the tag form (js/library/20-metadata-editor.js);
// it lives in the engine's right panel, so the bridge (adapter/engine-view.js showEnginePanel) moves that tab into the shell's view
// host and metadata.css skins it. This file adds what the engine does not have:
//
//   - an empty state when nothing is playing (the engine just does nothing then),
//   - the editor follows the song that is playing, unless the form holds unsaved changes,
//   - leaving the view with unsaved changes asks first (the shell calls leaveMetadata()),
//   - a switch "One song | Many songs": Many songs is the tag sheet (tag-sheet.js), many songs on one screen.
//
// Save, Cancel and Back are the engine's: it closes the editor and the shell goes back to the view the person came from.

import { el, emptyState, iconButton, tabs } from '../../components/index.js';
import { inToolWindow, toolWindowButton } from '../../shell/tool-popout.js';
import { engineAction, engineConfirm, engineEvent, metadataEditor, nowPlaying } from '../../adapter/engine-api.js';
import { discardTagSheet, mountTagSheet, tagSheetDirty } from './tag-sheet.js';
import { openSongInfo } from './song-info.js';

let stop = () => {};
let mode = 'one'; // 'one' | 'many', kept while the app runs

/** Fills the host that already holds the engine's editor tab. `options.fromEngine`: the engine opened it, so it is already filling it. */
export function mountMetadata(host, options = {}) {
    stop();
    host.querySelector(':scope > .empty-state')?.remove();
    host.querySelector(':scope > .metadata-mode')?.remove();
    host.querySelector(':scope > .tag-sheet-host')?.remove();
    const sheetHost = el('div', { class: 'tag-sheet-host' });
    // The editor in a window of its own, next to the player. This window's editor is closed first (asking about unsaved changes), so the
    // same song is never edited in two places.
    const windowButton = toolWindowButton('metadata', (open) => leaveMetadata() && open());
    // The same bar as the Lyrics tool: tabs in the middle (views/tools/lyrics.js), the two small buttons beside them.
    const modeSwitch = tabs({ label: 'Edit', value: mode, items: [{ id: 'one', label: 'One song' }, { id: 'many', label: 'Many songs' }], onChange: (next) => setMode(next) });
    const infoButton = iconButton({ icon: 'info', label: 'Track information for the playing song', size: 'sm', onClick: () => openSongInfo() });
    host.prepend(el('div', { class: 'metadata-mode' }, modeSwitch.el, infoButton, inToolWindow() ? null : windowButton));
    host.append(sheetHost);
    const setMode = (next) => {
        if (next === 'many' && metadataEditor().dirty && !engineConfirm('Discard unsaved metadata changes?')) return modeSwitch.setValue('one');
        mode = next;
        host.dataset.metadataMode = mode;
        if (mode === 'many') {
            // The engine's editor is only hidden (CSS), not closed: closing it makes the shell leave the view.
            mountTagSheet(sheetHost);
        } else {
            sheetHost.replaceChildren();
            if (nowPlaying()) engineAction('openMetadataEditor');
            paint();
        }
    };
    host.dataset.metadataMode = mode;
    const empty = emptyState({ icon: 'tag', title: 'No song playing', text: 'Play a song to edit its tags and cover.' });
    empty.hidden = true;
    host.append(empty);

    // Opened from the rail the editor is started fresh: whatever form is still in the panel belongs to an earlier visit.
    let openedFor = options.fromEngine ? nowPlaying()?.id : null;
    if (!options.fromEngine && nowPlaying() && mode === 'one') {
        openedFor = nowPlaying().id;
        engineAction('openMetadataEditor');
    }

    const paint = () => {
        const song = nowPlaying();
        host.dataset.metadata = song || metadataEditor().rendered ? 'editing' : 'empty';
        empty.hidden = host.dataset.metadata !== 'empty';
        // A new song while the form is clean: show that song. With unsaved changes the form stays on the song it was opened for.
        if (mode === 'one' && song && song.id !== openedFor && !metadataEditor().dirty) {
            openedFor = song.id;
            engineAction('openMetadataEditor');
        }
    };

    const offs = ['queue:indexChanged', 'rightPanel:tabChanged'].map((name) => engineEvent(name, () => (host.isConnected && host.dataset.view === 'metadata' ? paint() : stop())));
    stop = () => {
        for (const off of offs) off();
        stop = () => {};
    };
    paint();
    if (mode === 'many') mountTagSheet(sheetHost);
}

/** The shell calls this before it leaves the view. Returns false to stay. Closes the engine's editor when the person leaves. */
export function leaveMetadata() {
    if (metadataEditor().dirty && !engineConfirm('Discard unsaved metadata changes?')) return false;
    if (tagSheetDirty()) {
        if (!engineConfirm('Discard the changes in the tag sheet? They have not been saved.')) return false;
        discardTagSheet();
    }
    stop();
    engineAction('closeMetadataEditor');
    return true;
}
