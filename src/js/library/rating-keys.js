// ==============================================================================
// RATING WITH THE KEYBOARD
// ==============================================================================
// While the Rating system is on: the keys 1 to 5 rate the selected songs (or the song that is playing, when none is selected), Shift and a number is the
// half star below it (Shift+3 is 2.5 stars), and 0 removes the rating. The stars in the song list are for the mouse; this is how the list is rated from
// the keyboard, with no extra tab stop in every row. Nothing happens while the person is typing, or a dialog or editor is open.

/** The rating a key press means: 1 to 5, 0.5 to 4.5 with Shift, 0 to remove; null for any other press (Ctrl, Alt and Meta are other shortcuts). */
export function ratingForKey(event) {
    if (!event || event.ctrlKey || event.metaKey || event.altKey) return null;
    const m = /^(?:Digit|Numpad)([0-5])$/.exec(String(event.code || ''));
    if (!m) return null;
    const n = Number(m[1]);
    if (!event.shiftKey) return n;
    return n === 0 ? null : n - 0.5;
}

/** The ids the keys act on: the selected songs, else the song that is playing. */
export function songsToRate() {
    const selected = typeof selectedSongIds !== 'undefined' ? [...selectedSongIds] : [];
    if (selected.length) return selected;
    const item = typeof playbackQueue !== 'undefined' && typeof currentQueueIndex === 'number' && currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
    const song = item && (item.song || item);
    return song ? [song.id] : [];
}

const TYPING = 'input, textarea, select, [contenteditable], [contenteditable="true"]';
const OPEN_DIALOG = 'dialog[open], .sync-editor-overlay.active, .lyrics-editor-overlay.active, .extended-info-overlay.active, [role="menu"]';

function onKeyDown(event) {
    if (event.defaultPrevented || event.repeat) return;
    const stars = ratingForKey(event);
    if (stars === null || typeof isRatingSystemOn !== 'function' || !isRatingSystemOn()) return;
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest(TYPING)) return;
    if (document.querySelector(OPEN_DIALOG)) return;
    const ids = songsToRate();
    if (!ids.length) return;
    event.preventDefault();
    ids.forEach((id) => setRating(id, stars));
    const song = ids.length === 1 ? SONGS_DATA.find((s) => s.id === ids[0]) : null;
    const what = song ? `"${song.title}"` : `${ids.length} songs`;
    showNotification(stars ? `Rated ${what} ${ratingLabel(stars)}` : `Removed the rating of ${what}`, 'success', 1500);
}

if (typeof document !== 'undefined') document.addEventListener('keydown', onKeyDown);

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ ratingForKey, songsToRate });
}
