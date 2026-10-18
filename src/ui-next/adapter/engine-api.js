// engine-api: the part of the adapter API (A-04c) that the Lyrics view needs. Written by agent D for task D-01 with the owner's
// permission; A may fold it into store, actions and events (decision D18 counts it with engine-view.js).
//
// Views never read engine globals themselves (gate 13). They ask here:
//   nowPlaying()                 -> { id, title, artist, hasLyrics, hasSynced, instrumental } | null
//   engineView()                 -> the engine's current view name ('lyrics', 'online-lyrics', ...)
//   engineAction(name, ...args)  -> calls an engine function by name; false when it does not exist
//   engineEvent(name, callback)  -> unsubscribe(); only the allow-listed events, callback gets the payload
//   metadataEditor()             -> { rendered, dirty }: is the engine's tag form drawn, and does it hold unsaved changes
//   engineConfirm(message)       -> the engine's own confirm box (it uses one for the same question)

const engine = () => window;
const EVENTS = new Set(['view:changed', 'lyrics:changed', 'queue:indexChanged', 'rightPanel:tabChanged']);

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
