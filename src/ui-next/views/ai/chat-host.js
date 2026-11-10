// The chat in a window of its own (the pop-up's Expand button; electron/window-manager.js, the "ai" tool window).
//
// That window is the same page, but its library, queue and playlists are not the ones the person uses: the main window's are. So the
// chat window never reads or edits an engine of its own. Whatever needs the engine goes to the main window by name, through the relay
// in electron/ai/host-relay.js, and the main window runs only the names listed in HOST below.
//
//   serveMainWindow()        the main window: answers the chat window
//   useMainWindowEngine()    the chat window: sends engine calls to the main window, and shows views there
//   openChatWindow()         the pop-up's Expand: opens (or brings forward) the chat window

import { collectSongs, collectContext, currentLyrics, runPlan, undoEntry, setRemoteEngine, hostCall, serveHost } from '../../adapter/ai-bridge.js';
import { saveTranslation } from '../../adapter/ai-lyrics.js';
import { openToolWindow } from '../../adapter/engine-api.js';
import { openAiQueue, openAiPanel, openAiSettings, setAiAway, setAiWindowOpener } from '../../shell/ai-slots.js';
import { toolWindowParams } from '../../shell/tool-popout.js';

/** True in the chat's own window. */
export const inChatWindow = () => (toolWindowParams() || {}).tool === 'ai';

// What the main window will do for the chat window, and nothing else.
const HOST = {
    collect: (fields, options) => ({ songs: collectSongs(fields, options || {}), context: collectContext() }),
    currentLyrics: () => currentLyrics(),
    runPlan: (plan, summary) => runPlan(plan, summary),
    undoEntry: (id) => undoEntry(id),
    saveTranslation: (songId, text, language) => saveTranslation(songId, text, language),
    show: (what, id) => (what === 'queue' ? openAiQueue() : what === 'settings' ? openAiSettings() : openAiPanel(id)) || null
};

export function serveMainWindow() {
    serveHost(async (name, args) => {
        if (!Object.prototype.hasOwnProperty.call(HOST, name)) throw new Error('not-allowed');
        const value = await HOST[name](...args);
        return value === undefined ? null : value;
    });
}

export function useMainWindowEngine() {
    setRemoteEngine((name, ...args) => hostCall(name, args));
    setAiAway((what, id) => hostCall('show', [what, id], true).catch(() => null));
}

export function openChatWindow() {
    return openToolWindow('ai', '');
}

/** Wires whichever side this window is. The Expand button only opens a window when the app can (Electron with the new interface). */
export function setUpChatWindow() {
    if (inChatWindow()) useMainWindowEngine();
    else {
        serveMainWindow();
        setAiWindowOpener(() => openChatWindow().then((r) => (r && r.ok ? true : false)));
    }
}
