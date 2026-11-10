// Tests for the Liked Songs and All Songs page header: the helpers (src/ui-next/views/library/main-playlists.js), the two cover files,
// and that the header CSS for both lists exists and keeps to tokens. Pure Node.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const MODULE = pathToFileURL(path.join(SRC, 'ui-next', 'views', 'library', 'main-playlists.js')).href;

test('formatTotal: minutes, hours, days, and nothing for no time', async () => {
    const { formatTotal } = await import(MODULE);
    assert.equal(formatTotal(0), '');
    assert.equal(formatTotal(NaN), '');
    assert.equal(formatTotal(40), '< 1 min');
    assert.equal(formatTotal(60 * 42), '42 min');
    assert.equal(formatTotal(3600), '1 h');
    assert.equal(formatTotal(4980), '1 h 23 min');
    assert.equal(formatTotal(90000), '1 d 1 h');
    assert.equal(formatTotal(86400 * 2), '2 d');
});

test('statLine: only the main playlists get the total time, and only All Songs the artists', async () => {
    const { statLine } = await import(MODULE);
    const songs = [{ duration: 200 }, { duration: 400 }];
    assert.equal(statLine('favorites', songs), '2 songs \u00b7 10 min');
    assert.equal(statLine('all-songs', songs, 2), '2 songs \u00b7 10 min \u00b7 2 artists');
    assert.equal(statLine('all-songs', [{ duration: 61 }], 1), '1 song \u00b7 1 min \u00b7 1 artist');
    assert.equal(statLine('playlist', songs, 2), '2 songs', 'another list keeps the plain count');
    assert.equal(statLine('album', [], 0), '0 songs');
    assert.equal(statLine('favorites', []), '0 songs', 'no time to show for an empty list');
    assert.equal(statLine('all-songs', Array.from({ length: 1284 }, () => ({ duration: 0 })), 3), '1,284 songs \u00b7 3 artists');
});

test('tagline: the main playlists have one, an empty Liked Songs says how to fill it, other lists have none', async () => {
    const { tagline, MAIN_HUE } = await import(MODULE);
    assert.ok(tagline('favorites', 10));
    assert.ok(tagline('all-songs', 10));
    assert.match(tagline('favorites', 0), /Heart a song/);
    assert.equal(tagline('all-songs', 0), tagline('all-songs', 10), 'an empty library keeps its line');
    for (const kind of ['album', 'artist', 'playlist', 'history', 'recent', 'search-items']) assert.equal(tagline(kind, 5), '', kind);
    assert.equal(typeof MAIN_HUE.favorites, 'number');
});

test('the two covers are well-formed SVG with a square viewBox', () => {
    for (const name of ['default-cover-liked.svg', 'default-cover-all-songs.svg']) {
        const text = fs.readFileSync(path.join(SRC, 'assets', name), 'utf8');
        assert.match(text, /^<\?xml[^>]*\?>\s*<svg[^>]*viewBox="0 0 240 240"/, name);
        assert.match(text, /<\/svg>\s*$/, name);
        const ids = [...text.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
        assert.equal(new Set(ids).size, ids.length, `${name}: duplicate ids`);
        for (const ref of text.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref[1]), `${name}: url(#${ref[1]}) has no target`);
    }
});

test('song-list.css: every list with a cover gets the tinted header, Liked Songs is rose, All Songs follows the accent, no raw colors', () => {
    const css = fs.readFileSync(path.join(SRC, 'ui-next', 'views', 'library', 'song-list.css'), 'utf8');
    for (const kind of ['album', 'playlist', 'artist', 'favorites', 'all-songs']) {
        for (const part of ['::before', '::after', ' .songlist-bar__cover', ' .songlist-bar__label']) assert.ok(css.includes(`.songlist-bar[data-kind='${kind}']${part}`), `${kind}${part}`);
    }
    assert.match(css, /--hero-tint: hsl\(var\(--hero-hue\)/, 'the default tint comes from the list name');
    assert.match(css, /\[data-kind='favorites'\] \{\s*--hero-tint: hsl\(var\(--hero-hue\) 72%/, 'Liked Songs: the fixed rose');
    assert.match(css, /\[data-kind='all-songs'\] \{\s*--hero-tint: var\(--accent\)/, 'All Songs: the theme accent');
    assert.ok(css.includes(".songlist-bar[data-tint='pending']::before"), 'the gradient fades in for a cover read for the first time');
    assert.match(css, /data-motion='reduced'[^{]*\{[\s\S]*transition: none/, 'no fade for reduced motion');
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b(?![\w-])/);
    assert.doesNotMatch(css, /\brgba?\(/);
});

test('song-list.css: the hero gradient goes on through the column header, which has the panels\' color once stuck; the list has the main view\'s own color; no raw colors', () => {
    const css = fs.readFileSync(path.join(SRC, 'ui-next', 'views', 'library', 'song-list.css'), 'utf8');
    for (const rule of ['.songlist-hero-edge::after {', ".songlist-hero-edge[data-kind='favorites']::after", ".songlist-head[data-stuck='true'] {", ".songlist-head-edge[data-stuck='true'] {"]) assert.ok(css.includes(rule), rule);
    assert.equal((css.match(/inset: 0 0 calc\(-1 \* var\(--hero-extend, 0px\)\) (0|auto);/g) || []).length, 2, 'both layers (gradient and lines) are taller than the hero, by the header\'s height');
    assert.doesNotMatch(css, /songlist-wash|--hero-end/, 'no second gradient under the list');
    const stuck = css.slice(css.indexOf(".songlist-head[data-stuck='true'] {"), css.indexOf('.songlist-head-edge {'));
    assert.match(stuck, /background: var\(--head-stuck, var\(--list-ground\)\);/, 'stuck: --head-stuck, which falls back to the list\'s color');
    assert.doesNotMatch(stuck, /--hero-tint|color-mix|linear-gradient/, 'stuck: no tint (it is not yellow, or the cover\'s color)');
    assert.match(css, /--list-ground: var\(--surface-ground\);\s*(?:\/\*[\s\S]*?\*\/\s*)?--head-stuck: var\(--surface-panel\);\s*background: var\(--list-ground\);/, 'the list has the main view\'s own color, and the stuck header the panels\'');
    assert.equal((css.replace(/\/\*[\s\S]*?\*\//g, '').match(/var\(--surface-ground\)/g) || []).length, 1, 'the song views name the list color, and only the definition names the main view\'s');
    for (const kind of ['album', 'playlist', 'artist', 'favorites', 'all-songs']) assert.ok(css.includes(`.songlist-head[data-kind='${kind}']`), `${kind}: the header has no ground of its own at rest`);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b(?![\w-])/);
    assert.doesNotMatch(css, /\brgba?\(/);
});
