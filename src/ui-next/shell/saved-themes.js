// The person's saved custom themes (Settings, Appearance, "Save this theme"): a short list kept in localStorage.
// Each is { id, name, colors: { ground, surface, ink, accent }, exact, panels, style } (panels and style: shell/theme-design.js; a theme
// saved before they existed has neither). Nothing here touches the app's colors; the builder applies one.
import { CUSTOM_KEYS, isHex } from './theme-math.js';
import { normalizePanels, normalizeStyle } from './theme-design.js';

const KEY = 'xplayer.ui-next.saved-themes';
export const MAX_SAVED = 24;
const listeners = new Set();

function clean(entry) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string' || !entry.colors || !CUSTOM_KEYS.every((k) => isHex(entry.colors[k]))) return null;
    return {
        id: entry.id,
        name: entry.name.slice(0, 40),
        colors: Object.fromEntries(CUSTOM_KEYS.map((k) => [k, entry.colors[k].toLowerCase()])),
        exact: entry.exact === true,
        panels: normalizePanels(entry.panels),
        style: normalizeStyle(entry.style)
    };
}

export function listSavedThemes() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
        return (Array.isArray(raw) ? raw : []).map(clean).filter(Boolean).slice(0, MAX_SAVED);
    } catch (_) {
        return [];
    }
}

function store(list) {
    try {
        localStorage.setItem(KEY, JSON.stringify(list));
    } catch (_) {
        /* kept until the window closes only through the callers' own lists */
    }
    for (const listener of [...listeners]) listener(list);
    return list;
}

/** Saves a theme under `name` (a name already used is replaced). Returns the saved entry, or null when the list is full. */
export function saveTheme(name, colors, exact = false, design = {}) {
    const list = listSavedThemes();
    const label = String(name || '').trim().slice(0, 40) || 'My theme';
    const existing = list.find((t) => t.name.toLowerCase() === label.toLowerCase());
    const entry = clean({ id: existing ? existing.id : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: label, colors, exact, panels: design.panels, style: design.style });
    if (!entry) return null;
    if (!existing && list.length >= MAX_SAVED) return null;
    store(existing ? list.map((t) => (t.id === existing.id ? entry : t)) : [...list, entry]);
    return entry;
}

/** Gives a saved theme another name. Returns the theme, or null when there is none with that id or another theme already has the name. */
export function renameTheme(id, name) {
    const list = listSavedThemes();
    const label = String(name || '').trim().slice(0, 40);
    const target = list.find((t) => t.id === id);
    if (!target || !label || list.some((t) => t.id !== id && t.name.toLowerCase() === label.toLowerCase())) return null;
    const renamed = { ...target, name: label };
    store(list.map((t) => (t.id === id ? renamed : t)));
    return renamed;
}

export function deleteSavedTheme(id) {
    store(listSavedThemes().filter((t) => t.id !== id));
}

/** callback(list) after every change. Returns unsubscribe(). */
export function watchSavedThemes(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

export const sameColors = (a, b) => CUSTOM_KEYS.every((k) => a[k] === b[k]);
