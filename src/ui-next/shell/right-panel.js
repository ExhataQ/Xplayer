// The right panel slot (task PA-16, decision DP11): a panel on the right of the main view that PUSHES the list narrower. It shows
// lyrics mostly, with the big cover (Agent C builds the content, PC-13); this file is the slot and its behavior only.
//
//   registerRightPanel({ label?, mount(body, controls) -> { show?(), hide?() } })   one provider; until one registers, the slot and its
//       title bar button do not exist. `mount` runs the first time the panel is shown; show and hide run on each change.
//   mountRightPanelSlot({ host, button }) -> { open(), close(), toggle(), isOpen() }   shell.js calls this once.
//
// Two switches, given to the provider as `controls` (the provider draws the buttons, inside its lyrics box):
//   lyrics only  same width, the provider hides its cover and track info (remembered)
//   full         the panel covers the whole app below the title bar and above the player, lyrics only (not remembered)
//   controls = { state() -> { lyricsOnly, full }, setLyricsOnly(on), setFull(on), onChange(callback) -> stop }
// Behavior: width 280 to 420 (default 320), dragged by its left edge or with the arrow keys, saved. The list always keeps
// Its width and whether it shows are decided in shell/panel-layout.js (PA-19): when the window is narrow, the left panel steps aside
// for it by default; opening the left panel puts it in the right panel's place, and opening the right one takes it back.
import { iconButton, iconEl } from '../components/index.js';
import { RIGHT, setSaved, setWanted, noteOpened, shownWidth, onLayout } from './panel-layout.js';

const KEY_OPEN = 'xplayer.ui-next.right-open';
const KEY_WIDTH = 'xplayer.ui-next.right-width';
const KEY_LYRICS_ONLY = 'xplayer.ui-next.right-lyrics-only';
export const DEFAULT_WIDTH = 320;
export const MIN_WIDTH = RIGHT.min;
export const MAX_WIDTH = RIGHT.max;
const STEP = 16;

let provider = null;
const listeners = new Set(); // paint() of the mounted slot, run when a provider registers

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
    let lyricsOnly = read(KEY_LYRICS_ONLY, 'false') === 'true';
    let full = false;
    const changeListeners = new Set();
    let mounted = null;

    // The widths and which panel shows are decided in shell/panel-layout.js (PA-19): the right panel shows unless the layout disables it.
    const width = () => shownWidth('right');
    const visible = () => Boolean(provider) && savedOpen && !document.documentElement.hasAttribute('data-right-disabled');

    const toggle = iconButton({ icon: 'panel-right', label: 'Right panel', size: 'sm', pressed: false, className: 'right-panel-btn', onClick: () => api.toggle() });
    toggle.hidden = true;
    anchor.after(toggle); // after the bell: the panel button is the last tool, next to the window buttons

    const handle = document.createElement('div');
    handle.className = 'right-resizer';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize right panel');
    handle.setAttribute('aria-valuemin', String(MIN_WIDTH));
    host.append(handle);

    // Draws what the layout decided. It does not change the layout, so the layout can call it.
    function syncRight() {
        const show = visible();
        host.hidden = !show;
        if (!show) full = false;
        host.dataset.mode = full ? 'full' : lyricsOnly ? 'lyrics' : 'normal';
        handle.hidden = full;
        document.documentElement.toggleAttribute('data-right-full', full); // the title bar's line follows (shell/shell.css)
        toggle.setAttribute('aria-pressed', String(show));
        toggle.replaceChildren(iconEl(show ? 'panel-right-filled' : 'panel-right', { size: 18 })); // open: the right window is filled, in the normal text color (not the accent)
        handle.setAttribute('aria-valuenow', String(width()));
        handle.setAttribute('aria-valuemax', String(MAX_WIDTH));
        if (show && !mounted) mounted = provider.mount(body, controls) || {};
        else if (mounted) (show ? mounted.show : mounted.hide)?.();
    }

    // Tells the layout what the person wants, then draws the result.
    function paint() {
        toggle.hidden = !provider;
        setWanted('right', Boolean(provider) && savedOpen);
        syncRight();
    }

    const api = {
        isOpen: visible,
        open() {
            savedOpen = true;
            write(KEY_OPEN, true);
            noteOpened('right'); // in a narrow window the right panel takes the left one's place
            paint();
        },
        close() {
            savedOpen = false;
            write(KEY_OPEN, false);
            paint();
        },
        toggle() {
            if (visible()) api.close();
            else api.open();
        }
    };

    const controls = {
        state: () => ({ lyricsOnly, full }),
        setLyricsOnly(on) {
            lyricsOnly = Boolean(on);
            write(KEY_LYRICS_ONLY, lyricsOnly);
            paint();
            changeListeners.forEach((fn) => fn());
        },
        setFull(on) {
            full = Boolean(on) && visible();
            paint();
            changeListeners.forEach((fn) => fn());
        },
        onChange(callback) {
            changeListeners.add(callback);
            return () => changeListeners.delete(callback);
        }
    };
    const setWidth = (value) => {
        savedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(value)));
        write(KEY_WIDTH, savedWidth);
        setSaved('right', savedWidth); // the layout clamps it to what the window can spare, and draws
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
        if (event.key === 'Escape' && full && !event.defaultPrevented) {
            event.stopPropagation();
            controls.setFull(false);
            return;
        }
    });

    onLayout(syncRight); // the layout changes with the window and with the left panel: draw the right panel again
    listeners.add(paint);
    setSaved('right', savedWidth);
    paint();
    return api;
}
