// The rest of the custom theme (Settings, Appearance, "Build your own theme"): how each panel looks, and the style of the whole app.
// Pure functions, no DOM. shell/theme-math.js derives the colors; this file adds
//   panels  per panel (title bar, rail, library panel, main view, right panel, player bar): its own background (solid or a gradient),
//           text color, accent and edge line. A panel with nothing set follows the theme.
//   style   the lines of the whole app: how strong they are and, if wanted, their color (lineStrength, lineColor).
// Everything the person picks is validated here (hex colors, whole numbers, fixed words) before it becomes CSS, so the style text that
// designCss() returns can only ever contain values this file wrote itself.
import { CUSTOM_KEYS, FLOOR_RATIO, LINE_DEFAULT, lineColors, isHex, isDark, mix, contrast, reach, parseHex, deriveTheme } from './theme-math.js';

/** The six panels, in the order the preview shows them. `base` is the theme color the panel uses now; `side` is the edge that carries its line. */
export const PANELS = [
    { id: 'titlebar', label: 'Title bar', hint: 'The bar across the top: menu, back and forward, window buttons.', selector: '.titlebar', base: 'surface', side: 'bottom' },
    { id: 'rail', label: 'Side rail', hint: 'The strip of icons on the far left.', selector: '.rail', base: 'surface', side: 'right' },
    { id: 'left', label: 'Library panel', hint: 'Songs, playlists and folders next to the main view.', selector: '.panel-host', base: 'surface', side: 'right' },
    { id: 'main', label: 'Main view', hint: 'The song list, Home, Settings and the tools.', selector: '.view-host', base: 'ground', side: null },
    { id: 'right', label: 'Right panel', hint: 'The lyrics and the cover.', selector: '.right-host', base: 'surface', side: 'left' },
    { id: 'player', label: 'Player bar', hint: 'Play, progress and volume along the bottom.', selector: '.player-host', base: 'surface', side: 'top' }
];

export const FILLS = [
    { id: 'auto', label: 'Theme' },
    { id: 'solid', label: 'Solid' },
    { id: 'gradient', label: 'Gradient' }
];
export const LINE_WIDTHS = [
    { id: 'auto', label: 'Theme' },
    { id: '0', label: 'None' },
    { id: '1', label: 'Thin' },
    { id: '2', label: 'Medium' },
    { id: '3', label: 'Thick' }
];
export const DEFAULT_ANGLE = 180; // top to bottom
export const MAX_LINE_WIDTH = 3;

const ids = (list) => list.map((item) => item.id);
const hex = (value) => (isHex(value) ? value.toLowerCase() : undefined);

/** Whitelists what a panel may hold. Unknown panels and values are dropped; a fill that lacks its colors falls back to the theme's. */
export function normalizePanels(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const panel of PANELS) {
        const src = raw[panel.id];
        if (!src || typeof src !== 'object') continue;
        const next = {};
        const bg = hex(src.bg);
        const bg2 = hex(src.bg2);
        if (bg) next.bg = bg;
        if (bg2) next.bg2 = bg2;
        if (Number.isFinite(src.angle)) next.angle = ((Math.round(src.angle) % 360) + 360) % 360;
        if (src.fill === 'solid' && bg) next.fill = 'solid';
        if (src.fill === 'gradient' && bg && bg2) next.fill = 'gradient';
        const ink = hex(src.ink);
        const accent = hex(src.accent);
        const line = hex(src.line);
        if (ink) next.ink = ink;
        if (accent) next.accent = accent;
        if (line && panel.side) next.line = line;
        if (Number.isInteger(src.lineWidth) && src.lineWidth >= 0 && src.lineWidth <= MAX_LINE_WIDTH && panel.side) next.lineWidth = src.lineWidth;
        // colors kept only for remembering (a solid panel's second color) do not count as a change
        if (next.fill || next.ink || next.accent || next.line || next.lineWidth !== undefined) out[panel.id] = next;
    }
    return out;
}

/** Only what differs from the defaults is kept, so two equal looks compare equal. (An earlier version had Faint and Strong, 20 and 70.) */
export function normalizeStyle(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    let strength = Number.isFinite(s.lineStrength) ? Math.round(s.lineStrength) : s.lines === 'soft' ? 20 : s.lines === 'strong' ? 70 : LINE_DEFAULT;
    strength = Math.max(0, Math.min(100, strength));
    if (strength !== LINE_DEFAULT) out.lineStrength = strength;
    const color = hex(s.lineColor);
    if (color) out.lineColor = color;
    return out;
}

