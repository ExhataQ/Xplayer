// Library health: the list of checks and how they run. A check is
//   { id, group: 'copies' | 'tags' | 'files', title, hint, find(songs, ctx) -> [{ songId, note }], fixes: ['hide' | 'trash'], detail?: 'custom' }
// find() is pure, never touches the page and must be O(n): it runs over the whole library. Never call getArtists(), getAlbums() or
// SONGS_DATA.find per song in a check (that froze hiding a song on big libraries). A check with detail: 'custom' has a screen of its own.
import { findDuplicateGroups } from '../duplicates-core.js';
import { missingTitle, missingArtist, missingAlbum, noCover, fileNameAsTitle } from './checks/tags.js';
import { tinyFiles, lowQuality } from './checks/files.js';

export const GROUPS = [
    { id: 'copies', label: 'Copies' },
    { id: 'tags', label: 'Tags' },
    { id: 'files', label: 'Files' }
];

// One item per group of copies the finder lists by default (exact copies and the same song). The page behind the card does the rest.
export const duplicates = {
    id: 'duplicates',
    group: 'copies',
    title: 'Duplicate songs',
    hint: 'Copies of the same song: hide the extra ones or move them to the Recycle Bin.',
    detail: 'custom',
    fixes: [],
    find(songs, ctx) {
        const groups = findDuplicateGroups(songs, { ignored: new Set(ctx.notDuplicates || []) });
        return groups.filter((g) => g.confidence !== 'possible').map((g) => ({ songId: g.songIds[0], songIds: g.songIds, confidence: g.confidence, note: `${g.songIds.length} copies` }));
    }
};

export const CHECKS = [duplicates, missingTitle, missingArtist, missingAlbum, noCover, fileNameAsTitle, tinyFiles, lowQuality];

export const checkById = (id) => CHECKS.find((c) => c.id === id) || null;

const idle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Runs every check over `songs`, one after the other, giving the page a turn in between.
 * `onResult(check, items)` is called as each one finishes. Answers { done: false } when `isCancelled()` stopped it early.
 */
export async function runChecks(songs, ctx, onResult, isCancelled = () => false) {
    for (const check of CHECKS) {
        if (isCancelled()) return { done: false };
        await idle();
        let items = [];
        try {
            items = check.find(songs, ctx) || [];
        } catch (e) {
            items = [];
        }
        onResult(check, items);
    }
    return { done: true };
}
