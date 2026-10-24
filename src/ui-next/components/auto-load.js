// auto-load (task PB-18): a list that grows while you scroll. Search results, Recents and the queue use it, so they page the same way.
//
//   createPager({ pageSize, loadPage })   the paging rules, no DOM. next() -> { items, done }. loadPage(offset, count) returns an
//                                         array (or a promise of one); fewer than `count` items means the end. reset() starts over.
//   autoLoad({ scroller, pageSize, loadPage, renderItem, className, empty })
//                                         -> { el, reset(), destroy(), count() }
//        `el` is a <ul>; add it inside `scroller` (the element that scrolls). renderItem(item) returns one <li> (use the shared
//        song rows in views/library/panel-rows.js, so the queue draws songs the way Search does). While the end marker is within
//        one screen of view, the next page is added. `empty` (a node or a function returning one) is shown when there are no items.
//
// Nothing shows while idle; a "Loading" row shows while a page is awaited.

import { el } from './dom.js';

export function createPager({ pageSize = 40, loadPage } = {}) {
    if (typeof loadPage !== 'function') throw new TypeError('createPager() needs loadPage');
    let offset = 0;
    let done = false;
    let generation = 0;
    return {
        get done() {
            return done;
        },
        get offset() {
            return offset;
        },
        reset() {
            offset = 0;
            done = false;
            generation++;
        },
        async next() {
            if (done) return { items: [], done: true };
            const mine = generation;
            const items = (await loadPage(offset, pageSize)) || [];
            if (mine !== generation) return { items: [], done, stale: true }; // reset() ran while this page was on its way
            offset += items.length;
            if (items.length < pageSize) done = true;
            return { items, done };
        }
    };
}

export function autoLoad({ scroller, pageSize = 40, loadPage, renderItem, className = '', empty } = {}) {
    if (!scroller) throw new TypeError('autoLoad() needs the scroller element');
    const pager = createPager({ pageSize, loadPage });
    const list = el('ul', { class: `auto-load ${className}`.trim() });
    const marker = el('li', { class: 'auto-load__end', 'aria-hidden': 'true' });
    const loading = el('li', { class: 'auto-load__loading', role: 'status' }, 'Loading');
    let shown = 0;
    let busy = false;
    let gone = false;

    const observer =
        typeof IntersectionObserver === 'function'
            ? new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more(), { root: scroller, rootMargin: '0px 0px 100% 0px' })
            : null;

    async function more() {
        if (busy || gone || pager.done) return;
        busy = true;
        marker.before(loading);
        try {
            const { items, stale } = await pager.next();
            if (stale || gone) return;
            for (const item of items) marker.before(renderItem(item));
            shown += items.length;
            if (!shown && pager.done && empty) marker.before(typeof empty === 'function' ? empty() : empty);
        } finally {
            loading.remove();
            busy = false;
        }
        if (pager.done) observer?.unobserve(marker);
        else if (observer) {
            observer.unobserve(marker); // look again: the marker may still be in view after a short page
            observer.observe(marker);
        }
    }

    function clear() {
        for (const node of [...list.children]) if (node !== marker) node.remove();
        shown = 0;
    }

    list.append(marker);
    observer?.observe(marker);
    if (!observer) more(); // no observer (an old runtime): load the first page at least
    return {
        el: list,
        count: () => shown,
        reset() {
            pager.reset();
            clear();
            busy = false;
            observer?.unobserve(marker);
            observer?.observe(marker);
            if (!observer) more();
        },
        destroy() {
            gone = true;
            observer?.disconnect();
            list.remove();
        }
    };
}
