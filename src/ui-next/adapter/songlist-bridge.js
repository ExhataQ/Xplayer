// songlist-bridge (task B-03): the one place the song list touches the engine. Views outside adapter/ must not read engine
// globals (register L-01); this file gives the song list module three things: which engine views show song rows, a way to
// hear when the view changes, and the seam that changes the row height (ui/05a setSongItemHeight).
// Small and early; A may fold it into the A-04c surface together with library-bridge.js.

const engine = () => window;

/** True for the engine views that draw .song-item rows: all songs, favorites, history, recent, search results, a playlist,
 *  an album or an artist (the last two have 13-character ids starting with a or r; ui/07-views getCurrentViewLabel). */
export function isSongView(view) {
    if (typeof view !== 'string') return false;
    if (['all-songs', 'favorites', 'history', 'recent', 'search-items'].includes(view)) return true;
    if (view.startsWith('playlist-')) return true;
    return view.length === 13 && (view[0] === 'a' || view[0] === 'r');
}

/** The engine's current view name, or '' before the engine has loaded. */
export const currentSongView = () => String(engine().currentView || '');

export const viewsReady = () => typeof engine().switchView === 'function';

/** Runs `callback` once the engine can switch views (it loads after the shell, see index.html). */
export function whenViewsReady(callback) {
    const check = () => (typeof engine().switchView === 'function' ? callback() : requestAnimationFrame(check));
    check();
}

/** Calls `callback(view)` each time the engine's current view changes. Returns an unsubscribe function. */
export function onSongViewChange(callback) {
    if (typeof engine().on !== 'function') return () => {};
    return engine().on('view:changed', (event) => callback(event.detail.view));
}

/** Tells the engine's virtual scroll the new row height in pixels, after the CSS variable was changed. */
export function setRowHeight(px) {
    if (typeof engine().setSongItemHeight === 'function') engine().setSongItemHeight(px);
}

/** Tells the engine's virtual scroll the library panel's new row height in pixels, after the CSS variable was changed (D61). */
export function setPanelRowHeight(px) {
    if (typeof engine().setLeftItemHeight === 'function') engine().setLeftItemHeight(px);
}

/** The engine's song list element inside `host`, or null. */
export const listElement = (host) => host.querySelector('#song-list');

/** The engine's name for the list on screen ("All Songs", a playlist name ...). It is written into a heading in the list. */
export const listTitle = (host) => (host.querySelector('#hero-title') || {}).textContent || '';

/** Calls `callback` when the engine rewrites that heading. Returns an unsubscribe function. */
export function onListTitleChange(host, callback) {
    const heading = host.querySelector('#hero-title');
    if (!heading) return () => {};
    const observer = new MutationObserver(callback);
    observer.observe(heading, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
}

/** How many songs the current view lists. */
export function listSongCount(view) {
    try {
        return engine().getSongsForList(view).length;
    } catch (_) {
        return 0;
    }
}
