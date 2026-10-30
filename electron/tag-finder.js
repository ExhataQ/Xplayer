'use strict';

// The multi tag finder, core (task PD-05). No screen, no IPC, no files: it takes the songs, asks MusicBrainz (through two injected
// functions), and says for every song what it found and how sure it is. What happens to the answer (stage it in the tag sheet, queue it
// for review, write it) is the caller's decision and is not made here, so nothing in this file can write a tag.
//
// Per song:  search releases -> pick one (electron/release-rank.js) -> fetch that release's tags -> compare with the song's tags.
//   decision 'auto'       sure enough to offer without asking (confidence >= autoThreshold, default 0.85)
//   decision 'review'     plausible, needs a person (0.5 up to the threshold)
//   decision 'none'       nothing usable: no title, no release found, or too unsure
//   decision 'unchanged'  found, but the file already says the same
//   decision 'error'      this song failed (network, no matching track); the run goes on
//
// `patch` holds only the tags that would change and never an empty value, so applying it cannot erase a tag. `changes` has before and
// after for the review table. Title and artist are the question being asked, so they are never part of the answer.
//
// MusicBrainz allows about one request a second; electron/online-metadata.js already spaces its requests, so songs are handled one at a
// time and a long list is slow on purpose (about three requests, a few seconds, per song).

const { pickRelease, AUTO_THRESHOLD } = require('./release-rank');

const DEFAULT_FIELDS = ['album', 'albumArtist', 'year', 'genre', 'label', 'musicBrainzTrackId', 'musicBrainzAlbumId', 'musicBrainzOriginalAlbumId'];
const MULTI_VALUE = new Set(['artist', 'albumArtist', 'genre', 'composer', 'conductor', 'remixer']); // ";" separates values; a comma never does
const MAX_CONSECUTIVE_ERRORS = 5; // a dead connection must not spend minutes of retries on every remaining song

const text = (value) => String(value ?? '').trim();

/** A tag value as a clean list: arrays as they are, text split on ";" for multi-value tags, empty parts dropped. */
function toList(field, value) {
    const parts = Array.isArray(value) ? value : MULTI_VALUE.has(field) ? text(value).split(';') : [value];
    return parts.map(text).filter(Boolean);
}

// Multi-value tags are compared as sets: the same genres in another order are not a change worth rewriting a file for.
const sameValue = (field, a, b) => {
    const key = (list) => list.map((item) => item.toLowerCase()).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    const left = MULTI_VALUE.has(field) ? key(a) : a.map((item) => item.toLowerCase());
    const right = MULTI_VALUE.has(field) ? key(b) : b.map((item) => item.toLowerCase());
    return left.length === right.length && left.every((item, i) => item === right[i]);
};

/** What would change if `found` were applied to a song whose tags are `current`. Never proposes an empty value. */
function compareTags(current = {}, found = {}, fields = DEFAULT_FIELDS) {
    const patch = {};
    const changes = {};
    for (const field of fields) {
        const next = toList(field, found[field]);
        if (next.length === 0) continue;
        const before = toList(field, current[field]);
        if (sameValue(field, before, next)) continue;
        const multi = MULTI_VALUE.has(field);
        patch[field] = multi ? next : next[0];
        changes[field] = { from: multi ? before : before[0] || '', to: patch[field] };
    }
    return { patch, changes };
}

const asSong = (song) => {
    const tags = song.tags || song;
    const artists = toList('artist', tags.artist);
    return { id: song.id ?? null, fileUrl: song.fileUrl || song.url || '', tags, title: text(tags.title), artist: artists[0] || '', album: text(tags.album), duration: Number(tags.duration) || undefined };
};

/**
 * deps: { search(query) -> { success, results }, getMetadata({ fileUrl, releaseId, title, skipCover }) -> { success, metadata } }
 * (electron/online-metadata.js searchOnlineMetadata and getOnlineMetadata). Without deps the real ones are used.
 */
