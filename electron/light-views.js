// The two views of the light window and the arithmetic around them, in plain Node so tools/tests/electron/light-views.test.js can run it.
//   mini  : the Mini Player, a square window that shows the cover edge to edge; it can be resized but keeps its shape
//   quick : the Quick Player, a larger window that works like an app: it can be resized and maximized
// electron/window-manager.js owns the window; this file only knows sizes and positions.

const VIEWS = {
    mini: { width: 360, height: 360, minWidth: 280, minHeight: 280, maxWidth: 720, maxHeight: 720, resizable: true, maximizable: false, aspectRatio: 1 },
    quick: { width: 1040, height: 700, minWidth: 760, minHeight: 540, resizable: true, maximizable: true, aspectRatio: 0 } // aspectRatio 0: free
};
const MAX_SIZE = 4000;

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

// The saved window state, with anything that is not a sensible number left out.
function normalizeState(raw) {
    const state = raw && typeof raw === 'object' ? raw : {};
    const size = (value, min, max = MAX_SIZE) => {
        const n = finite(value);
        return n === undefined ? undefined : Math.min(max, Math.max(min, Math.round(n)));
    };
    return {
        x: finite(state.x),
        y: finite(state.y),
        pinned: state.pinned === true,
        maximized: state.maximized === true,
        miniSize: size(state.miniSize, VIEWS.mini.minWidth, VIEWS.mini.maxWidth),
        quickWidth: size(state.quickWidth, VIEWS.quick.minWidth),
        quickHeight: size(state.quickHeight, VIEWS.quick.minHeight)
    };
}

// The size a view opens at: each view remembers the size it was left at (the Mini Player is always a square).
function sizeFor(view, state) {
    const spec = VIEWS[view];
    if (!spec) return null;
    if (view === 'quick') return { width: (state && state.quickWidth) || spec.width, height: (state && state.quickHeight) || spec.height };
    const side = (state && state.miniSize) || spec.width;
    return { width: side, height: side };
}

// `bounds` moved (and made smaller if it must be) so it lies inside `area` (a display's work area).
function fitInto(bounds, area) {
    const width = Math.min(bounds.width, area.width);
    const height = Math.min(bounds.height, area.height);
    const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - width);
    const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - height);
    return { x, y, width, height };
}

// Whether a screen point (the pointer) is inside a window's bounds. The light page asks the main process for this because a frameless
// window's drag areas do not give the page any mouse events, so its own :hover would never show the controls over them.
function pointInside(point, bounds) {
    return Boolean(point && bounds) && point.x >= bounds.x && point.y >= bounds.y && point.x < bounds.x + bounds.width && point.y < bounds.y + bounds.height;
}

module.exports = { VIEWS, normalizeState, sizeFor, fitInto, pointInside };
