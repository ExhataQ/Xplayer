// Which row of the left panel is "selected": one rule for the Library, Search and Recents lists. A row is selected when it stands for what the
// main view shows right now, and for nothing else. The shell tells us after every change of view (setPanelActive), so a row does not stay lit
// when the main view moves on to Home, Settings, Sync or Metadata, and the playlist, album, artist and song rows of Search and Recents light
// up the same way the Library's do.
//
//   Library rows (the engine's .left-panel-main-item)  -> class "active", when their data-view is the page the Library shows
//   Search / Recents rows (.plist-row)                  -> aria-current="page", styled in panel-lists.css
//                                                          data-page: a playlist's view id, or an album's or artist's id
//                                                          data-song: a song's id, lit while that song's own page is shown

const state = { page: null, song: null };

/** Lights the rows of `root` that match the current state and puts the others out. */
export function markPanelRows(root = document) {
    for (const row of root.querySelectorAll('.plist-row[data-page], .plist-row[data-song]')) {
        const on = (row.dataset.page && row.dataset.page === state.page) || (row.dataset.song && row.dataset.song === state.song);
        if (on) row.setAttribute('aria-current', 'page');
        else row.removeAttribute('aria-current');
    }
    // The engine puts "active" on a Library row when it opens that page and never takes it off when the main view changes to a view that is
    // not a list (Home, Settings, Sync, Metadata): so the class follows the state here, not the engine's last write.
    for (const item of root.querySelectorAll('.left-panel-main-item')) item.classList.toggle('active', Boolean(state.page) && item.dataset.view === state.page);
}

/**
 * `page`: the engine page the Library view shows (a playlist's "playlist-<id>", an album's or artist's id, "all-songs"), or null when the main
 * view is anything else. `song`: the id of the song whose page is shown, or null.
 */
export function setPanelActive({ page = null, song = null } = {}) {
    state.page = page;
    state.song = song;
    markPanelRows(document);
}

/** Keeps the marks right when a panel draws its rows again (the lists repaint on every search, new play and change of the library). */
export function installPanelActive(host) {
    let queued = false;
    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
            queued = false;
            markPanelRows(host);
        });
    }).observe(host, { childList: true, subtree: true }); // childList only: our own class and attribute changes do not call this again
}
