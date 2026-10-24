// The right panel slot (task PA-16, decision DP11): a panel on the right of the main view that PUSHES the list narrower. It shows
// lyrics mostly, with the big cover (Agent C builds the content, PC-13); this file is the slot and its behavior only.
//
//   registerRightPanel({ label?, mount(body) -> { show?(), hide?() } })   one provider; until one registers, the slot and its
//       title bar button do not exist. `mount` runs the first time the panel is shown; show and hide run on each change.
//   mountRightPanelSlot({ host, button }) -> { open(), close(), toggle(), isOpen() }   shell.js calls this once.
//
// Behavior: width 280 to 420 (default 320), dragged by its left edge or with the arrow keys, saved. The list always keeps
// MIN_LIST px. When the window cannot spare that, the panel is not shown (the saved choice is kept and comes back when the window
// widens); the button then opens it as an overlay on top of the list, until the window changes size class.
import { iconButton } from '../components/index.js';

const KEY_OPEN = 'xplayer.ui-next.right-open';
const KEY_WIDTH = 'xplayer.ui-next.right-width';
export const DEFAULT_WIDTH = 320;
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 420;
const MIN_LIST = 420;
const railWidth = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-width')) || 68; // the token, so a wider rail never squeezes the view
const STEP = 16;

let provider = null;
const listeners = new Set();

export function registerRightPanel(spec) {
    if (typeof spec?.mount !== 'function') throw new Error('registerRightPanel needs a mount function');
    provider = spec;
    for (const fn of listeners) fn();
}

const read = (key, fallback) => {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (_) {
        return fallback;
    }
};
const write = (key, value) => {
    try {
        localStorage.setItem(key, String(value));
    } catch (_) {
        /* the choice lasts until the page closes */
    }
};

export function mountRightPanelSlot({ host, button: anchor, leftPanel }) {
    const body = host.querySelector('.right-host__body');
    let savedOpen = read(KEY_OPEN, 'false') === 'true';
    let savedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(read(KEY_WIDTH, DEFAULT_WIDTH)) || DEFAULT_WIDTH));
    let overlayOpen = false; // the person opened it in a window too small to push the list
    let mounted = null;
    let wasFitting = true;

    const leftWidth = () => (leftPanel && !leftPanel.hidden && getComputedStyle(leftPanel).display !== 'none' ? leftPanel.getBoundingClientRect().width : 0);
    const room = () => window.innerWidth - railWidth() - leftWidth() - MIN_LIST; // what the right panel may take without squeezing the list
    const width = () => Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, savedWidth, Math.max(MIN_WIDTH, room()))));
    const fits = () => room() >= MIN_WIDTH;

    const toggle = iconButton({ icon: 'panel-right', label: 'Right panel', size: 'sm', pressed: false, onClick: () => api.toggle() });
    toggle.hidden = true;
    anchor.before(toggle);

    const handle = document.createElement('div');
    handle.className = 'right-resizer';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize right panel');
    handle.setAttribute('aria-valuemin', String(MIN_WIDTH));
    host.append(handle);

    const visible = () => Boolean(provider) && (fits() ? savedOpen : overlayOpen);

    function paint() {
        const has = Boolean(provider);
        toggle.hidden = !has;
        const show = visible();
        const overlay = show && !fits();
        host.hidden = !show;
        host.toggleAttribute('data-overlay', overlay);
        document.documentElement.style.setProperty('--right-width', `${width()}px`);
        toggle.setAttribute('aria-pressed', String(show));

        handle.setAttribute('aria-valuenow', String(width()));
        handle.setAttribute('aria-valuemax', String(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, room()))));
        if (show && !mounted) mounted = provider.mount(body) || {};
        else if (mounted) (show ? mounted.show : mounted.hide)?.();
    }

    const api = {
        isOpen: visible,
        open() {
            if (fits()) {
                savedOpen = true;
                write(KEY_OPEN, true);
            } else overlayOpen = true;
            paint();
        },
        close() {
            if (fits()) {
                savedOpen = false;
                write(KEY_OPEN, false);
            } else overlayOpen = false;
            paint();
        },
        toggle() {
            if (visible()) api.close();
            else api.open();
        }
    };

    const setWidth = (value) => {
        savedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(value)));
        write(KEY_WIDTH, savedWidth);
        paint();
    };
    handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const start = width();
        handle.setPointerCapture(event.pointerId);
        handle.dataset.dragging = '';
        const move = (e) => setWidth(start - (e.clientX - startX)); // the handle is on the left edge: dragging left widens
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
        const now = width();
        const next = { ArrowLeft: now + STEP, ArrowRight: now - STEP, Home: MIN_WIDTH, End: MAX_WIDTH, Enter: DEFAULT_WIDTH }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        setWidth(next);
    });
    handle.addEventListener('dblclick', () => setWidth(DEFAULT_WIDTH));
    host.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && host.hasAttribute('data-overlay')) {
            event.stopPropagation();
            api.close();
            toggle.focus();
        }
    });

    const onSize = () => {
        const nowFits = fits();
        if (nowFits !== wasFitting) overlayOpen = false; // a new size class starts from the saved choice
        wasFitting = nowFits;
        paint();
    };
    window.addEventListener('resize', onSize);
    if (leftPanel && typeof ResizeObserver === 'function') new ResizeObserver(onSize).observe(leftPanel);
    listeners.add(onSize);
    wasFitting = fits();
    paint();
    return api;
}
