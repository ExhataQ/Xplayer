// ==============================================================================
// STORAGE
// ==============================================================================
// The only place that touches localStorage. Keys are the STORAGE_KEYS values from
// 00-state.js, passed in by the caller; stored values keep the exact format they always had
// (plain strings, 'true'/'false' for booleans, JSON text for objects and lists), so data saved
// by older builds still loads.
//
// This is a classic script loaded BEFORE 00-state.js, because 00-state.js and 01-sizes.js
// read saved values while they load. It must not use anything from another file.
//
// Contract
//   storageRead(key, fallback = null)       the stored string, or `fallback` when the key is
//                                           missing or storage cannot be read
//   storageWrite(key, value)                stores String(value); returns true or false
//   storageRemove(key)                      returns true or false
//   storageReadBool(key, fallback = false)  'true' -> true, 'false' -> false, anything else -> fallback
//   storageWriteBool(key, value)            stores 'true' or 'false'; returns true or false
//   storageReadJson(key, fallback, normalize)
//                                           parsed value, or `fallback` when the key is missing,
//                                           empty or not valid JSON. `normalize(parsed)` (optional)
//                                           may repair or filter the value; if it throws or
//                                           returns undefined, `fallback` is returned.
//   storageWriteJson(key, value)            stores JSON.stringify(value); returns true or false
//
// Nothing here throws. A failed write (quota, storage disabled) returns false and logs a
// warning; callers that need the data to survive can check the result. Reads never change what
// is stored: a repaired value is only written back when the caller saves it.
// Validators for the saved lists and settings are in storage-schema.js.

function storageRead(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);
        return value === null || value === undefined ? fallback : value;
    } catch (e) {
        return fallback;
    }
}

function storageWrite(key, value) {
    try {
        localStorage.setItem(key, String(value));
        return true;
    } catch (e) {
        console.warn('[storage] could not save "' + key + '":', e);
        return false;
    }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.warn('[storage] could not remove "' + key + '":', e);
        return false;
    }
}

function storageReadBool(key, fallback = false) {
    const value = storageRead(key);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

function storageWriteBool(key, value) {
    return storageWrite(key, value ? 'true' : 'false');
}

function storageReadJson(key, fallback, normalize) {
    const saved = storageRead(key);
    if (!saved) return fallback;
    try {
        const parsed = JSON.parse(saved);
        if (typeof normalize !== 'function') return parsed;
        const normalized = normalize(parsed);
        return normalized === undefined ? fallback : normalized;
    } catch (e) {
        return fallback;
    }
}

function storageWriteJson(key, value) {
    try {
        return storageWrite(key, JSON.stringify(value));
    } catch (e) {
        console.warn('[storage] could not serialise "' + key + '":', e);
        return false;
    }
}
