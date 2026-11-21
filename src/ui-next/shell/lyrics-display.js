// How the right panel (and its full-size mode) shows a song that has a translation: the original with its translation under each line
// (both), the translation alone (the original is hidden), or the original alone. The choice is kept between runs. The panel draws it;
// the one button in its header (views/ai/lyrics-bar.js) changes it.
//
//   MODES                      both, translated, original
//   nextMode(mode)             the one a click on the button moves to: both, then translated, then original, then both again
//   pairLines(original, translated)   the timed lines of the original, each with the translated line of the same moment
//   displayChoice() / setMode(id) / onDisplayChange(callback)

export const MODES = ['both', 'translated', 'original'];
export const nextMode = (mode) => MODES[(MODES.indexOf(mode) + 1) % MODES.length];

const KEY = 'xplayer.lyrics.display';
const listeners = new Set();
let choice = null;

const valid = (value) => ({ mode: MODES.includes(value?.mode) ? value.mode : 'both' });

export function displayChoice() {
    if (!choice) {
        try {
            choice = valid(JSON.parse(localStorage.getItem(KEY) || 'null'));
        } catch (error) {
            choice = valid(null);
        }
    }
    return choice;
}

export function setMode(mode) {
    const next = valid({ mode });
    if (next.mode === displayChoice().mode) return;
    choice = next;
    try {
        localStorage.setItem(KEY, JSON.stringify(choice));
    } catch (error) {
        // not saved: the choice still holds for this run
    }
    listeners.forEach((callback) => callback(choice));
}

export function onDisplayChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

const SAME_MOMENT = 0.35; // seconds: a translated line this close to an original line belongs to it

/**
 * original, translated: parsed LRC entries { time, text, instrumental }. Returns the original's lines, each with `translation`
 * (the translated line at the same moment, or '' when there is none). Lines are matched by time; when the two lists have the
 * same length and a line has no partner by time, the line with the same position is used.
 */
export function pairLines(original, translated) {
    const free = (translated || []).map((line, index) => ({ line, index, used: false }));
    const sameLength = (original || []).length === free.length;
    return (original || []).map((line, index) => {
        let best = null;
        for (const candidate of free) {
            if (candidate.used) continue;
            const gap = Math.abs(candidate.line.time - line.time);
            if (gap <= SAME_MOMENT && (!best || gap < best.gap)) best = { candidate, gap };
        }
        const partner = best ? best.candidate : sameLength && !free[index].used ? free[index] : null;
        if (partner) partner.used = true;
        return { ...line, translation: partner && !line.instrumental ? partner.line.text : '' };
    });
}
