// listbar-bridge (task B-05): what the list toolbar (play, shuffle, find in list, more) needs from the engine. These are the
// engine's old sub-header actions (ui/07-views, playback/10d, search/08h); the new toolbar calls them instead of rebuilding them.

const engine = () => window;

/** 'album', 'artist', 'history', 'favorites', 'all-songs' or 'playlist': what kind of list a song view is. */
export function listKind(view) {
    if (['all-songs', 'favorites', 'history', 'recent', 'search-items'].includes(view)) return view;
    return view.length === 13 && view[0] === 'a' ? 'album' : view.length === 13 && view[0] === 'r' ? 'artist' : 'playlist';
}

export const isListPlaying = () => typeof engine().isCurrentViewPlaying === 'function' && Boolean(engine().isCurrentViewPlaying());
export const isShuffleOn = () => Boolean(engine().isShuffled);
export const togglePlayAll = () => engine().togglePlayAllFromCurrentView();
export const toggleShuffle = () => engine().toggleShuffleFromSubhero();
/** The engine's own menu for this list (pin, clear history ...), opened at the click. */
export const showListMenu = (event) => engine().showSubheroContextMenu(event);

/** Filters the list on screen by `text` (empty shows all). The engine reads a hidden input, which is created on first use. */
export function findInList(text) {
    let box = document.getElementById('subhero-search-input');
    if (!box) {
        box = Object.assign(document.createElement('input'), { id: 'subhero-search-input', tabIndex: -1 });
        document.querySelector('[data-legacy-slot="host"]').append(box);
    }
    box.value = text;
    engine().performSubheroSearch();
}

/** Calls `callback` when playback starts or stops or shuffle changes. Returns an unsubscribe function. */
export function onListStateChange(callback) {
    const audio = document.getElementById('audio');
    const events = ['play', 'pause', 'ended', 'emptied'];
    for (const name of events) audio?.addEventListener(name, callback);
    const stop = typeof engine().on === 'function' ? engine().on('shuffle:changed', callback) : () => {};
    return () => {
        for (const name of events) audio?.removeEventListener(name, callback);
        stop();
    };
}

/** A copy of the cover the engine shows for this list (an image or one of its built-in drawings), or null. Ids are removed. */
export function listCover(host) {
    // An empty drawing (the engine's built-in drawing for a list with no art has no paths) counts as no cover: the caller shows the default cover.
    const shown = [...host.querySelectorAll('.playlist-hero-cover > *')].find((node) => node.style.display === 'block' && (node.tagName !== 'IMG' || node.getAttribute('src')) && (node.tagName !== 'svg' && node.tagName !== 'SVG' || node.childElementCount));
    if (!shown) return null;
    const copy = shown.cloneNode(true);
    for (const node of [copy, ...copy.querySelectorAll('[id]')]) node.removeAttribute('id');
    copy.removeAttribute('style');
    return copy;
}

/** Calls `callback` when the engine changes that cover. Returns an unsubscribe function. */
export function onListCoverChange(host, callback) {
    const cover = host.querySelector('.playlist-hero-cover');
    if (!cover) return () => {};
    const observer = new MutationObserver(callback);
    observer.observe(cover, { attributes: true, attributeFilter: ['src', 'style', 'class'], subtree: true });
    return () => observer.disconnect();
}
