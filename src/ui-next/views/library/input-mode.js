// Input mode (task PB-12): which kind of input the person used last, on <html data-input="pointer|keyboard">.
// Chromium shows :focus-visible on a focused element after ANY key, so a row clicked with the mouse got the selection ring when
// Space (play or pause) was pressed. The list styles its ring for data-input="keyboard" only. Only keys that move focus switch to
// keyboard: Tab and Shift+Tab, the arrows, Home, End, Page Up and Page Down. Space and Enter do not, so they leave the mode as it was.
// Tab keeps its ring; a click removes it.

const MOVES_FOCUS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

/** Starts tracking. Returns a function that stops it and removes the flag. */
export function trackInputMode(root = document.documentElement, target = window) {
    const set = (mode) => {
        root.dataset.input = mode;
    };
    const onPointer = () => set('pointer');
    const onKey = (event) => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (MOVES_FOCUS.has(event.key)) set('keyboard');
    };
    target.addEventListener('pointerdown', onPointer, true);
    target.addEventListener('keydown', onKey, true);
    return () => {
        target.removeEventListener('pointerdown', onPointer, true);
        target.removeEventListener('keydown', onKey, true);
        delete root.dataset.input;
    };
}
