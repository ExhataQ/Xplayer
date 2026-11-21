// Scroll memory: Back and Forward put the page back where the person was. The shell does it for every view, so a view has nothing to write.
//
//   - While a view is on screen, the main scroller of the view host (the one that is about as wide and tall as the host: the song list, a
//     settings page, a card's list) reports its position through onNote({ key, top }). The history keeps it in the entry of that place.
//   - When Back or Forward returns to an entry, restore({ key, top }) scrolls the same scroller again. The content may still be drawing (a
//     virtual list sets its height when its rows are built), so it tries for about half a second and stops at once if the person scrolls.
//
// `key` names the scroller by its first class ('content', 'health-detail__content'), or ':host' for the host itself, so it can be found again.

const FRAMES = 36; // about 0.6 s at 60 frames a second
const SETTLED = 2; // frames in a row at the right position before it stops trying

const hostOf = () => document.querySelector('.view-host');

function keyOf(host, node) {
    if (node === host) return ':host';
    const first = node.classList && node.classList[0];
    return first ? `.${first}` : null;
}

function findByKey(host, key) {
    if (key === ':host') return host;
    try {
        return host.querySelector(key);
    } catch (error) {
        return null;
    }
}

// The scroller that carries the whole page: big enough to be the page and able to scroll vertically.
function isMainScroller(host, node) {
    if (!(node instanceof Element) || !(node === host || host.contains(node))) return false;
    const style = getComputedStyle(node);
    if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') return false;
    return node.clientWidth >= host.clientWidth * 0.6 && node.clientHeight >= host.clientHeight * 0.5;
}

export function installScrollMemory({ onNote }) {
    let frame = 0;
    let latest = null;
    let cancelRestore = null;

    const flush = () => {
        frame = 0;
        if (latest) onNote(latest);
        latest = null;
    };

    // Scroll events do not bubble, so one capturing listener on the document hears every scroller.
    document.addEventListener(
        'scroll',
        (event) => {
            const host = hostOf();
            const node = event.target === document ? null : event.target;
            if (!host || !node || !isMainScroller(host, node)) return;
            const key = keyOf(host, node);
            if (!key) return;
            latest = { key, top: Math.round(node.scrollTop) };
            if (!frame) frame = requestAnimationFrame(flush);
        },
        { capture: true, passive: true }
    );

    function restore(scroll) {
        if (cancelRestore) cancelRestore();
        cancelRestore = null;
        if (!scroll || !scroll.key || !(scroll.top > 0)) return;
        let tries = 0;
        let settled = 0;
        let stopped = false;
        const stop = () => {
            stopped = true;
            for (const type of ['wheel', 'pointerdown', 'keydown']) window.removeEventListener(type, stop, true);
        };
        for (const type of ['wheel', 'pointerdown', 'keydown']) window.addEventListener(type, stop, { capture: true, passive: true });
        cancelRestore = stop;
        const step = () => {
            if (stopped) return;
            const host = hostOf();
            const node = host && findByKey(host, scroll.key);
            if (node && node.scrollHeight - node.clientHeight >= scroll.top - 1) {
                if (Math.abs(node.scrollTop - scroll.top) > 1) {
                    node.scrollTop = scroll.top;
                    // The engine's virtual list draws its rows from its own scroll handler; ask it too, the way its own Back does.
                    if (typeof window.renderVirtualScrollImmediate === 'function') window.renderVirtualScrollImmediate(node);
                    settled = 0;
                } else settled++;
                if (settled >= SETTLED) return stop();
            }
            if (++tries >= FRAMES) return stop();
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    return { restore };
}
