// A tool window: the Metadata editor or the Sync tool in a window of its own, so it can sit next to the player.
// It is the same page started with ?tool=<metadata|sync>&song=<id> (electron/window-manager.js, openToolWindow). The page then shows only
// that tool (css: html[data-tool-window]). The Metadata editor works on the playing song, so that window starts the song it was opened for,
// silent. The Sync editor has its own audio and its own list of songs: that window hands the song to it and plays nothing in the player.
//
//   toolWindowParams(search)    { tool, song } from the address, or null in the normal window
//   startToolWindow(showView)   called once the library is ready; does nothing in the normal window
//   openInWindow(tool)          the button: opens (or brings forward) the tool's window for the song that plays

import { iconButton } from '../components/index.js';
import { AI_VIEW_ID } from './ai-slots.js';
import { engineAction, librarySong, nowPlaying, onToolWindowSong, openToolWindow, pauseWhenPlaying } from '../adapter/engine-api.js';
import { sendToSync } from '../views/tools/sync-editor.js';

const TOOLS = ['metadata', 'sync', 'ai']; // 'ai' is the chat (views/ai); it does not start a song

export function toolWindowParams(search = typeof location === 'undefined' ? '' : location.search) {
    const query = new URLSearchParams(search);
    const tool = query.get('tool');
    return TOOLS.includes(tool) ? { tool, song: query.get('song') || '' } : null;
}

export const inToolWindow = () => Boolean(toolWindowParams());

/** The tool asks to be shown in its own window. Returns a promise of { ok, error? }. */
export function openInWindow(tool, songId) {
    const song = songId === undefined ? nowPlaying() : { id: songId };
    return openToolWindow(tool, song ? song.id : '');
}

const NAMES = { metadata: 'the Metadata editor', sync: 'Sync' };

/**
 * The small button that opens a tool in a window of its own. `before(open)` runs first and calls `open()` when it is fine to go on
 * (the tool's editor in this window is closed first, so one song is never edited in two places).
 */
export function toolWindowButton(tool, before = (open) => open(), songId = () => undefined) {
    return iconButton({ icon: 'window-open', label: `Open ${NAMES[tool]} in a new window`, size: 'sm', onClick: () => before(() => openInWindow(tool, songId())) });
}

export function startToolWindow(showView) {
    const params = toolWindowParams();
    if (!params) return false;
    document.documentElement.dataset.toolWindow = params.tool;
    if (params.tool === 'ai') {
        showView(AI_VIEW_ID, { chosen: true }); // only the chat; the library, queue and playlists stay the main window's
        return true;
    }
    const startSong = (id) => {
        const song = id ? librarySong(id) : null;
        if (!song) return false;
        if (params.tool === 'sync') return sendToSync(song.id);
        pauseWhenPlaying();
        engineAction('playSongFromList', song.id, 'all-songs');
        return true;
    };
    onToolWindowSong((id) => startSong(id)); // the main window asked again for this tool, for another song
    let tries = 0;
    const begin = () => {
        if (params.song && !startSong(params.song) && tries++ < 40) return void setTimeout(begin, 250); // the library may still be loading
        if (params.tool === 'sync') showView('lyrics', { chosen: true, mode: 'sync' });
        else showView('metadata', { chosen: true });
    };
    begin();
    return true;
}
