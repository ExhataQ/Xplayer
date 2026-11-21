// The volume bar that stands up above a speaker icon: a small pill with a vertical bar in it. One component for the whole app: the full app's player
// bar uses it when the window is too narrow for the horizontal bar (views/playback/volume-popover.js), and the Mini Player uses it all the time
// (light/light.js). The one who uses it says where the volume is and how to set it; this draws the pill, places it, and handles the pointer,
// the wheel and the keyboard.
//
//   const pop = createVolumePop({ icon, position: () => 0.4, setPosition: (p) => ..., enabled: () => true });
//   pop.refresh();   // the volume changed somewhere else: repaint (only matters while it is open)
//   pop.destroy();
//
// It opens when the pointer rests on the icon (or the wheel turns over it, or Up or Down is pressed on it), stays while the pointer is on the icon
// or the bar, and closes a moment after it is on neither. A click on the icon is the caller's (mute). `enabled()` says whether it may open now.

import { el } from './dom.js';

const STEP = 0.05;
const KNOB = 12; // the knob's diameter: the rail stops half of it short of each end of the track
const OPEN_DELAY = 60;
const CLOSE_DELAY = 240;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function createVolumePop({ icon, position, setPosition, enabled = () => true }) {
    const fill = el('span', { class: 'volume-pop__fill' });
    const knob = el('span', { class: 'volume-pop__knob' });
    const track = el('div', { class: 'volume-pop__track', role: 'slider', tabindex: '0', 'aria-label': 'Volume', 'aria-orientation': 'vertical', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill, knob);
    const pop = el('div', { class: 'volume-pop', role: 'group', 'aria-label': 'Volume', hidden: true }, track);
    document.body.append(pop);

    let open = false;
    let dragging = false;
    let openTimer = 0;
    let closeTimer = 0;
    const set = (next) => setPosition(clamp01(next));

    function paint() {
        const at = clamp01(position());
        const percent = Math.round(at * 100);
        fill.style.height = `calc((100% - ${KNOB}px) * ${at})`; // the rail stops half a knob short of each end
        knob.style.bottom = `calc(${KNOB / 2}px + (100% - ${KNOB}px) * ${at})`;
        pop.dataset.muted = String(percent === 0);
        track.setAttribute('aria-valuenow', String(percent));
        track.setAttribute('aria-valuetext', percent === 0 ? 'Muted' : `${percent}%`);
    }

    function place() {
        const anchor = icon.getBoundingClientRect();
        const box = pop.getBoundingClientRect();
        const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - box.width / 2), window.innerWidth - box.width - 8);
        pop.style.left = `${Math.round(left)}px`;
        pop.style.top = `${Math.round(Math.max(8, anchor.top - box.height - 6))}px`;
    }

    function show() {
        clearTimeout(closeTimer);
        if (open || !enabled()) return;
        open = true;
        pop.hidden = false;
        paint();
        place();
        icon.setAttribute('aria-expanded', 'true');
    }

    function hide(restoreFocus = false) {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        if (!open) return;
        open = false;
        dragging = false;
        pop.hidden = true;
        icon.removeAttribute('aria-expanded');
        if (restoreFocus) icon.focus({ preventScroll: true });
    }

    // Leaving the icon for the bar (and back) must not close it: it closes a moment after the pointer is on neither, and never mid-drag
    // or while the keyboard is on the bar.
    const keepOpen = () => dragging || track.matches(':focus-visible');
    function scheduleHide() {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => !keepOpen() && hide(), CLOSE_DELAY);
    }
    function scheduleShow() {
        clearTimeout(closeTimer);
        clearTimeout(openTimer);
        openTimer = setTimeout(show, OPEN_DELAY);
    }

    // ---- the icon
    const mouseLike = (event) => event.pointerType !== 'touch';
    icon.addEventListener('pointerenter', (event) => mouseLike(event) && enabled() && scheduleShow());
    icon.addEventListener('pointerleave', (event) => mouseLike(event) && scheduleHide());
    pop.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    pop.addEventListener('pointerleave', scheduleHide);
    icon.addEventListener(
        'wheel',
        (event) => {
            if (!enabled()) return;
            event.preventDefault();
            show();
            set(position() + (event.deltaY < 0 ? STEP : -STEP));
        },
        { passive: false }
    );
    icon.addEventListener('keydown', (event) => {
        if (!enabled() || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        show();
        track.focus({ preventScroll: true });
    });

    // ---- the bar: a press or a drag sets the volume where the pointer is (bottom is silent, top is full)
    function fromPointer(event) {
        const box = track.getBoundingClientRect();
        const run = Math.max(1, box.height - KNOB);
        set(1 - (event.clientY - box.top - KNOB / 2) / run);
    }
    track.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        dragging = true;
        track.setPointerCapture(event.pointerId);
        pop.dataset.dragging = '';
        fromPointer(event);
        event.preventDefault(); // no focus ring after a mouse press: the keyboard reaches the bar from the icon
    });
    track.addEventListener('pointermove', (event) => dragging && fromPointer(event));
    const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        delete pop.dataset.dragging;
        if (!pop.matches(':hover') && !icon.matches(':hover')) scheduleHide();
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener(
        'wheel',
        (event) => {
            event.preventDefault();
            set(position() + (event.deltaY < 0 ? STEP : -STEP));
        },
        { passive: false }
    );
    track.addEventListener('keydown', (event) => {
        const keys = { ArrowUp: STEP, ArrowRight: STEP, ArrowDown: -STEP, ArrowLeft: -STEP, PageUp: 0.1, PageDown: -0.1 };
        if (event.key in keys) set(position() + keys[event.key]);
        else if (event.key === 'Home') set(0);
        else if (event.key === 'End') set(1);
        else if (event.key === 'Escape' || event.key === 'Enter') hide(true);
        else return;
        event.preventDefault();
        event.stopPropagation(); // the player's shortcuts (space, arrows) must not also act
    });
    track.addEventListener('focusout', () => !pop.matches(':hover') && scheduleHide());

    // ---- go away when the person clicks elsewhere, or when the pop-up may not be open any more (the window got wider)
    const onDown = (event) => open && !pop.contains(event.target) && !icon.contains(event.target) && hide();
    const onResize = () => {
        if (!open) return;
        if (enabled()) place();
        else hide();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);

    return {
        refresh: () => open && paint(),
        isOpen: () => open,
        destroy() {
            hide();
            document.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('resize', onResize);
            pop.remove();
        }
    };
}
