// Drag handle on the library panel's right edge (task A-10). The width is the user's choice, saved, and kept inside what the window
// can spare: the view always keeps at least MIN_VIEW px. Keyboard: Left and Right move it by 16 px, Home and End jump to the limits,
// Enter or a double click resets it. It is hidden while the panel is collapsed.

const KEY = 'xplayer.ui-next.panel-width';
export const DEFAULT_WIDTH = 300;
export const MIN_WIDTH = 240;
export const MAX_WIDTH = 480;
const MIN_VIEW = 420;
const RAIL = 56;
const STEP = 16;

const limit = () => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - RAIL - MIN_VIEW));
const clamp = (value) => Math.round(Math.max(MIN_WIDTH, Math.min(limit(), value)));

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

    // The saved width is the choice; a small window only limits what is shown, so widening it brings the choice back.
    function paint() {
        const shown = clamp(saved);
        document.documentElement.style.setProperty('--panel-width', `${shown}px`);
        handle.setAttribute('aria-valuenow', String(shown));
        handle.setAttribute('aria-valuemax', String(limit()));
        handle.hidden = panel.dataset.panel === 'compact';
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
        const startWidth = clamp(saved);
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
        const now = clamp(saved);
        const next = { ArrowLeft: now - STEP, ArrowRight: now + STEP, Home: MIN_WIDTH, End: MAX_WIDTH, Enter: DEFAULT_WIDTH }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        set(next);
    });
    handle.addEventListener('dblclick', () => set(DEFAULT_WIDTH));
    window.addEventListener('resize', paint);
    new MutationObserver(paint).observe(panel, { attributes: true, attributeFilter: ['data-panel'] });
    paint();
    return handle;
}
