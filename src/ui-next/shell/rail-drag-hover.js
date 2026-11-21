// Polish A6: while something is being dragged (a song row, or files from Windows), resting it over a rail item opens that item after a
// short delay, so a song can be carried to the left panel's playlists, or to another page, in one drag.
//
//   createRailDragHover({ delay, isCurrent, select, setTimer, clearTimer })
//     hover(id)   the dragged item is over rail item `id` (null: over none). Calls select(id) once the item has been under it for
//                 `delay` ms, unless isCurrent(id): choosing the page that is showing would only close its panel.
//     end()       the drag ended
//   installRailDragHover({ select, isCurrent })   listens on the document; the caller says what choosing an item means.

export const RAIL_HOVER_DELAY_MS = 450;

export function createRailDragHover({ delay = RAIL_HOVER_DELAY_MS, isCurrent = () => false, select, setTimer = setTimeout, clearTimer = clearTimeout, onTarget = () => {} }) {
    let over = null; // the item the drag rests on
    let timer = null;

    const stop = () => {
        if (timer !== null) clearTimer(timer);
        timer = null;
    };

    function hover(id) {
        if (id === over) return;
        stop();
        over = id;
        onTarget(id);
        if (id === null || isCurrent(id)) return;
        timer = setTimer(() => {
            timer = null;
            if (over === id && !isCurrent(id)) select(id);
        }, delay);
    }

    return { hover, end: () => hover(null), pending: () => timer !== null };
}

const dragging = () => document.body.classList.contains('dragging-song') || document.body.classList.contains('dragging-files');

export function installRailDragHover({ select, isCurrent }) {
    let lit = null;
    const controller = createRailDragHover({
        select,
        isCurrent,
        onTarget: (id) => {
            if (lit) lit.classList.remove('drag-over');
            lit = id ? document.querySelector(`.rail-btn[data-view="${id}"]`) : null;
            if (lit && !isCurrent(id)) lit.classList.add('drag-over');
        }
    });
    const railItemAt = (event) => {
        // The song drag's ghost may sit under the pointer: ask for the element at the point, not the event's target.
        const node = document.elementFromPoint(event.clientX, event.clientY) || event.target;
        return node && node.closest ? node.closest('.rail-btn') : null;
    };
    const move = (event) => {
        if (!dragging()) return controller.end();
        const button = railItemAt(event);
        controller.hover(button ? button.dataset.view : null);
    };
    for (const type of ['mousemove', 'dragover']) window.addEventListener(type, move, true);
    for (const type of ['mouseup', 'drop', 'dragend', 'blur']) window.addEventListener(type, () => controller.end(), true);
    return controller;
}
