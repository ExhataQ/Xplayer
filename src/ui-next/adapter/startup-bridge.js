// startup-bridge (task A-09): the saved startup background, read before the engine has loaded.
//
// The startup view is the first thing on screen, so it cannot wait for the engine's own getStartupBackground(). The engine stores the
// choice as a plain string in localStorage (core/storage.js storageWrite). The key must match STORAGE_KEYS.STARTUP_BACKGROUND in
// js/core/00-state.js; tools/tests/ui-next-startup-wiring.test.js fails if they drift.

export const STARTUP_BACKGROUND_KEY = 'startupBackground';

/** The saved choice ('vinyl', 'random', ...), or null when none is saved or storage is unavailable. Not validated here. */
export function readStartupPreference() {
    try {
        return localStorage.getItem(STARTUP_BACKGROUND_KEY);
    } catch (_) {
        return null;
    }
}
