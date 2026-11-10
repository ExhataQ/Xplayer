// The colors a cover is mostly made of, and the header tint they give (task: header colors for every list).
// Pure functions on pixels, no DOM, so a unit test can feed them made-up pixels. cover-tint.js gets the pixels and calls these.
//
// How it works, in four steps (kept simple on purpose, nothing here needs tuning per cover):
//   1. Look at every visible pixel as hue / saturation / lightness. Grays, near-black and near-white say nothing about "the color of a
//      cover", so a pixel counts only when it is clearly colored (CHROMA_MIN) and neither dark nor washed out.
//   2. A colored pixel votes for its hue (24 slices of 15 degrees). The vote is bigger for a pixel that is more saturated and closer
//      to a middle lightness, so a vivid red beats a dull brown that covers more of the picture.
//   3. The slice with the most votes (with its two neighbors, so one color split across a slice edge still counts once) is the main color.
//      The best slice that is at least 45 degrees away and has at least 40% of the main one's votes is the second color.
//   4. Each color is brought into the range a header can use: not so dark it vanishes, not so bright it glares (see tint()).
// A cover that is nearly all gray gives { gray: true }: the header then takes a quiet neutral instead of inventing a hue.

const SLICES = 24;
const SLICE_DEG = 360 / SLICES;
const CHROMA_MIN = 0.2; // saturation below this is a gray
const LIGHT_MIN = 0.12;
const LIGHT_MAX = 0.94; // pastel covers are light but still have a color
const COLORED_MIN_SHARE = 0.05; // less than this share of the visible pixels colored: the cover is gray
const SECOND_MIN_DISTANCE = 3; // slices (45 degrees)
const SECOND_MIN_SHARE = 0.4;

function toHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h;
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    return { h: (h * 60 + 360) % 360, s, l };
}

const sliceDistance = (a, b) => {
    const d = Math.abs(a - b) % SLICES;
    return Math.min(d, SLICES - d);
};

/** A slice and its two neighbors as one color: { weight, h, s, l } (hue is the circular mean, so 350 and 10 average to 0, not 180). */
function around(slices, index) {
    let weight = 0;
    let x = 0;
    let y = 0;
    let s = 0;
    let l = 0;
    for (const step of [-1, 0, 1]) {
        const slice = slices[(index + step + SLICES) % SLICES];
        weight += slice.weight;
        x += slice.x;
        y += slice.y;
        s += slice.s;
        l += slice.l;
    }
    if (!weight) return { weight: 0, h: 0, s: 0, l: 0 };
    return { weight, h: (Math.atan2(y, x) * 180) / Math.PI + (y < 0 ? 360 : 0), s: s / weight, l: l / weight };
}

/** Brings a color into the range a header tint can use. h in degrees, s and l in 0..1 -> whole degrees and percents. */
export function tint({ h, s, l }, gray = false) {
    if (gray) return { h: 0, s: 0, l: Math.round(Math.min(0.5, Math.max(0.3, l)) * 100) };
    return { h: Math.round(h) % 360, s: Math.round(Math.min(0.85, Math.max(0.45, s * 1.1)) * 100), l: Math.round(Math.min(0.58, Math.max(0.38, l)) * 100) };
}

/**
 * The main color and, when the cover has one, a second color, from RGBA pixels (a Uint8ClampedArray or any array of numbers).
 * Returns { primary, secondary, gray } with primary and secondary as { h, s, l } (degrees, percent, percent) ready for hsl(),
 * secondary null when the cover is one color; or null when there is nothing to read (no pixels, all transparent).
 */
export function paletteFromPixels(data) {
    const slices = Array.from({ length: SLICES }, () => ({ weight: 0, x: 0, y: 0, s: 0, l: 0 }));
    let visible = 0;
    let colored = 0;
    let lightSum = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        visible++;
        const { h, s, l } = toHsl(data[i], data[i + 1], data[i + 2]);
        lightSum += l;
        if (s < CHROMA_MIN || l < LIGHT_MIN || l > LIGHT_MAX) continue;
        colored++;
        const vote = s * (1 - Math.abs(2 * l - 1));
        const slice = slices[Math.floor(h / SLICE_DEG) % SLICES];
        const rad = (h * Math.PI) / 180;
        slice.weight += vote;
        slice.x += Math.cos(rad) * vote;
        slice.y += Math.sin(rad) * vote;
        slice.s += s * vote;
        slice.l += l * vote;
    }
    if (!visible) return null;
    if (colored / visible < COLORED_MIN_SHARE) return { primary: tint({ h: 0, s: 0, l: lightSum / visible }, true), secondary: null, gray: true };

    const scores = slices.map((_, index) => around(slices, index).weight);
    const best = scores.indexOf(Math.max(...scores));
    const primary = around(slices, best);
    let second = -1;
    for (let index = 0; index < SLICES; index++) {
        if (sliceDistance(index, best) < SECOND_MIN_DISTANCE || scores[index] < scores[best] * SECOND_MIN_SHARE) continue;
        if (second < 0 || scores[index] > scores[second]) second = index;
    }
    return { primary: tint(primary), secondary: second < 0 ? null : tint(around(slices, second)), gray: false };
}

const css = ({ h, s, l }) => `hsl(${h} ${s}% ${l}%)`;

/**
 * The header's two colors as CSS values: { tint, tint2 }. With one color the second is the same hue turned 24 degrees (the gradient
 * still has somewhere to go); a gray cover gives two grays.
 */
export function headerColors(palette) {
    if (!palette) return null;
    const { primary, secondary, gray } = palette;
    const other = secondary || (gray ? primary : { ...primary, h: (primary.h + 24) % 360 });
    return { tint: css(primary), tint2: css(other) };
}