/** The whole custom theme: { colors, exact, panels, style } -> the same plus `vars` (the fifteen theme values), or null when the colors are not four hex codes. */
export function normalizeCustom(saved) {
    const colors = saved && saved.colors;
    if (!colors || !CUSTOM_KEYS.every((k) => isHex(colors[k]))) return null;
    const clean = Object.fromEntries(CUSTOM_KEYS.map((k) => [k, colors[k].toLowerCase()]));
    const exact = saved.exact === true;
    const style = normalizeStyle(saved.style);
    return { colors: clean, exact, panels: normalizePanels(saved.panels), style, vars: deriveTheme(clean, { exact, line: { strength: style.lineStrength, color: style.lineColor } }).vars };
}

/** The design part of a custom theme, alone: what a saved theme and the builder compare and keep next to the four colors. */
export const designOf = (custom) => ({ panels: normalizePanels(custom && custom.panels), style: normalizeStyle(custom && custom.style) });
export const sameDesign = (a, b) => JSON.stringify(designOf(a)) === JSON.stringify(designOf(b));
export const isPlainDesign = (design) => !Object.keys(normalizePanels(design && design.panels)).length && !Object.keys(normalizeStyle(design && design.style)).length;

const rgbOf = (color) => parseHex(color).join(' ');

/**
 * What one panel looks like: its own values for the semantic tokens (a panel with a color of its own gets matching raised, selected and
 * line colors), its background, and the readable-contrast ratios. A panel that is not changed returns the theme's own values with
 * `changed: false`, so a preview can draw every panel the same way.
 * `custom` is a normalized custom theme (colors, exact, panels, style, vars).
 */
export function panelScope(custom, panelId) {
    const panel = PANELS.find((p) => p.id === panelId);
    const vars = custom.vars;
    const opts = (custom.panels && custom.panels[panelId]) || {};
    const style = custom.style || {};
    const baseBg = vars[panel.base];
    const gradient = opts.fill === 'gradient';
    const solid = opts.fill === 'solid';
    const bgA = gradient || solid ? opts.bg : baseBg;
    const bgB = gradient ? opts.bg2 : bgA;
    const mid = gradient ? mix(bgA, bgB, 0.5) : bgA;
    const changed = Boolean(opts.fill || opts.ink || opts.accent || opts.line || opts.lineWidth !== undefined);
    const background = gradient ? `linear-gradient(${opts.angle ?? DEFAULT_ANGLE}deg, ${bgA}, ${bgB})` : solid ? bgA : null;

    const dark = isDark(mid);
    const extreme = dark ? '#ffffff' : '#000000';
    const wantInk = opts.ink || vars.ink;
    const [themeLine, lineStrong] = lineColors(mid, wantInk, { strength: style.lineStrength, color: style.lineColor });
    const raised = mix(mid, wantInk, 0.04);
    const selected = mix(mid, wantInk, 0.08);
    const backdrops = [bgA, bgB, mid, raised, selected];
    const ink = custom.exact ? wantInk : reach(wantInk, extreme, backdrops, FLOOR_RATIO);
    const inkDim = reach(mix(ink, mid, 0.35), ink, backdrops, FLOOR_RATIO);
    const inkFaint = reach(mix(ink, mid, 0.45), ink, backdrops, FLOOR_RATIO);
    const wantAccent = opts.accent || vars.accent;
    const accent = custom.exact ? wantAccent : reach(wantAccent, extreme, backdrops, FLOOR_RATIO);
    const onAccent = contrast(accent, '#000000') >= contrast(accent, '#ffffff') ? '#000000' : '#ffffff';
    const danger = reach(dark ? '#f08a80' : '#b3261e', extreme, backdrops, FLOOR_RATIO);
    // What sits inside a panel, darker than the panel itself (inputs, the segmented control), and the panels' cards inside the main view.
    const inset = mix(mid, '#000000', dark ? 0.3 : 0.05);
    const card = mix(mid, wantInk, 0.03);
    const line = opts.line || themeLine;
    const tokens = {
        '--surface-ground': panel.base === 'ground' ? mid : inset,
        '--surface-panel': panel.base === 'ground' ? card : mid,
        '--surface-raised': raised,
        '--surface-selected': selected,
        '--border-subtle': line,
        '--border-strong': lineStrong,
        '--text-primary': ink,
        '--text-secondary': inkDim,
        '--text-tertiary': inkFaint,
        '--text-on-accent': onAccent,
        '--accent': accent,
        '--accent-hover': mix(accent, extreme, 0.12),
        '--accent-own': accent,
        '--accent-soft': `rgb(${rgbOf(accent)} / 0.1)`,
        '--danger': danger
    };
    const worst = (fg) => Math.min(...backdrops.map((bg) => contrast(fg, bg)));
    return {
        id: panelId,
        changed,
        tokens,
        background,
        mid,
        ink,
        accent,
        line,
        lineWidth: opts.lineWidth,
        side: panel.side,
        ratios: { ink: worst(ink), accent: worst(accent) }
    };
}

