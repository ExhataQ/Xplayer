// The cat scrollbar (Settings > Appearance > Cat scrollbar). While <html data-scrollbar-cat="on">, every long vertical scroller gets
// a small yellow and orange cat that clings to its right edge and works as the scroll thumb: it follows the scroll position, can be
// dragged, climbs up or down while the list scrolls, and reacts when the pointer is over it.
//
// How it fits in: the native bar of a scroller that has a cat is hidden (cat-scrollbar.css, [data-cat-scroll]); scrollers shorter than
// MIN_HEIGHT, text fields and everything else keep the normal bar. The cats live in one fixed layer on <body>, not inside the lists,
// so virtual lists and the engine's own markup are never touched. Nothing runs while the option is off.

const LAYER_CLASS = 'xp-cat-layer';
const SCROLLER_ATTR = 'data-cat-scroll';
const CAT_W = 40; // px, the box of one cat
const CAT_H = 49;
const INSET = 4; // px kept free above and below the travel of the cat
const MIN_HEIGHT = 140; // a scroller shorter than this keeps its normal bar
const MIN_RANGE = 3; // px of overflow before there is anything to scroll
const WAKE_MS = 900; // how long the cat stays out of hiding after the last scroll
const DIR_MS = 180; // how long "climbing" lasts after the last scroll event
const SCAN_MS = 500;
const SKIP_TAGS = new Set(['TEXTAREA', 'INPUT', 'SELECT']);

// One cat, drawn once and copied per scroller. Front view, hugging the wall on its right. Colors are the cat's own (cat-scrollbar.css).
const CAT_SVG = `
<svg class="xp-cat__svg" viewBox="0 0 44 54" width="${CAT_W}" height="${CAT_H}" aria-hidden="true" focusable="false">
  <g class="cat-all">
    <g class="cat-tail">
      <path class="cat-limb-out cat-tail-out" d="M15 45 C5 47 2 37 8 32" />
      <path class="cat-tail-fill" d="M15 45 C5 47 2 37 8 32" />
      <path class="cat-tail-tip" d="M8.6 33.4 L7.6 31.2" />
    </g>
    <g class="cat-feet">
      <ellipse class="cat-foot cat-foot--a" cx="20" cy="50.4" rx="4.4" ry="2.8" />
      <ellipse class="cat-foot cat-foot--b" cx="31" cy="50.4" rx="4.4" ry="2.8" />
    </g>
    <g class="cat-bodyset">
      <ellipse class="cat-body" cx="26" cy="40.5" rx="11.5" ry="11" />
      <ellipse class="cat-belly" cx="27" cy="42.5" rx="6.2" ry="7.4" />
      <path class="cat-stripe" d="M15 35.5 L19.5 36.5 M14.6 40.5 L19.2 41 M15.4 45.5 L19.5 45" />
      <g class="cat-arm cat-arm--a">
        <path class="cat-limb-out" d="M33 33.5 L42 28" />
        <path class="cat-limb" d="M33 33.5 L42 28" />
        <circle class="cat-paw" cx="42.6" cy="27.6" r="3.1" />
      </g>
      <g class="cat-arm cat-arm--b">
        <path class="cat-limb-out" d="M33.5 41 L42 37" />
        <path class="cat-limb" d="M33.5 41 L42 37" />
        <circle class="cat-paw" cx="42.6" cy="36.6" r="3.1" />
      </g>
    </g>
    <g class="cat-headset">
      <path class="cat-ear cat-ear--l" d="M11 14 L11.6 3.2 L21 8.6 Z" />
      <path class="cat-ear-in cat-ear--l" d="M13.4 11 L13.8 6.6 L17.8 9 Z" />
      <path class="cat-ear cat-ear--r" d="M37 14 L36.4 3.2 L27 8.6 Z" />
      <path class="cat-ear-in cat-ear--r" d="M34.6 11 L34.2 6.6 L30.2 9 Z" />
      <ellipse class="cat-head" cx="24" cy="19.5" rx="15" ry="12.5" />
      <path class="cat-stripe" d="M24 7.8 V11.6 M19.4 8.6 L20.4 11.8 M28.6 8.6 L27.6 11.8" />
      <g class="cat-whiskers"><path d="M11.5 24.6 L5 23.6 M11.5 27 L5.2 28.6 M36.5 24.6 L42.6 23.8 M36.5 27 L42.4 28.4" /></g>
      <ellipse class="cat-blush" cx="14.2" cy="25.6" rx="2.7" ry="1.6" />
      <ellipse class="cat-blush" cx="33.8" cy="25.6" rx="2.7" ry="1.6" />
      <g class="cat-eyes">
        <g class="cat-eye"><ellipse class="cat-pupil" cx="18" cy="21" rx="2.4" ry="3" /><circle class="cat-shine" cx="17.2" cy="19.8" r="0.9" /></g>
        <g class="cat-eye"><ellipse class="cat-pupil" cx="30" cy="21" rx="2.4" ry="3" /><circle class="cat-shine" cx="29.2" cy="19.8" r="0.9" /></g>
      </g>
      <path class="cat-happy" d="M15.4 22.2 Q18 18.2 20.6 22.2 M27.4 22.2 Q30 18.2 32.6 22.2" />
      <path class="cat-nose" d="M22.7 25 H25.3 L24 26.7 Z" />
      <path class="cat-mouth" d="M24 26.7 V27.7 M24 27.7 Q22.2 29.6 20.4 27.9 M24 27.7 Q25.8 29.6 27.6 27.9" />
    </g>
  </g>
</svg>`;

