// engine-api: how views reach the engine's functions and events.
//
// Views never read engine globals themselves. They ask here:
//   nowPlaying()                 -> { id, title, artist, hasLyrics, hasSynced, instrumental } | null
//   engineView()                 -> the engine's current view name ('lyrics', 'online-lyrics', ...)
//   engineAction(name, ...args)  -> calls an engine function by name; false when it does not exist
//   engineEvent(name, callback)  -> unsubscribe(); only the allow-listed events, callback gets the payload
//   engineCall(name, ...args)    -> what an engine function answers (null when it does not exist); engineAction only says whether it ran
//   librarySong(id)              -> { id } of a library song, or null
//   pauseWhenPlaying()           -> pauses the song as soon as it starts (a tool window starts its song silent)
//   openToolWindow(tool, songId) -> opens the Metadata or Sync tool in its own window (Electron)
//   onToolWindowSong(callback)   -> a tool window is asked to show another song
//   metadataEditor()             -> { rendered, dirty }: is the engine's tag form drawn, and does it hold unsaved changes
//   engineConfirm(message)       -> the engine's own confirm box (it uses one for the same question)
//   engineAskDiscard(message)    -> Promise of true/false: the app's "Discard changes?" window for the tag editor
//   lyricsEditors()              -> { write, sync }: which of the engine's two lyrics editors is open
//   lyricsEditorDirty()          -> true when the Write editor's text differs from what it was opened with
//   watchLyricsEditors(callback) -> unsubscribe(); callback({ write, sync }) when an editor opens or closes

const engine = () => window;
const EVENTS = new Set(['view:changed', 'lyrics:changed', 'queue:indexChanged', 'songs:changed', 'favorites:changed', 'rightPanel:tabChanged', 'playback:stateChanged', 'history:added', 'playlist:listChanged', 'smartLyrics:progress', 'smartLyrics:changed', 'ratings:changed', 'ratingSettings:changed', 'duplicates:changed']);

export function nowPlaying() {
    const { currentQueueIndex: index, playbackQueue: queue } = engine();
    const item = index >= 0 && queue ? queue[index] : null;
    const song = item && (item.song || item);
    if (!song) return null;
    const text = (fn) => (typeof engine()[fn] === 'function' ? String(engine()[fn](song) || '').trim() : '');
    return { id: song.id, title: String(song.title || ''), artist: String(song.artist || ''), hasLyrics: text('getLyricsForSong') !== '', hasSynced: text('getSyncedLyricsForSong') !== '', instrumental: song.instrumental === true };
}

export const engineView = () => String(engine().currentView || '');

export function metadataEditor() {
    const save = document.getElementById('metadata-editor-save');
    return { rendered: Boolean(document.querySelector('#metadata-editor-content .metadata-editor-toolbar')), dirty: Boolean(save && !save.disabled) };
}

export const engineConfirm = (message) => engine().confirm(message);
// The app's own "Discard changes?" box for the tag editor: a Promise of true (discard) or false (keep editing).
export const engineAskDiscard = (message) => engine().askDiscardMetadata(message);
// The engine's own confirm dialog ("Discard Sync?") answers later, when the person clicks; this is true while it is on screen.
export const confirmDialogOpen = () => document.getElementById('confirm-ok-btn') !== null;

// The engine builds each editor once, appends it to <body> and shows it by adding the class `active`. It sends no event.
const open = (id) => document.getElementById(id)?.classList.contains('active') === true;
export const lyricsEditors = () => ({ write: open('lyrics-editor-overlay'), sync: open('sync-editor-overlay') });

export function lyricsEditorDirty() {
    const text = document.getElementById('lyrics-editor-textarea');
    return open('lyrics-editor-overlay') && text !== null && text.value !== text.defaultValue;
}

