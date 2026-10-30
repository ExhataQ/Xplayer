// Color math for the custom theme builder (Settings, Appearance). Pure functions, no DOM.
// The builder asks for four colors: background, panels, text and accent. deriveTheme() makes the other eleven values a theme needs
// (tokens.css, the --c-* names), and keeps text readable on every surface (4.5:1, the same floor tools/tests/ui-next-tokens.test.js enforces).

export const CUSTOM_KEYS = ['ground', 'surface', 'ink', 'accent'];
export const VAR_NAMES = ['ground', 'surface', 'raised', 'selected', 'line', 'line-strong', 'ink', 'ink-dim', 'ink-faint', 'accent', 'accent-hover', 'accent-own', 'accent-rgb', 'on-accent', 'danger'];

const FLOOR = 4.5;
export const FLOOR_RATIO = FLOOR;
export const LINE_DEFAULT = 40; // line strength, 0 to 100; 40 tints the lines a tenth of the way toward the text color

/**
 * The two line colors (a thin line, and the stronger one of inputs and outline buttons) on `bg`. By default they are tinted toward the text color
 * `ink`, `strength` (0 to 100) says how far; with a line `color` they are blended toward that color instead, so 100 is the color itself.
 */
export function lineColors(bg, ink, { strength = LINE_DEFAULT, color } = {}) {
    const s = Math.max(0, Math.min(100, Number.isFinite(strength) ? strength : LINE_DEFAULT));
    if (color) return [mix(bg, color, s / 100), mix(bg, color, Math.min(1, (s / 100) * 1.4))];
    return [mix(bg, ink, s / 400), mix(bg, ink, Math.min(1, (s / 400) * 1.6))];
}

export const isHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export function parseHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Mix `a` toward `b` by `t` (0 = a, 1 = b), both hex. */
export function mix(a, b, t) {
    const x = parseHex(a);
    const y = parseHex(b);
    return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export function luminance(hex) {
    const [r, g, b] = parseHex(hex).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
}
export const isDark = (hex) => luminance(hex) < 0.35;

/** Moves `color` toward `target` in small steps until it has `floor`:1 against every color in `against`. */
export function reach(color, target, against, floor) {
    let out = color;
    for (let t = 0; t <= 1.0001 && !against.every((bg) => contrast(out, bg) >= floor); t += 0.02) out = mix(color, target, t);
    return out;
}

/**
 * colors: { ground, surface, ink, accent } (hex). line: { strength?, color? }, how visible the hairlines are and what color (see lineColors). exact: use the text and accent colors as chosen. By default they are moved toward
 * white (dark themes) or black (light themes) just far enough to be readable on every surface, so a mid-tone accent never gives text
 * that is hard to read. Returns { vars, problems, adjusted }: `adjusted` lists the keys ('ink', 'accent') that were moved; `problems`
 * (only possible with `exact`) lists what is hard to read: { key, text, ratio }.
 */
export function deriveTheme(colors, { exact = false, line: lineStyle = {} } = {}) {
    const { ground, surface } = colors;
    const dark = isDark(ground);
    const extreme = dark ? '#ffffff' : '#000000';
    const raised = mix(surface, colors.ink, 0.04);
    const selected = mix(surface, colors.ink, 0.08);
    const [line, lineStrong] = lineColors(surface, colors.ink, lineStyle);
    const surfaces = [ground, surface, raised, selected];
    const ink = exact ? colors.ink : reach(colors.ink, extreme, surfaces, FLOOR);
    const accent = exact ? colors.accent : reach(colors.accent, extreme, surfaces, FLOOR);
    const inkDim = reach(mix(ink, ground, 0.35), ink, surfaces, FLOOR);
    const inkFaint = reach(mix(ink, ground, 0.45), ink, surfaces, FLOOR);
    const accentHover = mix(accent, dark ? '#ffffff' : '#000000', 0.12);
    const onAccent = contrast(accent, '#000000') >= contrast(accent, '#ffffff') ? '#000000' : '#ffffff';
    const danger = reach(dark ? '#f08a80' : '#b3261e', extreme, surfaces, FLOOR);
    const vars = {
        ground, surface, raised, selected, line, 'line-strong': lineStrong,
        ink, 'ink-dim': inkDim, 'ink-faint': inkFaint,
        accent, 'accent-hover': accentHover, 'accent-own': accent, 'accent-rgb': parseHex(accent).join(' '), 'on-accent': onAccent,
        danger
    };
    const adjusted = ['ink', 'accent'].filter((key) => vars[key] !== colors[key]);
    return { vars, adjusted, problems: exact ? problemsFor(vars) : [] };
}

function problemsFor(vars) {
    const found = [];
    const surfaces = [vars.ground, vars.surface, vars.raised, vars.selected];
    const check = (key, text, fg) => {
        if (surfaces.some((bg) => contrast(fg, bg) < FLOOR)) found.push({ key, text });
    };
    check('ink', 'Text on the backgrounds', vars.ink);
    check('accent', 'Accent on the backgrounds', vars.accent);
    return found;
}

/** The readouts the builder shows, for the colors as the app will use them: worst ratio of each pairing across the surfaces. */
export function readouts(colors, options) {
    const { vars } = deriveTheme(colors, options);
    const surfaces = [vars.ground, vars.surface, vars.raised, vars.selected];
    const worst = (fg) => Math.min(...surfaces.map((bg) => contrast(fg, bg)));
    return [
        { key: 'ink', label: 'Text', ratio: worst(vars.ink) },
        { key: 'accent', label: 'Accent', ratio: worst(vars.accent) },
        { key: 'on-accent', label: 'Button text', ratio: contrast(vars['on-accent'], vars.accent) }
    ];
}

/** Moves text and accent until they are readable; ground and panels stay as chosen. (What "Use my exact colors" turns off.) */
export function fixColors(colors) {
    let next = colors;
    // the panels' tints come from the text color, so a moved text color moves them a little: repeat until it holds
    for (let i = 0; i < 6 && deriveTheme(next, { exact: true }).problems.length; i++) {
        const { vars } = deriveTheme(next);
        next = { ...next, ink: vars.ink, accent: vars.accent };
    }
    return next;
}

/** Validates a saved custom theme: { colors: {ground, surface, ink, accent}, exact? } -> the same with vars derived, or null. */
export function normalizeCustom(saved) {
    const colors = saved && saved.colors;
    if (!colors || !CUSTOM_KEYS.every((k) => isHex(colors[k]))) return null;
    const clean = Object.fromEntries(CUSTOM_KEYS.map((k) => [k, colors[k].toLowerCase()]));
    const exact = saved.exact === true;
    return { colors: clean, exact, vars: deriveTheme(clean, { exact }).vars };
}