let layer = null;
let observer = null; // MutationObserver on <body>: new lists appear
let attrObserver = null; // MutationObserver on <html>: the option is switched
let scanTimer = 0;
let lastScroll = 0;
const cats = new Map(); // scroller -> cat
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isOn = () => document.documentElement.dataset.scrollbarCat === 'on';

function visible(node) {
    if (typeof node.checkVisibility === 'function') return node.checkVisibility({ visibilityProperty: true });
    return node.offsetParent !== null;
}

function createCat(scroller) {
    const root = document.createElement('div');
    root.className = 'xp-cat';
    root.hidden = true;
    root.innerHTML = CAT_SVG;
    const svg = root.firstElementChild;
    layer.append(root);
    scroller.setAttribute(SCROLLER_ATTR, '');

    let lastTop = scroller.scrollTop;
    let dirTimer = 0;
    let wakeTimer = 0;
    let frame = 0;
    let drag = null;
    let hover = false;

    const sleepSoon = () => {
        clearTimeout(wakeTimer);
        wakeTimer = setTimeout(() => {
            if (!hover && !drag) delete root.dataset.awake;
        }, WAKE_MS);
    };
    const wake = () => {
        root.dataset.awake = '';
        sleepSoon();
    };

    function place() {
        frame = 0;
        if (!scroller.isConnected) return cat.destroy();
        const rect = scroller.getBoundingClientRect();
        const range = scroller.scrollHeight - scroller.clientHeight;
        const ok = range >= MIN_RANGE && rect.height >= MIN_HEIGHT && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight && visible(scroller);
        if (!ok) {
            root.hidden = true;
            return;
        }
        // Something on top of the list (a dialog, the startup view) hides the cat with it.
        const hit = document.elementFromPoint(Math.min(rect.left + rect.width / 2, window.innerWidth - 1), Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1));
        if (hit && !scroller.contains(hit) && !hit.closest(`.${LAYER_CLASS}`)) {
            root.hidden = true;
            return;
        }
        const travel = Math.max(0, rect.height - CAT_H - INSET * 2);
        const progress = Math.min(1, Math.max(0, scroller.scrollTop / range));
        root.style.transform = `translate(${Math.round(rect.right - CAT_W)}px, ${Math.round(rect.top + INSET + progress * travel)}px)`;
        root.hidden = false;
    }
    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(place);
    };

    function onScroll() {
        lastScroll = performance.now();
        const top = scroller.scrollTop;
        if (top !== lastTop) {
            root.dataset.dir = top > lastTop ? 'down' : 'up';
            lastTop = top;
            clearTimeout(dirTimer);
            dirTimer = setTimeout(() => delete root.dataset.dir, DIR_MS);
            wake();
        }
        schedule();
    }

    // Dragging the cat: its travel is the track, so a pointer move scales to a scroll distance.
    function range() {
        const rect = scroller.getBoundingClientRect();
        return { scroll: scroller.scrollHeight - scroller.clientHeight, travel: Math.max(1, rect.height - CAT_H - INSET * 2) };
    }
    svg.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        drag = { y: event.clientY, top: scroller.scrollTop, moved: false };
        svg.setPointerCapture(event.pointerId);
        root.dataset.drag = '';
        wake();
        event.preventDefault();
    });
    svg.addEventListener('pointermove', (event) => {
        if (!drag) return;
        const dy = event.clientY - drag.y;
        if (Math.abs(dy) > 3) drag.moved = true;
        const r = range();
        scroller.scrollTop = drag.top + dy * (r.scroll / r.travel);
    });
    const release = () => {
        if (!drag) return;
        const poked = !drag.moved;
        drag = null;
        delete root.dataset.drag;
        if (poked && !reduceMotion()) {
            root.dataset.poke = '';
            setTimeout(() => delete root.dataset.poke, 520);
        }
        sleepSoon();
    };
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('pointerenter', () => {
        hover = true;
        root.dataset.hover = '';
        wake();
    });
    svg.addEventListener('pointerleave', () => {
        hover = false;
        delete root.dataset.hover;
        sleepSoon();
    });

    scroller.addEventListener('scroll', onScroll, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(scroller);
    schedule();

    const cat = {
        place: schedule,
        destroy() {
            clearTimeout(dirTimer);
            clearTimeout(wakeTimer);
            if (frame) cancelAnimationFrame(frame);
            scroller.removeEventListener('scroll', onScroll);
            resize.disconnect();
            scroller.removeAttribute(SCROLLER_ATTR);
            root.remove();
            cats.delete(scroller);
        }
    };
    return cat;
}

