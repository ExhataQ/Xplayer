// The audio visualizer's pure parts (.agent/archive/visualizer/VISUALIZER-PLAN.md V2): which sound bins feed which bar, how a bar rises and falls, how tall it is
// drawn, and how big the canvas really is. No browser and no engine in here, so all of it is tested in node (tools/tests/ui-next-visualizer-math.test.js).

export const DESIGN = Object.freeze({
    pitch: 11, // about one bar per this many CSS pixels (about 120 at 1440 wide)
    minBars: 24,
    maxBars: 160,
    gap: 3, // CSS pixels between bars
    leftMin: 0.3, // the left-side strip is at least this share of the section's width...
    leftMax: 0.4, // ...and at most this share
    leftGap: 12, // and ends this many pixels before the centre column
    maxShare: 0.78, // the tallest bar's share of the strip's height
    fps: 30,
    resolutionCap: 1, // the canvas draws at most at scale 1 and CSS stretches it (measured: .agent/archive/visualizer/reports/V0-visualizer-spike.md)
    lowHz: 30,
    highHz: 16000,
    attack: 0.7, // how much of the way to a louder value a bar jumps in one frame
    fall: 0.22, // how much of the way down a bar falls in one frame (quick enough to follow a beat, slow enough not to flicker)
    topAlpha: 0.25, // the colour at a bar's top is this share of its strength at the bottom
    floor: 0.2, // an analyser level under this is the quiet floor (about -75 dB): no bar. The analyser's 0 to 1 spans -100 to -30 dB, and music sits high in it
    boost: 4, // the logarithmic lift on top of the auto level: the bigger, the taller the quiet sounds are drawn
    gainDecay: 0.992, // how much of the loudest recent level is kept each frame (about 5 seconds to halve at 30 frames a second)
    gainMin: 0.35 // the auto level never treats the loudest level as quieter than this, so a silent gap is not blown up into noise
});

/** How many bars fit `width` CSS pixels. */
export function barCountFor(width, { pitch = DESIGN.pitch, min = DESIGN.minBars, max = DESIGN.maxBars } = {}) {
    const n = Math.round((Number(width) || 0) / pitch);
    return Math.max(min, Math.min(max, n));
}

/**
 * The width of the left-side strip, in CSS pixels: from the left edge to just before the centre column (the transport and seek bar), but never
 * under `min` or over `max` of the section's width (30 to 40 %), so it stays a clear strip in a narrow window and a small one in a wide window.
 */
export function leftStripWidth(sectionWidth, centreLeft, { min = DESIGN.leftMin, max = DESIGN.leftMax, gap = DESIGN.leftGap } = {}) {
    const w = Number(sectionWidth) || 0;
    const edge = (Number(centreLeft) || 0) - gap;
    return Math.round(Math.min(w * max, Math.max(w * min, edge)));
}

/** The canvas's own scale: the screen's, but never above the cap. */
export function canvasScale(devicePixelRatio, cap = DESIGN.resolutionCap) {
    const dpr = Number(devicePixelRatio);
    return Math.max(0.5, Math.min(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, cap));
}

/** For each bar, the first and last analyser bin it reads: log spaced from lowHz to highHz, never empty, never past the last bin. */
export function binRanges(bars, binCount, sampleRate, { lowHz = DESIGN.lowHz, highHz = DESIGN.highHz } = {}) {
    const hzPerBin = sampleRate / 2 / binCount;
    const top = Math.max(0, binCount - 1);
    const edge = (i) => Math.min(top, Math.max(0, Math.round((lowHz * Math.pow(highHz / lowHz, i / bars)) / hzPerBin)));
    const ranges = [];
    let prevEnd = -1;
    for (let b = 0; b < bars; b++) {
        let start = Math.max(edge(b), prevEnd + 1 > top ? top : prevEnd + 1);
        const end = Math.max(start, Math.min(top, edge(b + 1)));
        if (start > top) start = top;
        ranges.push([start, end]);
        prevEnd = end;
    }
    return ranges;
}

