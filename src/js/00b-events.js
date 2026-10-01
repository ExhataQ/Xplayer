// ==============================================================================
// APP EVENT BUS
// ==============================================================================
// The seam between core/logic code and UI/rendering code. Core code (storage,
// playback, search, etc.) should emit an event when something changes instead of
// calling a render function directly; UI code subscribes and does the actual DOM
// work. This is what lets a different UI layer (the playground, eventually a
// rebuilt main UI) reuse the same core without any changes to it.
//
// Uses the platform's own EventTarget/CustomEvent rather than a custom
// implementation - no dependency to carry into a UI Playground, and it's a global
// available in both the Electron renderer and plain Node (used directly by
// tools/tests/*.test.js without any DOM/jsdom setup).
//
// emit(name, detail) fires the event. on(name, handler) subscribes and returns an
// unsubscribe function. handler receives the CustomEvent; the payload is
// event.detail, not the event itself, so most handlers only need
// `on('x', (e) => { ...e.detail... })`.
const appEvents = new EventTarget();

function emit(name, detail) {
    appEvents.dispatchEvent(new CustomEvent(name, { detail }));
}

function on(name, handler) {
    appEvents.addEventListener(name, handler);
    return () => appEvents.removeEventListener(name, handler);
}
