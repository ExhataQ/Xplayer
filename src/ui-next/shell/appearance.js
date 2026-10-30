// Appearance: theme, density and scrollbar (task A-10; the accent presets were removed 2026-10-28, the accent belongs to the theme). One saved
// choice, applied to <html> as data attributes that tokens.css and the song list already understand: data-theme, data-density.
// shell/appearance-boot.js applies the same saved values before the first paint; this module keeps them in step afterwards.

import { VAR_NAMES } from './theme-math.js';
import { normalizeCustom, designCss } from './theme-design.js';

const KEY = 'xplayer.ui-next.appearance';
const SONGLIST_KEY = 'xplayer.ui-next.songlist'; // B-03 saved density here before it became an appearance choice

export const THEMES = [
    { id: 'warm-graphite', label: 'Warm Graphite' },
    { id: 'deep-forest', label: 'Deep Forest' },
    { id: 'espresso-copper', label: 'Espresso and Copper' },
    { id: 'pure-black', label: 'Pure Black' },
    { id: 'graphite-gold', label: 'Graphite Gold' },
    { id: 'carbon-honey', label: 'Carbon and Honey' },
    { id: 'high-contrast', label: 'High Contrast' },
    { id: 'midnight-blue', label: 'Midnight Blue' },
    { id: 'aubergine-rose', label: 'Aubergine and Rose' },
    { id: 'ocean-teal', label: 'Ocean Teal' },
    { id: 'crimson-noir', label: 'Crimson Noir' },
    { id: 'violet-night', label: 'Violet Night' }
];
export const DENSITIES = [
    { id: 'comfortable', label: 'Comfortable' },
    { id: 'compact', label: 'Compact' }
];
export const SCROLLBARS = [
    { id: 'theme', label: 'Theme color' },
    { id: 'neutral', label: 'Neutral' }
];
export const SCROLLBAR_SHAPES = [
    { id: 'bar', label: 'Flush bar' },
    { id: 'tab', label: 'Wall tab' }
];
export const SCROLLBAR_CATS = [
    { id: 'off', label: 'Off' },
    { id: 'on', label: 'On' }
];
export const CUSTOM_ID = 'custom'; // the theme the person builds (shell/theme-builder.js); it is not in THEMES because it has no fixed colors
export const DEFAULTS = { theme: THEMES[0].id, density: 'comfortable', scrollbar: 'theme', scrollbarShape: 'bar', scrollbarCat: 'off' };

const pick = (list, value, fallback) => (list.some((item) => item.id === value) ? value : fallback);

export function normalize(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    const custom = normalizeCustom(s.custom);
    const theme = s.theme === CUSTOM_ID && custom ? CUSTOM_ID : pick(THEMES, s.theme, DEFAULTS.theme);
    return { theme, density: pick(DENSITIES, s.density, DEFAULTS.density), scrollbar: pick(SCROLLBARS, s.scrollbar, DEFAULTS.scrollbar), scrollbarShape: pick(SCROLLBAR_SHAPES, s.scrollbarShape, DEFAULTS.scrollbarShape), scrollbarCat: pick(SCROLLBAR_CATS, s.scrollbarCat, DEFAULTS.scrollbarCat), custom };
}

function read() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (saved) return normalize(saved);
        const old = JSON.parse(localStorage.getItem(SONGLIST_KEY) || '{}');
        return normalize({ density: old && old.density });
    } catch (_) {
        return normalize(null);
    }
}

// Saving waits for a quiet moment: a color being dragged in the builder changes the choice dozens of times a second.
let saveTimer = 0;
function save() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {
        /* the choice lasts until the window closes */
    }
}
function write() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => saveTimer && save());

// The panels' own looks, the corners and the font of a custom theme: one style element, written whole on every change and removed for any other theme.
function applyDesign(state) {
    let style = document.getElementById('xp-custom-design');
    const css = state.theme === CUSTOM_ID && state.custom ? designCss(state.custom) : '';
    if (!css) return style && style.remove();
    if (!style) {
        style = document.createElement('style');
        style.id = 'xp-custom-design';
        document.head.append(style);
    }
    if (style.textContent !== css) style.textContent = css;
}

let editingTimer = 0;
function apply(state) {
    const root = document.documentElement;
    // Colors change everywhere at once: transitions are switched off for a moment (a dragged color would otherwise restart them on
    // every element, many times a second).
    root.dataset.themeEditing = '';
    clearTimeout(editingTimer);
    editingTimer = setTimeout(() => delete root.dataset.themeEditing, 300);
    root.dataset.theme = state.theme;
    delete root.dataset.accent; // the accent presets are gone; a value left by an older version or the engine's own buttons does nothing
    root.dataset.density = state.density;
    root.dataset.scrollbar = state.scrollbar; // 'theme' (the accent) or 'neutral' (scrollbar.css)
    root.dataset.scrollbarShape = state.scrollbarShape; // 'bar' or 'tab' (scrollbar.css)
    root.dataset.scrollbarCat = state.scrollbarCat; // 'off' or 'on' (shell/cat-scrollbar.js draws the cat)
    // The custom theme is the fifteen values a theme has, set on <html> itself (they win over any [data-theme] block).
    for (const name of VAR_NAMES) root.style.removeProperty(`--c-${name}`);
    if (state.theme === CUSTOM_ID && state.custom) for (const name of VAR_NAMES) root.style.setProperty(`--c-${name}`, state.custom.vars[name]);
    applyDesign(state);
    document.dispatchEvent(new CustomEvent('xplayer:appearance')); // for what draws with theme colors itself (the seek waveform)
}

let state = read();
const listeners = new Set();
apply(state);

export const getAppearance = () => ({ ...state });

/** Change one or more of { theme, density, scrollbar, scrollbarShape, scrollbarCat, custom }; `custom` is { colors: { ground, surface, ink, accent }, exact?, panels?, style? } (shell/theme-design.js says what panels and style hold). Saves, applies and tells every watcher. `defer: true` (a color being dragged) saves after a quiet moment instead of at once. */
export function setAppearance(patch, { defer = false } = {}) {
    const next = normalize({ ...state, ...patch });
    if (next.theme === state.theme && next.density === state.density && next.scrollbar === state.scrollbar && next.scrollbarShape === state.scrollbarShape && next.scrollbarCat === state.scrollbarCat && JSON.stringify(next.custom) === JSON.stringify(state.custom)) return;
    state = next;
    if (defer) write();
    else save();
    apply(state);
    for (const listener of [...listeners]) listener({ ...state });
}

/** callback({ theme, density, scrollbar, scrollbarShape, scrollbarCat, custom }) after every change. Returns unsubscribe(). */
export function watchAppearance(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}