/** The component-layer tokens that are written in terms of the semantic ones (tokens.css, section 3). A panel with its own colors writes them again, so its buttons, inputs and chips follow the panel's colors and not the page's. */
export const COMPONENT_TOKENS = {
    '--button-primary-bg': 'var(--text-primary)',
    '--button-primary-fg': 'var(--surface-ground)',
    '--button-outline-border': 'var(--border-strong)',
    '--chip-bg': 'var(--surface-selected)',
    '--chip-active-bg': 'var(--text-primary)',
    '--chip-active-fg': 'var(--surface-ground)',
    '--row-playing-bg': 'var(--accent-soft)',
    '--tooltip-bg': 'var(--surface-raised)',
    '--tooltip-border': 'var(--border-strong)',
    '--toast-bg': 'var(--surface-raised)',
    '--menu-bg': 'var(--surface-raised)',
    '--control-hover-bg': 'var(--surface-selected)',
    '--control-active-bg': 'var(--border-strong)',
    '--input-bg': 'var(--surface-ground)',
    '--input-border': 'var(--border-strong)',
    '--input-border-hover': 'var(--text-tertiary)',
    '--segmented-bg': 'var(--surface-ground)',
    '--segmented-active-bg': 'var(--surface-selected)',
    '--focus-ring': 'var(--accent)'
};

const SIDE_PROPS = { top: 'border-top', right: 'border-right', bottom: 'border-bottom', left: 'border-left' };
const declare = (map) => Object.entries(map).map(([name, value]) => `${name}: ${value};`).join(' ');

/** The style rules for a custom theme as CSS text: one rule per panel that is changed. Empty when nothing is. */
export function designCss(custom) {
    if (!custom) return '';
    const scope = ":root[data-theme='custom']";
    const rules = [];
    for (const panel of PANELS) {
        const s = panelScope(custom, panel.id);
        if (!s.changed) continue;
        const decl = { ...s.tokens, ...COMPONENT_TOKENS };
        const parts = [declare(decl)];
        if (s.background) parts.push(`background: ${s.background};`);
        if (panel.side && panel.id !== 'titlebar') {
            const side = SIDE_PROPS[panel.side];
            if (s.lineWidth !== undefined) parts.push(`${side}-width: ${s.lineWidth}px;`);
            parts.push(`${side}-color: ${s.line};`);
        }
        rules.push(`${scope} ${panel.selector} { ${parts.join(' ')} }`);
        // The title bar draws its line as a pseudo element (shell.css) that starts where the rail ends.
        if (panel.id === 'titlebar') rules.push(`${scope} ${panel.selector}::after { ${s.lineWidth !== undefined ? `height: ${s.lineWidth}px; ` : ''}background: ${s.line}; }`);
    }
    return rules.join('\n');
}

/** A starting point for a panel's own colors when the person switches it from "Theme" to a solid or a gradient: today's color, and a second one a step lighter or darker. */
export function startingFill(custom, panelId) {
    const panel = PANELS.find((p) => p.id === panelId);
    const base = custom.vars[panel.base];
    return { bg: base, bg2: mix(base, isDark(base) ? '#ffffff' : '#000000', 0.18) };
}
