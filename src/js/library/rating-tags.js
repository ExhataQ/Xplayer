// ==============================================================================
// RATING IN THE FILE TAGS
// ==============================================================================
// While the Rating system and its switch "Write ratings into file tags" are on, a rating is also written into the song's file, where the
// format has a rating field the app can write (today: MP3, WAV and AIFF, as an ID3 popularimeter; see RATING_TAG_KINDS in rating-rules.js). The
// app keeps its own copy as well, so the other formats lose nothing. The write is the tag editor's own: a copy of the file first, written, read back
// and checked, and put back if anything differs (electron/tag-node-backend.js). A run of clicks on one song makes one write, 2 seconds after the
// last. A write that fails never loses the rating (the app has it); the person is told once.

const WAIT_MS = 2000;
const CHUNK = 100;
const timers = new Map(); // file url -> timer
const wanted = new Map(); // file url -> stars to write
let told = false;

/** Is writing into the files on (the system on and the switch on)? */
export function ratingTagsOn() {
    const settings = getRatingSettings();
    return settings.enabled && settings.writeTags;
}

const isLocalFile = (song) => Boolean(song) && typeof song.url === 'string' && song.url.startsWith('file:');
export const canWriteRatingTag = (song) => isLocalFile(song) && RATING_TAG_KINDS.includes(tagKindOf(song.url));

function tellOnce(why) {
    if (told) return;
    told = true;
    showNotification(`A rating could not be saved into its file (${why}). It is kept in the app.`, 'warning', 5000);
}

// What the file now says is what a scan would say: the same text, so the tag fallback never disagrees with the app's own copy.
function remember(url, text) {
    for (const song of SONGS_DATA) if (song.url === url) song.rating = text;
}

async function flush(url) {
    timers.delete(url);
    const stars = wanted.get(url);
    wanted.delete(url);
    if (stars === undefined || typeof desktopApi === 'undefined' || !desktopApi.metadata || !desktopApi.metadata.saveAudioMetadata) return;
    try {
        const result = await desktopApi.metadata.saveAudioMetadata({ fileUrl: url, metadata: { ratingStars: stars ? String(stars) : '' }, coverPath: '' });
        if (!result || !result.success) throw new Error(result && result.error ? result.error : 'the file could not be written');
        if (result.metadata && typeof result.metadata.rating === 'string') remember(url, result.metadata.rating);
    } catch (error) {
        tellOnce(String((error && error.message) || error).slice(0, 300));
    }
}

/** Asks for the rating of a song to be written into its file soon. Answers true when a write is waiting. */
export function queueRatingTagWrite(songId, stars) {
    if (!ratingTagsOn()) return false;
    const song = SONGS_DATA.find((s) => s.id === songId);
    if (!canWriteRatingTag(song)) return false;
    wanted.set(song.url, normalizeRating(stars));
    clearTimeout(timers.get(song.url));
    timers.set(song.url, setTimeout(() => flush(song.url), WAIT_MS));
    return true;
}

/**
 * Writes every saved rating into its file now (for ratings given before the switch was on). Only songs that have a rating of their own
 * and a file this can write. Goes 100 files at a time and says how far it is. Answers { written, failed, skipped }.
 */
export async function writeAllRatingsToTags() {
    const saved = getRatings();
    const songs = SONGS_DATA.filter((song) => saved[String(song.id)] && canWriteRatingTag(song));
    const out = { written: 0, failed: 0, skipped: 0 };
    if (!songs.length || typeof desktopApi === 'undefined' || !desktopApi.metadata || !desktopApi.metadata.saveAudioMetadataMany) return out;
    for (let i = 0; i < songs.length; i += CHUNK) {
        const part = songs.slice(i, i + CHUNK);
        const response = await desktopApi.metadata.saveAudioMetadataMany(part.map((song) => ({ fileUrl: song.url, metadata: { ratingStars: String(saved[String(song.id)]) } })));
        const results = response && response.success && Array.isArray(response.results) ? response.results : [];
        part.forEach((song, k) => {
            const r = results[k];
            if (r && r.success && !(r.skipped && r.skipped.includes('ratingStars'))) {
                out.written++;
                if (r.metadata && typeof r.metadata.rating === 'string') remember(song.url, r.metadata.rating);
            } else if (r && r.success) out.skipped++;
            else out.failed++;
        });
        showNotification(`Writing ratings into the files: ${Math.min(i + CHUNK, songs.length)} of ${songs.length}`, 'info', 1500);
    }
    showNotification(`Ratings written into ${out.written} ${out.written === 1 ? 'file' : 'files'}${out.failed ? `, ${out.failed} could not be written` : ''}.`, out.failed ? 'warning' : 'success', 4000);
    return out;
}

if (typeof on === 'function' && typeof document !== 'undefined') {
    on('ratings:changed', (event) => event && event.detail && queueRatingTagWrite(event.detail.songId, event.detail.rating));
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ ratingTagsOn, canWriteRatingTag, queueRatingTagWrite, writeAllRatingsToTags });
}