// A scroller worth a cat: scrolls vertically by itself, is tall enough and really overflows.
function isScroller(node) {
    if (SKIP_TAGS.has(node.tagName)) return false;
    if (node.clientHeight < MIN_HEIGHT || node.scrollHeight - node.clientHeight < MIN_RANGE) return false;
    const overflow = getComputedStyle(node).overflowY;
    return overflow === 'auto' || overflow === 'scroll';
}

function scan() {
    scanTimer = 0;
    if (!isOn() || !layer) return;
    if (performance.now() - lastScroll < 300) return queueScan(); // a list is scrolling: its DOM churns, wait for it to settle
    const found = new Set();
    for (const node of document.body.querySelectorAll('*')) {
        if (layer.contains(node)) continue;
        // A scroller whose bar is already hidden by us no longer overflows by a bar's width, but its range is unchanged.
        if (isScroller(node)) found.add(node);
    }
    for (const [scroller, cat] of cats) if (!found.has(scroller)) cat.destroy();
    for (const scroller of found) if (!cats.has(scroller)) cats.set(scroller, createCat(scroller));
    for (const cat of cats.values()) cat.place();
}

function queueScan() {
    if (scanTimer || !isOn()) return;
    scanTimer = setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(scan, { timeout: 600 }) : scan()), SCAN_MS);
}

function start() {
    if (layer || !document.body) return;
    layer = document.createElement('div');
    layer.className = LAYER_CLASS;
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    // Only added or removed elements matter (a clock or a title changing text does not), so text and attribute changes are not watched.
    observer = new MutationObserver((records) => {
        if (records.some((r) => r.target !== layer && !layer.contains(r.target))) queueScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', queueScan);
    document.addEventListener('xplayer:appearance', queueScan);
    scan();
}

function stop() {
    if (!layer) return;
    clearTimeout(scanTimer);
    scanTimer = 0;
    if (observer) observer.disconnect();
    observer = null;
    window.removeEventListener('resize', queueScan);
    document.removeEventListener('xplayer:appearance', queueScan);
    for (const cat of [...cats.values()]) cat.destroy();
    layer.remove();
    layer = null;
}

/** Starts the cats now and whenever Settings switches the option on; stops them when it is switched off. Call once at start-up. */
export function installCatScrollbar() {
    if (attrObserver) return;
    const sync = () => (isOn() ? start() : stop());
    attrObserver = new MutationObserver(sync);
    attrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scrollbar-cat'] });
    sync();
}