/** The loudest bin in each bar's range, 0 to 1 (bytes 0 to 255 as the analyser gives them). */
export function barTargets(freq, ranges, out = new Float32Array(ranges.length)) {
    for (let b = 0; b < ranges.length; b++) {
        let peak = 0;
        for (let i = ranges[b][0]; i <= ranges[b][1]; i++) if (freq[i] > peak) peak = freq[i];
        out[b] = peak / 255;
    }
    return out;
}

/** Fast rise, slow fall. Moves `levels` towards `targets` in place and returns true while anything still moves (above the resting edge). */
export function smoothLevels(levels, targets, { attack = DESIGN.attack, fall = DESIGN.fall } = {}) {
    let moving = false;
    for (let b = 0; b < levels.length; b++) {
        const level = levels[b];
        const target = targets ? targets[b] : 0;
        const next = target > level ? level + (target - level) * attack : level + (target - level) * fall;
        levels[b] = next < 0.004 && target === 0 ? 0 : next;
        if (levels[b] > 0) moving = true;
    }
    return moving;
}

/**
 * The auto level: music is mastered at very different loudness, and the analyser reads loud music as nearly full everywhere. This follows the
 * loudest bar of the last few seconds (rises at once, falls slowly) and divides by it, so the tallest bars of a loud song and of a quiet one
 * both reach the top at their peaks and the bars move up and down with the music. Works in place on `levels` (floor already taken off).
 */
export function createAutoGain({ decay = DESIGN.gainDecay, min = DESIGN.gainMin } = {}) {
    let peak = min;
    return {
        apply(levels) {
            let loudest = 0;
            for (let i = 0; i < levels.length; i++) if (levels[i] > loudest) loudest = levels[i];
            peak = Math.max(min, loudest, peak * decay);
            for (let i = 0; i < levels.length; i++) levels[i] = Math.min(1, levels[i] / peak);
            return levels;
        },
        reset() {
            peak = min;
        },
        get peak() {
            return peak;
        }
    };
}

/** The analyser level with the quiet floor taken off: 0 at the floor and under it, 1 at full. */
export function aboveFloor(level, floor = DESIGN.floor) {
    const v = Math.max(0, Math.min(1, Number(level) || 0));
    return v <= floor ? 0 : (v - floor) / (1 - floor);
}

/**
 * How a level (0 to 1, after the floor and the auto level) is drawn: a logarithmic curve lifts the small sounds so they stay visible while the
 * loud ones still differ from each other. 0 stays 0 and 1 stays 1; for example 0.1 is drawn at about 0.21, 0.3 at 0.45 and 0.6 at 0.77.
 */
export function shapeLevel(level, { boost = DESIGN.boost } = {}) {
    const v = Math.max(0, Math.min(1, Number(level) || 0));
    return v === 0 ? 0 : Math.log1p(boost * v) / Math.log1p(boost);
}

/** A bar's height in canvas pixels: its level times the share of the strip, and at least `min` (the resting baseline). */
export function barHeight(level, stripHeight, { maxShare = DESIGN.maxShare, min = 0 } = {}) {
    return Math.max(min, Math.round(Math.max(0, Math.min(1, level)) * stripHeight * maxShare));
}

/** The bars' x positions and widths across `width` canvas pixels, edge to edge with `gap` between (and at the two ends). Whole pixels. */
export function barLayout(width, bars, gap) {
    const slot = (width - gap * (bars + 1)) / bars;
    const out = [];
    for (let b = 0; b < bars; b++) {
        const x = Math.round(gap + b * (slot + gap));
        const right = Math.round(gap + b * (slot + gap) + slot);
        out.push([x, Math.max(1, right - x)]);
    }
    return out;
}

/** "#rrggbb", "#rgb" or "rgb(r, g, b)" / "rgb(r g b / a)" to [r, g, b]; null when it is not one of those. */
export function parseColor(text) {
    const s = String(text || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
    m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/i.exec(s);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])].map((n) => Math.max(0, Math.min(255, Math.round(n))));
    return null;
}
