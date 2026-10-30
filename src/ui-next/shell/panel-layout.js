// The two side panels' widths and which one is shown (PA-19). One place decides, so the left panel and the right panel never disagree.
//
// Shrinking the window, in this order (growing the window runs the same steps backwards):
//   1. the panels shrink, toward their minimums, while the view keeps VIEW_COMFORT (a comfortable width, about the old screen's narrow limit);
//   2. the panels are at their minimums: now the view shrinks, down to VIEW_MIN;
//   3. the view is at VIEW_MIN and two panels no longer fit: one steps aside (disabled, not closed). By default the right panel stays
//      open and the left steps aside; when the person opens the left panel, it takes the right panel's place instead, and opening the
//      right panel takes it back. A panel that stepped aside comes back when there is room, and the default returns with it.
// So growing the window widens the view first, up to VIEW_COMFORT, and only then the panels.
//
// Usage: panels report what they want (setWanted) and their saved width (setSaved), and layoutNow() writes the result:
//   --panel-width, --right-width (px), and the root attributes data-left-disabled / data-right-disabled.

export const LEFT = { min: 240, max: 560 };
export const RIGHT = { min: 280, max: 420 };
export const VIEW_MIN = 420; // the view never gets narrower than this
export const VIEW_COMFORT = 640; // the panels give up room first, until the view is this wide (the old screen's narrow limit was 610)
const RAIL_FALLBACK = 68;

const railWidth = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-width')) || RAIL_FALLBACK;
const within = (saved, spec) => Math.round(Math.max(spec.min, Math.min(spec.max, saved)));

const state = {
    left: { wanted: true, saved: 340 },
    right: { wanted: false, saved: 320 },
    lastOpened: 'right',
    result: null
};
const listeners = new Set();

/** The pure arithmetic: which panels show, and their widths, for the room `available` (window width minus the rail). */
export function arrange({ available, left, right, lastOpened = 'right' }) {
    let l = Boolean(left.wanted);
    let r = Boolean(right.wanted);
    const specs = [];
    if (l) specs.push({ side: 'left', spec: LEFT, saved: within(left.saved, LEFT) });
    if (r) specs.push({ side: 'right', spec: RIGHT, saved: within(right.saved, RIGHT) });
    const sumMin = specs.reduce((n, p) => n + p.spec.min, 0);
    const widths = (list) => {
        const sumSaved = list.reduce((n, p) => n + p.saved, 0);
        const room = available - VIEW_COMFORT; // what the panels may take while the view keeps its comfortable width
        const out = {};
        if (room >= sumSaved) for (const p of list) out[p.side] = p.saved;
        else if (room >= list.reduce((n, p) => n + p.spec.min, 0)) {
            const cut = sumSaved - room; // shared by how far each panel is above its minimum
            const excess = list.reduce((n, p) => n + p.saved - p.spec.min, 0);
            let used = 0;
            list.forEach((p, i) => {
                out[p.side] = i === list.length - 1 ? Math.round(room - used) : Math.round(p.saved - (cut * (p.saved - p.spec.min)) / excess);
                used += out[p.side];
            });
        } else for (const p of list) out[p.side] = p.spec.min; // the view is what shrinks now
        return out;
    };
    let result = widths(specs);
    if (specs.length === 2 && available - sumMin < VIEW_MIN) {
        // not even both minimums fit beside the view's minimum: the panel opened last stays (the right one, unless the left was opened)
        const keep = lastOpened === 'left' ? 'left' : 'right';
        l = keep === 'left';
        r = keep === 'right';
        result = widths(specs.filter((p) => p.side === keep));
    }
    return { left: { shown: l, width: l ? result.left : 0 }, right: { shown: r, width: r ? result.right : 0 } };
}

/** Recomputes the layout from the current state and writes it to the page. Returns the result. */
export function layoutNow() {
    const root = document.documentElement;
    const leftHost = document.querySelector('.panel-host');
    // The left panel is wanted when the shell has not closed it (data-closed) and the shell has a panel to show.
    const left = { wanted: Boolean(leftHost) && !leftHost.hasAttribute('data-closed'), saved: state.left.saved };
    const available = window.innerWidth - railWidth();
    const result = arrange({ available, left, right: state.right, lastOpened: state.lastOpened });
    if (result.left.shown && result.right.shown) state.lastOpened = 'right'; // both fit: the default (right stays) returns
    state.result = result;
    root.style.setProperty('--panel-width', `${result.left.width || within(state.left.saved, LEFT)}px`);
    root.style.setProperty('--right-width', `${result.right.width || within(state.right.saved, RIGHT)}px`);
    root.toggleAttribute('data-left-disabled', left.wanted && !result.left.shown); // the CSS hides the left panel
    root.toggleAttribute('data-right-disabled', state.right.wanted && !result.right.shown);
    for (const fn of listeners) fn(result);
    return result;
}

export const setSaved = (side, value) => {
    state[side].saved = value;
    return layoutNow();
};
export const setWanted = (side, value) => {
    state[side].wanted = Boolean(value);
    return layoutNow();
};
/** The side the person opened last: in a window too narrow for both, that panel keeps its place. */
export const noteOpened = (side) => {
    state.lastOpened = side;
};
/** The person chose the left panel (a rail click): in a window too narrow for both it takes the right panel's place. */
export const openLeft = () => {
    state.lastOpened = 'left';
    return layoutNow();
};
/** The width a panel is showing at now (its saved width if it is not shown). */
export const shownWidth = (side) => {
    const r = state.result ? state.result[side] : null;
    return r && r.shown ? r.width : within(state[side].saved, side === 'left' ? LEFT : RIGHT);
};
export const onLayout = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

// The window and the left panel's own open or closed state (the shell sets data-closed) drive the layout.
let watching = null;
export function watchLayout(leftPanel) {
    if (!watching) {
        window.addEventListener('resize', layoutNow);
        watching = new MutationObserver(() => {
            if (!leftPanel.hasAttribute('data-closed')) noteOpened('left'); // the person opened the left panel
            layoutNow();
        });
        if (leftPanel) watching.observe(leftPanel, { attributes: true, attributeFilter: ['data-closed'] });
    }
    return layoutNow();
}
