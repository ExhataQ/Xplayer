// ==============================================================================
// BUILD DATA AND LIBRARY
// ==============================================================================
// The saved library comes from songs.json through the main process. Without the desktop bridge
// (a plain browser, the tests) the build's placeholder list is used (player.js, see 99-player.js).
import { desktopApi } from '../api/desktop-api.js';

const buildData = window.__buildData || {};

export const SONGS_DATA = (function () {
    const saved = desktopApi.library.getStartupSongs();
    return Array.isArray(saved) ? saved : Array.isArray(buildData.songs) ? buildData.songs : [];
})();

export const PLACEHOLDER_IMAGE = typeof buildData.placeholderImage === 'string' ? buildData.placeholderImage : '';

// Names other files read by name.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ SONGS_DATA, PLACEHOLDER_IMAGE });
}
