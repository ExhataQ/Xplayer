// Drag handle on the library panel's right edge (task A-10). The width is the user's choice, saved. What is shown is decided in
// shell/panel-layout.js (PA-19), which keeps the view at its minimum and steps a side panel aside when the window is too narrow.
// Keyboard: Left and Right move it by 16 px, Home and End jump to the limits, Enter or a double click resets it.

import { LEFT, setSaved, shownWidth, watchLayout } from './panel-layout.js';

const KEY = 'xplayer.ui-next.panel-width';
export const DEFAULT_WIDTH = 340;
export const MIN_WIDTH = LEFT.min;
export const MAX_WIDTH = LEFT.max;
const STEP = 16;

const clamp = (value) => Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value)));

function read() {
    try {
        const value = Number(localStorage.getItem(KEY));
        return value >= MIN_WIDTH && value <= MAX_WIDTH ? value : DEFAULT_WIDTH;
    } catch (_) {
        return DEFAULT_WIDTH;
    }
}

function write(value) {
    try {
        localStorage.setItem(KEY, String(value));
    } catch (_) {
        /* the panel opens at its default width next time */
    }
}

export function buildPanelResizer(panel) {
    let saved = read();
    const handle = document.createElement('div');
    handle.className = 'panel-resizer';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize panel');
    handle.setAttribute('aria-valuemin', String(MIN_WIDTH));
    panel.append(handle);

    // The saved width is the choice; the layout decides what is shown, so widening the window brings the choice back.
    function paint() {
        setSaved('left', saved);
        handle.setAttribute('aria-valuenow', String(shownWidth('left')));
        handle.setAttribute('aria-valuemax', String(MAX_WIDTH));
    }
    const set = (value) => {
        saved = clamp(value);
        write(saved);
        paint();
    };

    handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = shownWidth('left');
        handle.setPointerCapture(event.pointerId);
        handle.dataset.dragging = '';
        const move = (e) => set(startWidth + e.clientX - startX);
        const end = () => {
            delete handle.dataset.dragging;
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    });
    handle.addEventListener('keydown', (event) => {
        const now = shownWidth('left');
        const next = { ArrowLeft: now - STEP, ArrowRight: now + STEP, Home: MIN_WIDTH, End: MAX_WIDTH, Enter: DEFAULT_WIDTH }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        set(next);
    });
    handle.addEventListener('dblclick', () => set(DEFAULT_WIDTH));
    watchLayout(panel); // PA-19: the layout follows the window's size and this panel's open state
    paint();
    return handle;
}