export function watchLyricsEditors(callback) {
    // Watch the two elements' class only (never the whole page), and <body>'s own children for the moment they are created.
    const seen = new Set();
    const classes = new MutationObserver(() => callback(lyricsEditors()));
    const attach = () => {
        for (const id of ['lyrics-editor-overlay', 'sync-editor-overlay']) {
            const node = document.getElementById(id);
            if (node && !seen.has(node)) {
                seen.add(node);
                classes.observe(node, { attributes: true, attributeFilter: ['class'] });
            }
        }
    };
    const created = new MutationObserver(() => {
        attach();
        callback(lyricsEditors());
    });
    created.observe(document.body, { childList: true });
    attach();
    return () => {
        classes.disconnect();
        created.disconnect();
    };
}

export function engineAction(name, ...args) {
    if (typeof engine()[name] !== 'function') return false;
    engine()[name](...args);
    return true;
}

export function engineEvent(name, callback) {
    if (!EVENTS.has(name)) return () => {};
    let off = () => {};
    let stopped = false;
    const attach = () => {
        if (!stopped) off = engine().on(name, (event) => callback(event.detail));
    };
    // The shell starts before the engine's modules have run, so `on` may not exist yet: subscribe when the page has loaded.
    if (typeof engine().on === 'function') attach();
    else window.addEventListener('load', attach, { once: true });
    return () => {
        stopped = true;
        off();
    };
}

export function engineCall(name, ...args) {
    return typeof engine()[name] === 'function' ? engine()[name](...args) : null;
}

export function librarySong(id) {
    const song = (engine().SONGS_DATA || []).find((s) => String(s.id) === String(id));
    return song ? { id: song.id } : null;
}

// The Sync editor's lyrics and files (views/tools/sync-editor.js through sync-bridge.js). A library song's saved synced versions, its plain
// lyrics, the engine's LRC reader, saving a new synced version (the active one); audio chosen in a dialog or dropped, read for their tags and never
// added to the library; the lyrics file dialogs; and stopping the player (the editor plays on its own audio).
const songData = (id) => (engine().SONGS_DATA || []).find((s) => s.id === id);
export function syncedVersions(id) {
    const entry = engineCall('getSyncedLyricsVariantsForSong', songData(id));
    return (entry?.variants || []).map((v) => ({ id: v.id, name: v.name, text: v.text, offset: v.offset || 0, active: v.id === entry.activeId }));
}
export const plainLyrics = (id) => String(engineCall('getLyricsForSong', songData(id)) || '');
export const parseLrc = (text) => engineCall('parseLRC', text);
export function saveSyncedVersion(id, lrc, offset) {
    const version = engineCall('addSyncedLyricsVariant', id, lrc, offset);
    if (!version) return null;
    engineCall('setActiveSyncedLyricsVariant', id, version.id);
    engineCall('emit', 'lyrics:changed', { songId: id });
    return { id: version.id, name: version.name };
}
export const pausePlayer = () => engine().audioElement?.pause();
const desktop = () => engine().electronAPI || {};
const without = (error) => Promise.resolve({ success: false, songs: [], error });
export const pickAudioFiles = () => (desktop().pickAudioFiles ? desktop().pickAudioFiles() : without('Choosing files is not available here'));
export function scanAudioFiles(files) {
    const paths = files.map((file) => (desktop().getPathForFile ? desktop().getPathForFile(file) : file.path)).filter(Boolean);
    return paths.length && desktop().scanAudioFiles ? desktop().scanAudioFiles(paths) : without('');
}
export const readLyricsFile = () => (desktop().readLyricsFile ? desktop().readLyricsFile() : Promise.resolve({ success: false }));
export const saveLyricsFile = (name, text) => (desktop().saveLyricsFile ? desktop().saveLyricsFile(name, text) : Promise.resolve({ success: false }));

export function pauseWhenPlaying() {
    const audio = engine().audioElement;
    if (audio) audio.addEventListener('playing', () => audio.pause(), { once: true });
}

export function openToolWindow(tool, songId) {
    const open = engine().electronAPI && engine().electronAPI.openToolWindow;
    return typeof open === 'function' ? open(tool, songId) : Promise.resolve({ ok: false, error: 'Tool windows are not available here' });
}

export function onToolWindowSong(callback) {
    const on = engine().electronAPI && engine().electronAPI.onToolWindowSong;
    if (typeof on === 'function') on(callback);
}
