// Library health: the clean-ups that are safe to do for the person in one go. Both only HIDE (nothing is deleted, "Hidden" shows them again):
//   - exact copies: in every group of the same recording the best copy stays (the finder's ranking), the others are hidden;
//   - tiny files: files under 100 KB or 5 seconds.
// planAutoClean() only reads; applyAutoClean() does it, through the same bridge the duplicate finder uses (playlists and favourites that held a
// hidden copy get the kept song).
import { rankSongs } from '../duplicates-core.js';
import * as bridge from '../../../adapter/duplicates-bridge.js';

/** `results` is the Map of check id -> items the page holds, `songs` the live (not hidden) songs. Answers a list of { id, label, count, urls, moves }. */
export function planAutoClean(results, songs) {
    const byId = new Map(songs.map((s) => [s.id, s]));
    const plan = [];

    const exact = (results.get('duplicates') || []).filter((item) => item.confidence === 'same');
    if (exact.length) {
        const usage = bridge.usageOf(songs);
        const urls = [];
        const moves = [];
        for (const item of exact) {
            const ranked = rankSongs(item.songIds.map((id) => byId.get(id)).filter(Boolean), usage);
            if (ranked.length < 2) continue;
            const keeper = ranked[0].song.id;
            for (const { song } of ranked.slice(1)) {
                urls.push(song.url);
                moves.push({ from: song.id, to: keeper });
            }
        }
        if (urls.length) plan.push({ id: 'duplicates', label: 'Hide exact copies', count: urls.length, noun: ['copy', 'copies'], urls, moves });
    }

    const tiny = (results.get('tiny-files') || []).map((item) => byId.get(item.songId)).filter(Boolean);
    if (tiny.length) plan.push({ id: 'tiny-files', label: 'Hide tiny files', count: tiny.length, noun: ['file', 'files'], urls: tiny.map((s) => s.url), moves: [] });
    return plan;
}

/** Runs the steps. Answers how many songs were hidden. */
export function applyAutoClean(plan) {
    let hidden = 0;
    for (const step of plan) {
        if (step.moves.length) bridge.moveToKept(step.moves);
        bridge.hideSongs(step.urls);
        hidden += step.urls.length;
    }
    return hidden;
}
