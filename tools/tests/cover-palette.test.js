// src/ui-next/views/library/cover-palette.js: the colors a cover is mostly made of. Pure functions on made-up pixels.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE = pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'views', 'library', 'cover-palette.js')).href;

/** RGBA pixels for `parts`: [[r, g, b, count], ...] (alpha 255). */
function pixels(parts) {
    const out = [];
    for (const [r, g, b, count] of parts) for (let i = 0; i < count; i++) out.push(r, g, b, 255);
    return Uint8ClampedArray.from(out);
}
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(((actual - expected + 540) % 360) - 180) <= tolerance, `${label}: hue ${actual} is not within ${tolerance} of ${expected}`);

test('one color: the main color is that hue, and there is no second color', async () => {
    const { paletteFromPixels } = await import(MODULE);
    const palette = paletteFromPixels(pixels([[220, 40, 50, 900]])); // red
    assert.equal(palette.gray, false);
    near(palette.primary.h, 355, 12, 'red');
    assert.equal(palette.secondary, null);
});

test('two colors: the bigger one is the main color and the other the second', async () => {
    const { paletteFromPixels } = await import(MODULE);
    const palette = paletteFromPixels(pixels([[40, 160, 80, 600], [120, 50, 170, 400]])); // green, purple
    near(palette.primary.h, 140, 12, 'green main');
    near(palette.secondary.h, 275, 14, 'purple second');
});

test('a color with too few pixels is not a second color', async () => {
    const { paletteFromPixels } = await import(MODULE);
    const palette = paletteFromPixels(pixels([[40, 160, 80, 900], [120, 50, 170, 100]]));
    assert.equal(palette.secondary, null);
});

test('a vivid color beats a duller one that covers more of the picture', async () => {
    const { paletteFromPixels } = await import(MODULE);
    const palette = paletteFromPixels(pixels([[150, 120, 100, 700], [230, 30, 30, 500]])); // dull brown, vivid red
    near(palette.primary.h, 0, 14, 'vivid red');
});

test('one hue split across a slice edge counts once', async () => {
    const { paletteFromPixels } = await import(MODULE);
    const palette = paletteFromPixels(pixels([[230, 30, 90, 500], [230, 30, 30, 500]])); // 340 and 0 degrees
    near(palette.primary.h, 350, 12, 'red-pink');
    assert.equal(palette.secondary, null, 'not a second color');
});

test('grays, blacks and whites are not colors: a gray cover gives a neutral', async () => {
    const { paletteFromPixels, headerColors } = await import(MODULE);
    const palette = paletteFromPixels(pixels([[20, 20, 20, 400], [128, 128, 128, 300], [245, 245, 245, 300]]));
    assert.equal(palette.gray, true);
    assert.equal(palette.primary.s, 0);
    assert.deepEqual(headerColors(palette), { tint: `hsl(0 0% ${palette.primary.l}%)`, tint2: `hsl(0 0% ${palette.primary.l}%)` });
});

test('black with a small color accent: the accent is ignored below 5% of the picture and used above it', async () => {
    const { paletteFromPixels } = await import(MODULE);
    assert.equal(paletteFromPixels(pixels([[14, 14, 16, 970], [200, 30, 40, 30]])).gray, true);
    assert.equal(paletteFromPixels(pixels([[14, 14, 16, 900], [200, 30, 40, 100]])).gray, false);
});

test('a pastel cover still has a color', async () => {
    const { paletteFromPixels } = await import(MODULE);
    const palette = paletteFromPixels(pixels([[250, 190, 205, 800]]));
    assert.equal(palette.gray, false);
    near(palette.primary.h, 347, 10, 'pink');
});

test('transparent pixels are ignored; nothing visible gives null', async () => {
    const { paletteFromPixels } = await import(MODULE);
    assert.equal(paletteFromPixels(new Uint8ClampedArray(0)), null);
    assert.equal(paletteFromPixels(Uint8ClampedArray.from([200, 40, 40, 0, 200, 40, 40, 100])), null);
    const mixed = Uint8ClampedArray.from([...pixels([[40, 160, 80, 200]]), ...new Array(4 * 500).fill(0)]);
    assert.equal(paletteFromPixels(mixed).gray, false);
});

test('tint keeps a color usable: not too dark, not too bright, not washed out', async () => {
    const { tint } = await import(MODULE);
    const dark = tint({ h: 200, s: 0.9, l: 0.15 });
    const bright = tint({ h: 200, s: 0.2, l: 0.95 });
    assert.ok(dark.l >= 38 && dark.l <= 58 && bright.l >= 38 && bright.l <= 58);
    assert.ok(bright.s >= 45 && dark.s <= 85);
    assert.deepEqual(tint({ h: 359.6, s: 0.6, l: 0.5 }), { h: 0, s: 66, l: 50 }, 'hue wraps to 0..359');
});

test('headerColors: two colors as they are, one color turns 24 degrees for the second, nothing gives null', async () => {
    const { headerColors } = await import(MODULE);
    assert.equal(headerColors(null), null);
    assert.deepEqual(headerColors({ primary: { h: 140, s: 65, l: 40 }, secondary: { h: 275, s: 59, l: 44 }, gray: false }), { tint: 'hsl(140 65% 40%)', tint2: 'hsl(275 59% 44%)' });
    assert.deepEqual(headerColors({ primary: { h: 350, s: 70, l: 50 }, secondary: null, gray: false }), { tint: 'hsl(350 70% 50%)', tint2: 'hsl(14 70% 50%)' });
});

test('the result is the same for the same pixels (no randomness)', async () => {
    const { paletteFromPixels } = await import(MODULE);
    const data = pixels([[40, 160, 80, 300], [120, 50, 170, 200], [250, 140, 40, 150]]);
    assert.deepEqual(paletteFromPixels(data), paletteFromPixels(data));
});
