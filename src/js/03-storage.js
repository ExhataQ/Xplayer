// ==============================================================================
// LIST LIMITS
// Reading and writing saved values is core/storage.js; this file only keeps the limits.
// ==============================================================================
// This file is an ES module (listed under "modules" in src/manifest.json). The classic
// scripts that still call these names get them from registerLegacyGlobals at the bottom.
export const MAX_RECENT_SONGS = 50;

export const MAX_HISTORY_ENTRIES = 500;

export const MAX_SEARCH_HISTORY = 20;

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ MAX_RECENT_SONGS, MAX_HISTORY_ENTRIES, MAX_SEARCH_HISTORY });
}
