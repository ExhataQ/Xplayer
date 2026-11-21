// A row that scrolls sideways instead of wrapping onto a second line, like the shelves on Home (home/shelf.js): the row fades out on each
// side that has more to show, and an arrow on each side pages it. The arrows only appear when the row does not fit. A mouse wheel moves it too.
import { el, iconButton, reducedMotion as reduced } from '../../components/index.js';

/** `content` is the element to scroll (a chip group). Returns { el, row, update() }. */
export function chipStrip(content, { label = 'Filters' } = {}) {
    const row = el('div', { class: 'chip-strip__row' }, content);
    const page = (dir) => row.scrollBy({ left: dir * Math.max(row.clientWidth * 0.7, 80), behavior: reduced() ? 'auto' : 'smooth' });
    const back = iconButton({ icon: 'chevron-left', label: `Scroll ${label} back`, size: 'sm', tooltip: false, className: 'chip-strip__arrow', onClick: () => page(-1) });
    const forward = iconButton({ icon: 'chevron-right', label: `Scroll ${label} forward`, size: 'sm', tooltip: false, className: 'chip-strip__arrow', onClick: () => page(1) });
    const root = el('div', { class: 'chip-strip', 'data-overflow': 'false', 'data-fade-start': 'false', 'data-fade-end': 'false' }, back, row, forward);

    let queued = false;
    function paint() {
        queued = false;
        const max = row.scrollWidth - row.clientWidth;
        const atStart = row.scrollLeft <= 1;
        const atEnd = row.scrollLeft >= max - 1;
        root.dataset.overflow = String(max > 1);
        root.dataset.fadeStart = String(max > 1 && !atStart);
        root.dataset.fadeEnd = String(max > 1 && !atEnd);
        back.disabled = atStart;
        forward.disabled = atEnd;
    }
    const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
    };
    row.addEventListener('scroll', schedule, { passive: true });
    // A wheel that turns up and down moves the row sideways, so a mouse without a horizontal wheel can use it.
    row.addEventListener(
        'wheel',
        (event) => {
            if (root.dataset.overflow !== 'true' || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            event.preventDefault();
            row.scrollLeft += event.deltaY;
        },
        { passive: false }
    );
    new ResizeObserver(schedule).observe(row);
    new ResizeObserver(schedule).observe(content);
    schedule();
    return { el: root, row, update: schedule };
}