function createTagFinder(deps = {}) {
    const lazy = () => require('./online-metadata');
    const search = deps.search || ((query) => lazy().searchOnlineMetadata(query));
    const getMetadata = deps.getMetadata || ((query) => lazy().getOnlineMetadata(query));
    const getPopularity = deps.getPopularity || ((ids) => require('./popularity').fetchPopularity(ids));

    async function findOne(input, { rule = 'original', autoThreshold = AUTO_THRESHOLD, popularity = null, fields = DEFAULT_FIELDS } = {}) {
        const song = asSong(input);
        const base = { id: song.id, fileUrl: song.fileUrl };
        if (!song.title) return { ...base, decision: 'none', confidence: 0, reasons: ['the song has no title'], release: null, patch: {}, changes: {} };

        const found = await search({ fileUrl: song.fileUrl, title: song.title, artist: song.artist, album: song.album, duration: song.duration, scope: 'release' });
        const candidates = (found && found.results) || [];
        // "Most popular" needs listener counts; without them (offline, nothing known) the answer is the original release, and says so.
        const scores = rule === 'popular' && !popularity ? await getPopularity(candidates.map((candidate) => candidate.releaseGroupId)) : popularity;
        const pick = pickRelease(candidates, { file: { title: song.title, album: song.album }, rule, popularity: scores, autoThreshold });
        if (rule === 'popular' && !(scores && Object.keys(scores).length) && pick.best) pick.reasons = [...pick.reasons, 'no popularity data, used the original rule'];
        if (pick.decision === 'none' || !pick.best) return { ...base, decision: 'none', confidence: pick.confidence, reasons: pick.reasons, release: null, patch: {}, changes: {} };

        const release = { id: pick.best.id, title: pick.best.title, date: pick.best.date, releaseGroupId: pick.best.releaseGroupId };
        const loaded = await getMetadata({ fileUrl: song.fileUrl, releaseId: release.id, title: song.title, skipCover: true });
        const { patch, changes } = compareTags(song.tags, (loaded && loaded.metadata) || {}, fields);
        const decision = Object.keys(patch).length === 0 ? 'unchanged' : pick.decision;
        return { ...base, decision, confidence: pick.confidence, reasons: pick.reasons, release, patch, changes };
    }

    /**
     * Songs one at a time, in order. options: { rule, autoThreshold, popularity, fields, onProgress({ done, total, song, result }),
     * shouldCancel() -> boolean, maxConsecutiveErrors }. Returns { results, summary, cancelled, stopped } where `stopped` is null, 'fatal'
     * (an error retrying cannot fix) or 'offline' (too many failures in a row) and `message` says why.
     */
    async function findMany(songs, options = {}) {
        const list = Array.isArray(songs) ? songs : [];
        const limit = options.maxConsecutiveErrors ?? MAX_CONSECUTIVE_ERRORS;
        const results = [];
        const summary = { total: list.length, processed: 0, auto: 0, review: 0, none: 0, unchanged: 0, error: 0 };
        let cancelled = false;
        let stopped = null;
        let message = '';
        let inARow = 0;

        for (const input of list) {
            if (options.shouldCancel && options.shouldCancel()) {
                cancelled = true;
                break;
            }
            const song = asSong(input);
            let result;
            try {
                result = await findOne(input, options);
                inARow = 0;
            } catch (error) {
                inARow += 1;
                result = { id: song.id, fileUrl: song.fileUrl, decision: 'error', confidence: 0, reasons: [], release: null, patch: {}, changes: {}, error: (error && error.message) || 'unknown error' };
                if (error && error.fatal) {
                    stopped = 'fatal';
                    message = result.error;
                } else if (inARow >= limit) {
                    stopped = 'offline';
                    message = `${inARow} songs in a row failed: ${result.error}`;
                }
            }
            results.push(result);
            summary.processed += 1;
            summary[result.decision] += 1;
            if (options.onProgress) options.onProgress({ done: summary.processed, total: list.length, song: input, result });
            if (stopped) break;
        }
        return { results, summary, cancelled, stopped, message };
    }

    return { findOne, findMany };
}

module.exports = { createTagFinder, compareTags, DEFAULT_FIELDS, MAX_CONSECUTIVE_ERRORS };
