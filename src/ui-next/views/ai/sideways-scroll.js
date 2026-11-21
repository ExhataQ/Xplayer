// A row that is wider than its box and has no scroll bar (the ready-made messages above the chat box) still has to move sideways:
//   - the mouse wheel scrolls it (an ordinary wheel only turns up and down, so the vertical turn is used; `wheel: false` leaves that to the
//     chip strip around the row, which does the same and also has the arrows),
//   - it can be dragged with the mouse or a pen (a touch screen scrolls it by itself),
//   - the keyboard already works: Tab moves to the next button and the row scrolls to show it.
// A drag that moved is not a click: the button under the pointer when it started does not fire. `row.dataset.edge` says where the row is
// ('start', 'middle', 'end', or 'none' when everything fits) so the CSS can fade the side that has more.

const DRAG_START = 5; // px of movement before a press becomes a drag

export function sidewaysScroll(row, { wheel = true } = {}) {
    let press = null;
    let dragged = false;

    const edge = () => {
        const room = row.scrollWidth - row.clientWidth;
        if (room <= 1) row.dataset.edge = 'none';
        else if (row.scrollLeft <= 1) row.dataset.edge = 'start';
        else if (row.scrollLeft >= room - 1) row.dataset.edge = 'end';
        else row.dataset.edge = 'middle';
    };

    if (wheel) {
        row.addEventListener(
            'wheel',
            (event) => {
                if (row.scrollWidth <= row.clientWidth) return;
                const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
                if (!delta) return;
                event.preventDefault();
                row.scrollLeft += delta;
            },
            { passive: false }
        );
    }

    row.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.pointerType === 'touch') return;
        press = { x: event.clientX, left: row.scrollLeft, id: event.pointerId };
        dragged = false;
    });
    row.addEventListener('pointermove', (event) => {
        if (!press || event.pointerId !== press.id) return;
        const moved = event.clientX - press.x;
        if (!dragged && Math.abs(moved) < DRAG_START) return;
        if (!dragged) {
            dragged = true;
            row.setPointerCapture(press.id);
            row.dataset.dragging = 'true';
        }
        row.scrollLeft = press.left - moved;
    });
    const end = () => {
        press = null;
        delete row.dataset.dragging;
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
    // The click that follows a drag is not a press on a button.
    row.addEventListener(
        'click',
        (event) => {
            if (!dragged) return;
            dragged = false;
            event.preventDefault();
            event.stopPropagation();
        },
        true
    );

    row.addEventListener('scroll', edge, { passive: true });
    new ResizeObserver(edge).observe(row);
    edge();
}
