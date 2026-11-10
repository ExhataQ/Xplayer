// The Home hero's pure parts: the time text, and the glow colour taken from the cover. Plain Node tests: tools/tests/ui-next-home-hero.test.js.

/** 62 -> "1:02", 3725 -> "1:02:05". */
export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** The share of the song that is done, 0 to 1 (0 when the length is not known). */
export function progressShare(position, duration) {
    const d = Number(duration);
    return d > 0 ? Math.min(1, Math.max(0, Number(position) / d)) : 0;
}

/**
 * The cover's colour for the glow: the average of the pixels that are neither almost black nor almost white nor grey, weighted by how
 * colourful they are, as [r, g, b]. null when nothing in it has any colour (the hero then uses the accent). `data` is RGBA, as getImageData gives.
 */
export function glowFromPixels(data) {
    let r = 0;
    let g = 0;
    let b = 0;
    let weight = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        const chroma = max - min;
        if (max < 40 || chroma < 24) continue;
        r += data[i] * chroma;
        g += data[i + 1] * chroma;
        b += data[i + 2] * chroma;
        weight += chroma;
    }
    return weight ? [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight)] : null;
}

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
