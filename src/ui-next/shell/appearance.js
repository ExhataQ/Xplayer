// Appearance: theme, density and scrollbar (task A-10; the accent presets were removed 2026-10-28, the accent belongs to the theme). One saved
// choice, applied to <html> as data attributes that tokens.css and the song list already understand: data-theme, data-density.
// shell/appearance-boot.js applies the same saved values before the first paint; this module keeps them in step afterwards.

import { VAR_NAMES, isDark } from './theme-math.js';
import { normalizeCustom, designCss } from './theme-design.js';

const KEY = 'xplayer.ui-next.appearance';
const SONGLIST_KEY = 'xplayer.ui-next.songlist'; // B-03 saved density here before it became an appearance choice

// Order (PA-20): the default first, then the black, grey and yellow group, then the colored darks, then High Contrast.
// Custom (the builder's theme) comes after this list, in the picker.
export const THEMES = [
    { id: 'warm-graphite', label: 'Warm Graphite' },
    { id: 'pure-black', label: 'Pure Black' },
    { id: 'graphite-gold', label: 'Graphite Gold' },
    { id: 'carbon-honey', label: 'Carbon and Honey' },
    { id: 'deep-forest', label: 'Deep Forest' },
    { id: 'espresso-copper', label: 'Espresso and Copper' },
    { id: 'midnight-blue', label: 'Midnight Blue' },
    { id: 'aubergine-rose', label: 'Aubergine and Rose' },
    { id: 'ocean-teal', label: 'Ocean Teal' },
    { id: 'crimson-noir', label: 'Crimson Noir' },
    { id: 'violet-night', label: 'Violet Night' },
    { id: 'high-contrast', label: 'High Contrast' },
    { id: 'light', label: 'Light' }
];
// The two main choices (C9): Dark is the default theme, Light is the one light theme. Every other built-in theme is a "more themes" card.
export const MAIN_THEMES = [
    { id: 'warm-graphite', label: 'Dark' },
    { id: 'light', label: 'Light' }
];
const LIGHT_THEMES = ['light'];
/** 'dark' or 'light': what <html data-mode> says, from the theme (a custom theme by its background; shell/appearance-boot.js does the same before the first paint). */
export const modeOf = (state) => (state.theme === CUSTOM_ID ? (state.custom && !isDark(state.custom.vars.ground) ? 'light' : 'dark') : LIGHT_THEMES.includes(state.theme) ? 'light' : 'dark');
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
    { id: 'standard', label: 'Standard' }
];
export const SCROLLBAR_CATS = [
    { id: 'off', label: 'Off' },
    { id: 'on', label: 'On' }
];
// The cat's skins (shown in Settings only while the cat scrollbar is on). Classic is the detailed yellow and orange cat; the others are
// flat, minimalist silhouettes in one color (shell/cat-scrollbar.js, cat-scrollbar.css).
export const SCROLLBAR_CAT_SKINS = [
    { id: 'classic', label: 'Classic' },
    { id: 'black', label: 'Black' },
    { id: 'white', label: 'White' },
    { id: 'ginger', label: 'Ginger' },
    { id: 'blue', label: 'Blue' },
    { id: 'rose', label: 'Rose' }
];
// Whether the cat may walk and look about by itself now and then (only shown while the cat is on).
export const SCROLLBAR_CAT_ROAMS = [
    { id: 'on', label: 'On' },
    { id: 'off', label: 'Off' }
];
// Whether the cat moves to the music and glances at the player bar when the song changes (only shown while the cat is on).
export const SCROLLBAR_CAT_MUSICS = [
    { id: 'on', label: 'On' },
    { id: 'off', label: 'Off' }
];
// Whether the cat may do things by itself (look about, yawn, stretch, fall asleep), apart from walking (only shown while the cat is on).
export const SCROLLBAR_CAT_ACTS = [
    { id: 'on', label: 'On' },
    { id: 'off', label: 'Off' }
];
// Reduce animations (C7). Saved only once the person chooses; until then the system's "reduce motion" decides (null = follow the system).
export const MOTIONS = [
    { id: 'on', label: 'On' },
    { id: 'off', label: 'Off' }
];
const systemReducesMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** 'on' or 'off': whether animation is reduced for this state, the system's choice standing in for one not made yet. */
export const effectiveMotion = (state) => state.reduceMotion || (systemReducesMotion() ? 'on' : 'off');
export const CUSTOM_ID = 'custom'; // the theme the person builds (shell/theme-builder.js); it is not in THEMES because it has no fixed colors
export const DEFAULTS = { theme: THEMES[0].id, density: 'comfortable', scrollbar: 'neutral', scrollbarShape: 'standard', scrollbarCat: 'off', scrollbarCatSkin: 'classic', scrollbarCatRoam: 'off', scrollbarCatActs: 'on', scrollbarCatMusic: 'on', reduceMotion: null };

const pick = (list, value, fallback) => (list.some((item) => item.id === value) ? value : fallback);

