// The header colors of a cover, with a memory: a cover is read once, the answer is kept (also "no colors", so an unreadable cover is not retried
// every time the list repaints). cover-palette.js does the thinking, cover-pixels.js gets the pixels.

import { coverPixels } from './cover-pixels.js';
import { paletteFromPixels, headerColors } from './cover-palette.js';

const KEEP = 300;
const answers = new Map(); // url -> { tint, tint2 } or null (nothing to read)
const asking = new Map(); // url -> Promise, so two repaints share one read

/** The answer for `url` when it is already known: { tint, tint2 }, null (known to have none) or undefined (not asked yet). */
export const knownTint = (url) => answers.get(url);

/** { tint, tint2 } (CSS colors) for the cover at `url`, or null when it has none to give. */
export function tintFor(url) {
    if (!url) return Promise.resolve(null);
    if (answers.has(url)) return Promise.resolve(answers.get(url));
    if (!asking.has(url)) {
        asking.set(
            url,
            coverPixels(url)
                .then((pixels) => (pixels ? headerColors(paletteFromPixels(pixels)) : null))
                .catch(() => null)
                .then((colors) => {
                    if (answers.size >= KEEP) answers.delete(answers.keys().next().value);
                    answers.set(url, colors);
                    asking.delete(url);
                    return colors;
                })
        );
    }
    return asking.get(url);
}
