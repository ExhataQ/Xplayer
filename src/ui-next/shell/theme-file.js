// A theme as a file (Settings, Appearance: "Save as file" and "Load from file"). Pure functions, no DOM.
// A theme file is plain JSON the person may have got from anyone, so it is untrusted input. Nothing in it is used as it is: the four
// colors must be hex codes, the name is cut to plain text, and the panels and the style go through the same whitelist as a saved theme
// (shell/theme-design.js: hex colors, whole numbers and fixed words only). Anything else is dropped; a file that is not a theme, is too
// big or is made by a newer version is refused with a message and changes nothing. No value of a file ever becomes CSS or script text
// except through designCss(), which only writes what that whitelist let through.
import { CUSTOM_KEYS, isHex } from './theme-math.js';
import { normalizePanels, normalizeStyle } from './theme-design.js';

export const THEME_FILE_APP = 'xplayer-theme';
export const THEME_FILE_VERSION = 1;
export const MAX_THEME_FILE_BYTES = 64 * 1024; // a theme is well under 2 KB; anything near this is not one
export const MAX_NAME = 40;

/** Plain text for a name: control characters and line breaks out, spaces collapsed, cut to MAX_NAME. */
export const cleanName = (value) => String(typeof value === 'string' ? value : '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

/** theme: { name, colors, exact, panels, style } -> the text of the file. */
export function themeFileText(theme) {
    return JSON.stringify(
        {
            app: THEME_FILE_APP,
            version: THEME_FILE_VERSION,
            name: cleanName(theme.name) || 'My theme',
            colors: Object.fromEntries(CUSTOM_KEYS.map((k) => [k, theme.colors[k]])),
            exact: theme.exact === true,
            panels: normalizePanels(theme.panels),
            style: normalizeStyle(theme.style)
        },
        null,
        2
    );
}

/** A safe file name for a theme: letters, digits and dashes. */
export const themeFileName = (name) => `${cleanName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'theme'}.xplayer-theme.json`;

const refuse = (message) => ({ ok: false, message });

/** text -> { ok: true, theme: { name, colors, exact, panels, style } } or { ok: false, message }. Never throws. */
export function parseThemeFile(text) {
    if (typeof text !== 'string') return refuse('That file could not be read.');
    if (text.length > MAX_THEME_FILE_BYTES) return refuse('That file is too big to be a theme.');
    let raw;
    try {
        raw = JSON.parse(text);
    } catch (_) {
        return refuse('That file is not a theme file (it is not valid JSON).');
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.app !== THEME_FILE_APP) return refuse('That file is not an Xplayer theme file.');
    if (!Number.isInteger(raw.version) || raw.version < 1) return refuse('That theme file has no valid version.');
    if (raw.version > THEME_FILE_VERSION) return refuse('That theme was made by a newer version of Xplayer. Update the app to use it.');
    const colors = raw.colors;
    if (!colors || typeof colors !== 'object' || !CUSTOM_KEYS.every((k) => isHex(colors[k]))) return refuse('That theme file does not have its four colors (background, panels, text and accent) as hex codes.');
    return {
        ok: true,
        theme: {
            name: cleanName(raw.name) || 'Loaded theme',
            colors: Object.fromEntries(CUSTOM_KEYS.map((k) => [k, colors[k].toLowerCase()])),
            exact: raw.exact === true,
            panels: normalizePanels(raw.panels),
            style: normalizeStyle(raw.style)
        }
    };
}

/** `name` if no name in `taken` equals it (ignoring case), else "name (2)", "name (3)" and so on, kept within MAX_NAME. */
export function uniqueName(name, taken) {
    const used = new Set(taken.map((t) => String(t).toLowerCase()));
    const base = cleanName(name) || 'Loaded theme';
    if (!used.has(base.toLowerCase())) return base;
    for (let n = 2; n < 1000; n++) {
        const suffix = ` (${n})`;
        const candidate = base.slice(0, MAX_NAME - suffix.length) + suffix;
        if (!used.has(candidate.toLowerCase())) return candidate;
    }
    return base;
}