export function normalize(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    const custom = normalizeCustom(s.custom);
    const theme = s.theme === CUSTOM_ID && custom ? CUSTOM_ID : pick(THEMES, s.theme, DEFAULTS.theme);
    return { theme, density: pick(DENSITIES, s.density, DEFAULTS.density), scrollbar: pick(SCROLLBARS, s.scrollbar, DEFAULTS.scrollbar), scrollbarShape: pick(SCROLLBAR_SHAPES, s.scrollbarShape === 'tab' ? 'standard' : s.scrollbarShape, DEFAULTS.scrollbarShape), scrollbarCat: pick(SCROLLBAR_CATS, s.scrollbarCat, DEFAULTS.scrollbarCat), scrollbarCatSkin: pick(SCROLLBAR_CAT_SKINS, s.scrollbarCatSkin, DEFAULTS.scrollbarCatSkin), scrollbarCatRoam: pick(SCROLLBAR_CAT_ROAMS, s.scrollbarCatRoam, DEFAULTS.scrollbarCatRoam), scrollbarCatActs: pick(SCROLLBAR_CAT_ACTS, s.scrollbarCatActs, DEFAULTS.scrollbarCatActs), scrollbarCatMusic: pick(SCROLLBAR_CAT_MUSICS, s.scrollbarCatMusic, DEFAULTS.scrollbarCatMusic), reduceMotion: pick(MOTIONS, s.reduceMotion, null), custom };
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
    root.dataset.mode = modeOf(state); // 'dark' or 'light': native controls, shadows and scrims follow it (tokens.css section 4, base.css)
    delete root.dataset.accent; // the accent presets are gone; a value left by an older version or the engine's own buttons does nothing
    root.dataset.density = state.density;
    root.dataset.scrollbar = state.scrollbar; // 'theme' (the accent) or 'neutral' (scrollbar.css)
    root.dataset.scrollbarShape = state.scrollbarShape; // 'bar' or 'standard' (scrollbar.css); 'tab' is an older name for 'standard'
    root.dataset.scrollbarCat = state.scrollbarCat; // 'off' or 'on' (shell/cat-scrollbar.js draws the cat)
    root.dataset.scrollbarCatSkin = state.scrollbarCatSkin; // which cat (shell/cat-scrollbar.js)
    root.dataset.scrollbarCatRoam = state.scrollbarCatRoam; // 'on' or 'off': the cat walks and looks about by itself
    root.dataset.scrollbarCatActs = state.scrollbarCatActs; // 'on' or 'off': the cat looks about, yawns, stretches and sleeps
    root.dataset.scrollbarCatMusic = state.scrollbarCatMusic; // 'on' or 'off': the cat moves to the music
    root.dataset.motion = effectiveMotion(state) === 'on' ? 'reduced' : 'full'; // 'reduced' or 'full': the one attribute every animation reads (components/motion.js, base.css)
    // The custom theme is the fifteen values a theme has, set on <html> itself (they win over any [data-theme] block).
    for (const name of VAR_NAMES) root.style.removeProperty(`--c-${name}`);
    if (state.theme === CUSTOM_ID && state.custom) for (const name of VAR_NAMES) root.style.setProperty(`--c-${name}`, state.custom.vars[name]);
    applyDesign(state);
    document.dispatchEvent(new CustomEvent('xplayer:appearance')); // for what draws with theme colors itself (the seek waveform)
}

let state = read();
const listeners = new Set();
apply(state);

// While the person has not chosen, a change of the system's setting (Windows "Show animations") carries over at once.
if (typeof matchMedia === 'function') {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const follow = () => {
        if (state.reduceMotion) return;
        apply(state);
        for (const listener of [...listeners]) listener({ ...state });
    };
    if (query && typeof query.addEventListener === 'function') query.addEventListener('change', follow);
}

export const getAppearance = () => ({ ...state });

/** Change one or more of { theme, density, scrollbar, scrollbarShape, scrollbarCat, scrollbarCatSkin, scrollbarCatRoam, scrollbarCatActs, scrollbarCatMusic, reduceMotion, custom }; `custom` is { colors: { ground, surface, ink, accent }, exact?, panels?, style? } (shell/theme-design.js says what panels and style hold). Saves, applies and tells every watcher. `defer: true` (a color being dragged) saves after a quiet moment instead of at once. */
export function setAppearance(patch, { defer = false } = {}) {
    const next = normalize({ ...state, ...patch });
    if (next.theme === state.theme && next.density === state.density && next.scrollbar === state.scrollbar && next.scrollbarShape === state.scrollbarShape && next.scrollbarCat === state.scrollbarCat && next.scrollbarCatSkin === state.scrollbarCatSkin && next.scrollbarCatRoam === state.scrollbarCatRoam && next.scrollbarCatActs === state.scrollbarCatActs && next.scrollbarCatMusic === state.scrollbarCatMusic && next.reduceMotion === state.reduceMotion && JSON.stringify(next.custom) === JSON.stringify(state.custom)) return;
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
