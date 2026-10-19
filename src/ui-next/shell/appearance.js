// Appearance: theme, accent and density (task A-10). One saved choice, applied to <html> as data attributes that
// tokens.css and the song list already understand:  data-theme, data-accent (absent = the theme's own), data-density.
// shell/appearance-boot.js applies the same saved values before the first paint; this module keeps them in step afterwards.

const KEY = 'xplayer.ui-next.appearance';
const SONGLIST_KEY = 'xplayer.ui-next.songlist'; // B-03 saved density here before it became an appearance choice

export const THEMES = [
    { id: 'warm-graphite', label: 'Warm Graphite' },
    { id: 'deep-forest', label: 'Deep Forest' },
    { id: 'espresso-copper', label: 'Espresso and Copper' }
];
export const ACCENTS = [
    { id: 'theme', label: 'Theme color' },
    { id: 'green', label: 'Green' },
    { id: 'pink', label: 'Pink' },
    { id: 'purple', label: 'Purple' },
    { id: 'yellow', label: 'Yellow' },
    { id: 'white', label: 'White' }
];
export const DENSITIES = [
    { id: 'comfortable', label: 'Comfortable' },
    { id: 'compact', label: 'Compact' }
];
export const DEFAULTS = { theme: THEMES[0].id, accent: 'theme', density: 'comfortable' };

const pick = (list, value, fallback) => (list.some((item) => item.id === value) ? value : fallback);

export function normalize(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    return { theme: pick(THEMES, s.theme, DEFAULTS.theme), accent: pick(ACCENTS, s.accent, DEFAULTS.accent), density: pick(DENSITIES, s.density, DEFAULTS.density) };
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

function write(state) {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {
        /* the choice lasts until the window closes */
    }
}

function apply(state) {
    const root = document.documentElement;
    root.dataset.theme = state.theme;
    if (state.accent === 'theme') delete root.dataset.accent;
    else root.dataset.accent = state.accent;
    root.dataset.density = state.density;
}

let state = read();
const listeners = new Set();
apply(state);

export const getAppearance = () => ({ ...state });

/** Change one or more of { theme, accent, density }. Saves, applies and tells every watcher. */
export function setAppearance(patch) {
    const next = normalize({ ...state, ...patch });
    if (next.theme === state.theme && next.accent === state.accent && next.density === state.density) return;
    state = next;
    write(state);
    apply(state);
    for (const listener of [...listeners]) listener({ ...state });
}

/** callback({ theme, accent, density }) after every change. Returns unsubscribe(). */
export function watchAppearance(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}
