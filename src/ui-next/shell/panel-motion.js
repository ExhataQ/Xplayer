// Panels that slide in (task C8). The left panel, the right panel and the queue move in from their own edge when the person opens them, and
// the view beside them shifts a few pixels instead of jumping. Closing has no animation: the panel is gone at once. Only transform and
// opacity move (shell/motion.css).
//
//   slidePanel(node, kind, show, apply)
//       `kind`: 'left', 'right' or 'up' (the queue drawer, which rises from the player). `show`: true to open, false to close.
//       `apply(show)`: the caller's own way of showing or hiding the panel (the hidden attribute, data-closed). It always runs at once.
//   The motion plays only for the person's own opening: not at start-up, not when the window's size decides, and never when
//   Reduce animations is on (components/motion.js), where the change is immediate as before.

import { reducedMotion } from '../components/motion.js';

export const ENTER_MS = 200;
const SHIFT_MS = 220;

let armed = false; // the first press or key: until then nothing is the person's doing, so the opening of the app stays still
if (typeof document !== 'undefined') {
    const arm = () => {
        armed = true;
        document.removeEventListener('pointerdown', arm, true);
        document.removeEventListener('keydown', arm, true);
    };
    document.addEventListener('pointerdown', arm, true);
    document.addEventListener('keydown', arm, true);
}

const timers = new WeakMap(); // node -> the timer that ends the slide in
const clear = (node) => {
    clearTimeout(timers.get(node));
    timers.delete(node);
    delete node.dataset.enter;
};

// Where the view's content starts when the panel opens: the left panel pushes it to the right, the right panel to the left, and it
// settles into its place. Closing a panel does not move it.
const SHIFT = { left: 'right', right: 'left' };

function shiftView(kind) {
    const direction = SHIFT[kind];
    const view = typeof document === 'undefined' ? null : document.querySelector('.view-host');
    if (!direction || !view) return;
    view.dataset.shift = direction;
    clearTimeout(view._shiftTimer);
    view._shiftTimer = setTimeout(() => delete view.dataset.shift, SHIFT_MS);
}

export function slidePanel(node, kind, show, apply) {
    clear(node);
    const shownNow = node.getClientRects().length > 0;
    apply(show);
    if (!show || !armed || reducedMotion() || shownNow) return;
    node.dataset.enter = kind;
    shiftView(kind);
    timers.set(node, setTimeout(() => delete node.dataset.enter, ENTER_MS));
}
