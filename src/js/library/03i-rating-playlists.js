// ==============================================================================
// RATING PLAYLISTS (task B3): Top rated and Not rated
// ==============================================================================
// Two real playlists kept up to date by the rating system: "Top rated" (4 stars and up, best first) and "Not rated" (no rating). They are
// ordinary playlists in every way that matters (they show on Home and in the left panel, play with their own queue, sort, pin), but they
// carry `smart` and are not the person's to edit: songs cannot be added, removed or dropped in, and they cannot be deleted by hand. They
// exist only while the Rating system is on (turning it off removes them), and a playlist is created when it would hold a song.
// What they hold is decided by the pure rules in library/rating-rules.js (planRatingPlaylists); this file reads the playlists and the
// ratings, saves, and tells the lists to draw again.

/** Makes the two playlists match the ratings now. Answers true when something was saved. */
export function refreshRatingPlaylists() {
    if (typeof SONGS_DATA === 'undefined') return false;
    const enabled = isRatingSystemOn();
    const stars = enabled ? ratingsForSongIds(SONGS_DATA.map((song) => song.id)) : [];
    const byId = new Map(SONGS_DATA.map((song, i) => [song.id, stars[i] || 0]));
    const plan = planRatingPlaylists({
        enabled,
        playlists: getPlaylists(),
        songs: SONGS_DATA,
        ratingOf: (song) => byId.get(song.id) || 0,
        makeId: () => generateLongId('p'),
        now: new Date().toLocaleString()
    });
    if (!plan.changed) return false;
    // A list that is going away while it is open: go to All songs first, as deleting a playlist does.
    if (typeof currentView === 'string' && plan.removed.some((id) => currentView === `playlist-${id}`)) switchView(VIEWS.ALL_SONGS);
    savePlaylists(plan.playlists);
    plan.removed.forEach((id) => removeItemFromAllFolders(id, 'playlist'));
    emit('playlist:listChanged');
    // The one that is open must show its new songs (a row you rated may have left Top rated), or the rows and the clicks would disagree.
    for (const id of plan.touched) {
        const songs = (plan.playlists.find((p) => p.id === id) || { songs: [] }).songs;
        emit('playlist:songCountChanged', { playlistId: id, count: songs.length });
        if (currentView === `playlist-${id}` && typeof refreshCurrentViewAfterMutation === 'function') refreshCurrentViewAfterMutation();
    }
    return true;
}

// A rating changes often (a click per song): the playlists follow a moment later, once. Turning the system on or off follows at once.
let timer = 0;
export function refreshRatingPlaylistsSoon() {
    clearTimeout(timer);
    timer = setTimeout(refreshRatingPlaylists, 600);
}

if (typeof on === 'function' && typeof document !== 'undefined') {
    on('ratings:changed', refreshRatingPlaylistsSoon);
    on('ratingSettings:changed', refreshRatingPlaylists);
    on('library:rebuilt', refreshRatingPlaylistsSoon);
    on('data:imported', refreshRatingPlaylistsSoon);
    document.addEventListener('DOMContentLoaded', () => setTimeout(refreshRatingPlaylists, 0)); // the library is there; set them right at start
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ refreshRatingPlaylists, refreshRatingPlaylistsSoon });
}
