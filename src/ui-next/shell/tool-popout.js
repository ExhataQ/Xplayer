// A tool window: the Metadata editor or the Sync tool in a window of its own, so it can sit next to the player.
// It is the same page started with ?tool=<metadata|sync>&song=<id> (electron/window-manager.js, openToolWindow). The page then shows only
// that tool (css: html[data-tool-window]); it starts the song it was opened for, silent, because both tools work on the playing song.
//
//   toolWindowParams(search)    { tool, song } from the address, or null in the normal window
//   startToolWindow(showView)   called once the library is ready; does nothing in the normal window
//   openInWindow(tool)          the button: opens (or brings forward) the tool's window for the song that plays

import { iconButton } from '../components/index.js';
import { engineAction, librarySong, lyricsEditors, nowPlaying, onToolWindowSong, openToolWindow, pauseWhenPlaying } from '../adapter/engine-api.js';

const TOOLS = ['metadata', 'sync'];

export function toolWindowParams(search = typeof location === 'undefined' ? '' : location.search) {
    const query = new URLSearchParams(search);
    const tool = query.get('tool');
    return TOOLS.includes(tool) ? { tool, song: query.get('song') || '' } : null;
}

export const inToolWindow = () => Boolean(toolWindowParams());

/** The tool asks to be shown in its own window. Returns a promise of { ok, error? }. */
export function openInWindow(tool) {
    const song = nowPlaying();
    return openToolWindow(tool, song ? song.id : '');
}

const NAMES = { metadata: 'the Metadata editor', sync: 'Sync' };

/**
 * The small button that opens a tool in a window of its own. `before(open)` runs first and calls `open()` when it is fine to go on
 * (the tool's editor in this window is closed first, so one song is never edited in two places).
 */
export function toolWindowButton(tool, before = (open) => open()) {
    return iconButton({ icon: 'app-window', label: `Open ${NAMES[tool]} in a new window`, size: 'sm', onClick: () => before(() => openInWindow(tool)) });
}

export function startToolWindow(showView) {
    const params = toolWindowParams();
    if (!params) return false;
    document.documentElement.dataset.toolWindow = params.tool;
    const startSong = (id) => {
        const song = id ? librarySong(id) : null;
        if (!song) return false;
        pauseWhenPlaying();
        engineAction('playSongFromList', song.id, 'all-songs');
        return true;
    };
    onToolWindowSong((id) => startSong(id)); // the main window asked again for this tool, for another song
    let tries = 0;
    const begin = () => {
        if (params.song && !startSong(params.song) && tries++ < 40) return void setTimeout(begin, 250); // the library may still be loading
        showView(params.tool === 'sync' ? 'lyrics' : 'metadata', { chosen: true });
        if (params.tool === 'sync') openSyncWhenReady();
    };
    // The song may not be the playing one yet when the view is shown; the Sync editor opens as soon as there is a song.
    let waited = 0;
    const openSyncWhenReady = () => {
        if (lyricsEditors().sync) return;
        if (nowPlaying()) return void engineAction('openSyncEditor');
        if (waited++ < 20) setTimeout(openSyncWhenReady, 250);
    };
    begin();
    return true;
}
