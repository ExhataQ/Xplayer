// ==============================================================================
// STORAGE SCHEMA
// ==============================================================================
// Read-time validators for the lists and settings the app saves. They are passed to
// storageReadJson(key, fallback, normalize) and turn whatever was stored (older builds,
// hand-edited data, a half-written value) into the shape the code expects: wrong types are
// dropped, missing fields get defaults, and fields they do not know about are kept as they are.
// They never change what is stored; a repaired value only reaches storage when the caller
// saves it again.
//
// Pure functions: no DOM, no storage. This file is an ES module (see "modules" in
// src/manifest.json); classic code gets the names from registerLegacyGlobals below.

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));

// Songs, favorites, pinned items: a list of ids (strings or numbers). Order and repeats stay.
export function normalizeIdList(value) {
    return Array.isArray(value) ? value.filter(isId) : [];
}

// Played-item order, expanded folder keys: a list of strings.
export function normalizeStringList(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

// Recently played, play history, search history: a list of objects.
export function normalizeObjectList(value) {
    return Array.isArray(value) ? value.filter(isPlainObject) : [];
}

// Playlists: { id, name, songs: [id...], ...anything else }. An entry without an id cannot be
// opened or deleted, so it is dropped.
export function normalizePlaylists(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((p) => isPlainObject(p) && isId(p.id)).map((p) => ({
        ...p,
        name: typeof p.name === 'string' ? p.name : p.name == null ? 'Untitled playlist' : String(p.name),
        songs: normalizeIdList(p.songs)
    }));
}

// Folders: { id, name, children: [{ id, type, ...}], ...anything else }.
export function normalizeFolders(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((f) => isPlainObject(f) && isId(f.id)).map((f) => ({
        ...f,
        name: typeof f.name === 'string' ? f.name : f.name == null ? 'Untitled folder' : String(f.name),
        children: Array.isArray(f.children)
            ? f.children.filter((c) => isPlainObject(c) && isId(c.id) && typeof c.type === 'string')
            : []
    }));
}

// Pinned items per folder: { [folderId]: [id...] }.
export function normalizePinnedMap(value) {
    if (!isPlainObject(value)) return {};
    const out = {};
    for (const [folderId, ids] of Object.entries(value)) {
        if (Array.isArray(ids)) out[folderId] = normalizeIdList(ids);
    }
    return out;
}

// Settings objects: a plain object. A key that has a default is kept only if it has the same
// type as that default (a number stays a number), so the default applies otherwise.
export function normalizeSettings(value, defaults = {}) {
    if (!isPlainObject(value)) return {};
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        if (Object.prototype.hasOwnProperty.call(defaults, key) && typeof item !== typeof defaults[key]) continue;
        out[key] = item;
    }
    return out;
}

// Saved panel widths: { left, right }, both positive numbers, or null when unusable.
export function normalizePanelWidths(value) {
    if (!isPlainObject(value)) return null;
    const { left, right } = value;
    const ok = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
    return ok(left) && ok(right) ? value : null;
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        normalizeIdList, normalizeStringList, normalizeObjectList, normalizePlaylists,
        normalizeFolders, normalizePinnedMap, normalizeSettings, normalizePanelWidths
    });
}
