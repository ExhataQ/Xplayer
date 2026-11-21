// Library health: a list that only builds the rows on screen. A check can find thousands of songs, and a row costs a cover, three lines and
// four buttons, so building them all made the page stall. The scroller keeps one tall spacer; the visible rows (plus a few above and below)
// are placed on it with transform and reused as the person scrolls.

export const ROW_HEIGHT = 56;
export const OVERSCAN = 6;

/** Which rows [start, end] (inclusive) must exist for this scroll position. Answers { start: 0, end: -1 } for an empty list. */
export function windowRange(scrollTop, viewport, rowHeight, total, overscan = OVERSCAN) {
    if (total <= 0 || rowHeight <= 0) return { start: 0, end: -1 };
    const first = Math.min(total - 1, Math.floor(Math.max(0, scrollTop) / rowHeight));
    const last = Math.ceil((Math.max(0, scrollTop) + Math.max(0, viewport)) / rowHeight);
    return { start: Math.max(0, first - overscan), end: Math.min(total - 1, last + overscan) };
}

/**
 * Fills `host` (an empty block inside `scroller`) with a virtual list.
 *   build(index) -> HTMLElement   makes the row for that item (called only for rows on screen)
 *   count()      -> number        how many items there are now
 * Answers { refresh(), rebuild(index), destroy() }: refresh() after the items changed, rebuild(index) to redraw one visible row.
 */
export function mountVirtualRows({ scroller, host, build, count, rowHeight = ROW_HEIGHT }) {
    const live = new Map(); // index -> row element
    let frame = 0;
    host.style.position = 'relative';

    function place(index, node) {
        node.style.position = 'absolute';
        node.style.insetInline = '0';
        node.style.top = '0';
        node.style.height = `${rowHeight}px`;
        node.style.transform = `translateY(${index * rowHeight}px)`;
    }

    function paint() {
        frame = 0;
        const total = count();
        host.style.height = `${total * rowHeight}px`;
        const offset = host.offsetTop || 0;
        const { start, end } = windowRange(scroller.scrollTop - offset, scroller.clientHeight || 600, rowHeight, total);
        for (const [index, node] of live) {
            if (index < start || index > end) {
                node.remove();
                live.delete(index);
            }
        }
        for (let i = start; i <= end; i++) {
            if (live.has(i)) continue;
            const node = build(i);
            if (!node) continue;
            place(i, node);
            host.append(node);
            live.set(i, node);
        }
    }

    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(paint);
    };
    scroller.addEventListener('scroll', schedule, { passive: true });
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    if (resize) resize.observe(scroller);
    paint();

    return {
        refresh() {
            for (const node of live.values()) node.remove();
            live.clear();
            paint();
        },
        rebuild(index) {
            const old = live.get(index);
            if (!old) return;
            const node = build(index);
            if (!node) return;
            place(index, node);
            old.replaceWith(node);
            live.set(index, node);
        },
        rows: () => live.size,
        destroy() {
            if (frame) cancelAnimationFrame(frame);
            scroller.removeEventListener('scroll', schedule);
            if (resize) resize.disconnect();
            for (const node of live.values()) node.remove();
            live.clear();
        }
    };
}
