// The pure part of Home: which items the quick-pick tiles show. Plain Node test: tools/tests/interface/ui-next-home.test.js.

/**
 * The quick picks (design board A's grid of small tiles): up to `limit` playlists and albums, the ones the person played first, alternating
 * playlist, album, playlist ... so the grid is a mix. If fewer than `limit` were played, the rest are filled from the unplayed ones the same way.
 */
export function pickQuickItems({ playlists = [], albums = [] }, limit = 8) {
    const mix = (a, b) => {
        const out = [];
        for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(...[a[i], b[i]].filter(Boolean));
        return out;
    };
    const played = mix(playlists.filter((i) => i.played), albums.filter((i) => i.played));
    const rest = mix(playlists.filter((i) => !i.played), albums.filter((i) => !i.played));
    return [...played, ...rest].slice(0, limit);
}
