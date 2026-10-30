// The cat scrollbar (Settings > Appearance > Cat scrollbar). While <html data-scrollbar-cat="on">, every long vertical scroller gets
// a small yellow and orange cat that clings to its right edge and works as the scroll thumb: it follows the scroll position, can be
// dragged, climbs up or down while the list scrolls, and reacts when the pointer is over it.
//
// How it fits in: the native bar of a scroller that has a cat is hidden (cat-scrollbar.css, [data-cat-scroll]); scrollers shorter than
// MIN_HEIGHT, text fields and everything else keep the normal bar. The cats live in one fixed layer on <body>, not inside the lists,
// so virtual lists and the engine's own markup are never touched. Nothing runs while the option is off.

const LAYER_CLASS = 'xp-cat-layer';
const SCROLLER_ATTR = 'data-cat-scroll';
const CAT_W = 51; // px, the box of one cat: the drawing (0.91 scale) plus room around it, so the tail and the ears are never cut off
const CAT_H = 58;
const INSET = 4; // px kept free above and below the travel of the cat
const MIN_HEIGHT = 140; // a scroller shorter than this keeps its normal bar
const MIN_RANGE = 3; // px of overflow before there is anything to scroll
const WAKE_MS = 900; // how long the cat stays out of hiding after the last scroll
const DIR_MS = 180; // how long "climbing" lasts after the last scroll event
const SCAN_MS = 500;
const WANDER_MIN_MS = 4000; // every 4 to 10 seconds the cat walks a little way up or down by itself (the list scrolls with it) or looks about
const WANDER_MAX_MS = 10000;
const SKIP_TAGS = new Set(['TEXTAREA', 'INPUT', 'SELECT']);

// One cat, drawn once and copied per scroller. Front view, hugging the wall on its right. Colors are the cat's own (cat-scrollbar.css).
const CAT_SVG = `
<svg class="xp-cat__svg" viewBox="-12 -6 56 64" width="${CAT_W}" height="${CAT_H}" aria-hidden="true" focusable="false">
  <g class="cat-all">
    <g class="cat-tail">
      <path class="cat-limb-out cat-tail-out" d="M15 45 C5 47 2 37 8 32" />
      <path class="cat-tail-fill" d="M15 45 C5 47 2 37 8 32" />
      <path class="cat-tail-rings" d="M13.6 46.2 L11.2 43.6 M9.4 42.2 L6.6 40.4 M5.2 37.6 L5 34.6" />
      <path class="cat-tail-tip" d="M8.6 33.4 L7.6 31.2" />
    </g>
    <g class="cat-feet">
      <ellipse class="cat-foot cat-foot--a" cx="20" cy="50.4" rx="4.4" ry="2.8" />
      <ellipse class="cat-foot cat-foot--b" cx="31" cy="50.4" rx="4.4" ry="2.8" />
    </g>
    <g class="cat-bodyset">
      <ellipse class="cat-body" cx="26" cy="40.5" rx="11.5" ry="11" />
      <ellipse class="cat-shade" cx="26" cy="46.2" rx="9" ry="4.4" />
      <ellipse class="cat-belly" cx="27" cy="42.5" rx="6.2" ry="7.4" />
      <path class="cat-fluff" d="M23 36.2 Q25 38.6 27 36.2 Q29 38.6 31 36.2" />
      <path class="cat-stripe" d="M15 35.5 L19.5 36.5 M14.6 40.5 L19.2 41 M15.4 45.5 L19.5 45" />
      <g class="cat-arm cat-arm--a">
        <path class="cat-limb-out" d="M33 33.5 L42 28" />
        <path class="cat-limb" d="M33 33.5 L42 28" />
        <circle class="cat-paw" cx="42.6" cy="27.6" r="3.1" />
        <path class="cat-toes" d="M41.6 28.4 V29.8 M43.6 28.4 V29.8" />
      </g>
      <g class="cat-arm cat-arm--b">
        <path class="cat-limb-out" d="M33.5 41 L42 37" />
        <path class="cat-limb" d="M33.5 41 L42 37" />
        <circle class="cat-paw" cx="42.6" cy="36.6" r="3.1" />
        <path class="cat-toes" d="M41.6 37.4 V38.8 M43.6 37.4 V38.8" />
      </g>
    </g>
    <g class="cat-headset">
      <path class="cat-ear cat-ear--l" d="M11 14 L11.6 3.2 L21 8.6 Z" />
      <path class="cat-ear-in cat-ear--l" d="M13.4 11 L13.8 6.6 L17.8 9 Z" />
      <path class="cat-ear cat-ear--r" d="M37 14 L36.4 3.2 L27 8.6 Z" />
      <path class="cat-ear-in cat-ear--r" d="M34.6 11 L34.2 6.6 L30.2 9 Z" />
      <ellipse class="cat-head" cx="24" cy="19.5" rx="15" ry="12.5" />
      <ellipse class="cat-head-shine" cx="19" cy="12.6" rx="5.2" ry="2.3" />
      <path class="cat-cheek-fur" d="M9.6 22 L12.4 22.6 L10.4 24.4 M38.4 22 L35.6 22.6 L37.6 24.4" />
      <path class="cat-stripe" d="M24 7.8 V11.6 M19.4 8.6 L20.4 11.8 M28.6 8.6 L27.6 11.8" />
      <g class="cat-whiskers"><path d="M11.5 24.6 L5 23.6 M11.5 27 L5.2 28.6 M36.5 24.6 L42.6 23.8 M36.5 27 L42.4 28.4" /></g>
      <ellipse class="cat-blush" cx="14.2" cy="25.6" rx="2.7" ry="1.6" />
      <ellipse class="cat-blush" cx="33.8" cy="25.6" rx="2.7" ry="1.6" />
      <g class="cat-eyes">
        <g class="cat-eye"><g class="cat-look"><ellipse class="cat-pupil" cx="18" cy="21" rx="2.4" ry="3" /><circle class="cat-shine" cx="17.2" cy="19.8" r="0.9" /></g></g>
        <g class="cat-eye"><g class="cat-look"><ellipse class="cat-pupil" cx="30" cy="21" rx="2.4" ry="3" /><circle class="cat-shine" cx="29.2" cy="19.8" r="0.9" /></g></g>
      </g>
      <path class="cat-happy" d="M15.4 22.2 Q18 18.2 20.6 22.2 M27.4 22.2 Q30 18.2 32.6 22.2" />
      <path class="cat-nose" d="M22.7 25 H25.3 L24 26.7 Z" />
      <path class="cat-mouth" d="M24 26.7 V27.7 M24 27.7 Q22.2 29.6 20.4 27.9 M24 27.7 Q25.8 29.6 27.6 27.9" />
    </g>
  </g>
</svg>`;

// The minimalist cats: the same pose and the same moving parts (so every animation works), drawn as flat one-color shapes with two small
// eyes and no other detail. The color comes from the skin (cat-scrollbar.css, .xp-cat[data-skin]).
const CAT_MINI_SVG = `
<svg class="xp-cat__svg" viewBox="-12 -6 56 64" width="${CAT_W}" height="${CAT_H}" aria-hidden="true" focusable="false">
  <g class="cat-all">
    <g class="cat-tail">
      <path class="cat-m-edge cat-m-edge--limb" d="M15 45 C5 47 2 37 8 32" />
      <path class="cat-m-line" d="M15 45 C5 47 2 37 8 32" />
    </g>
    <g class="cat-feet">
      <ellipse class="cat-m cat-foot--a" cx="20" cy="50.4" rx="4.4" ry="2.8" />
      <ellipse class="cat-m cat-foot--b" cx="31" cy="50.4" rx="4.4" ry="2.8" />
    </g>
    <g class="cat-bodyset">
      <ellipse class="cat-m" cx="26" cy="40.5" rx="11.5" ry="11" />
      <g class="cat-arm cat-arm--a">
        <path class="cat-m-edge cat-m-edge--limb" d="M33 33.5 L42 28" />
        <path class="cat-m-line" d="M33 33.5 L42 28" />
      </g>
      <g class="cat-arm cat-arm--b">
        <path class="cat-m-edge cat-m-edge--limb" d="M33.5 41 L42 37" />
        <path class="cat-m-line" d="M33.5 41 L42 37" />
      </g>
    </g>
    <g class="cat-headset">
      <path class="cat-m cat-ear--l" d="M11 14 L11.6 3.2 L21 8.6 Z" />
      <path class="cat-m cat-ear--r" d="M37 14 L36.4 3.2 L27 8.6 Z" />
      <ellipse class="cat-m" cx="24" cy="19.5" rx="15" ry="12.5" />
      <g class="cat-eyes">
        <g class="cat-eye"><g class="cat-look"><ellipse class="cat-m-eye" cx="18" cy="21" rx="2" ry="2.7" /></g></g>
        <g class="cat-eye"><g class="cat-look"><ellipse class="cat-m-eye" cx="30" cy="21" rx="2" ry="2.7" /></g></g>
      </g>
      <path class="cat-happy" d="M15.4 22.2 Q18 18.2 20.6 22.2 M27.4 22.2 Q30 18.2 32.6 22.2" />
    </g>
  </g>
</svg>`;
const skin = () => document.documentElement.dataset.scrollbarCatSkin || 'classic';

let layer = null;
let shownSkin = '';
let observer = null; // MutationObserver on <body>: new lists appear
let attrObserver = null; // MutationObserver on <html>: the option is switched
let scanTimer = 0;
let lastScroll = 0;
const pointer = { x: -1, y: -1, t: 0 }; // where the pointer last was, for the idle walks (they keep away from a pointer that is busy over the list)
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
    root.dataset.skin = shownSkin;
    root.innerHTML = shownSkin === 'classic' ? CAT_SVG : CAT_MINI_SVG;
    const svg = root.firstElementChild;
    layer.append(root);
    scroller.setAttribute(SCROLLER_ATTR, '');

    let lastTop = scroller.scrollTop;
    let dirTimer = 0;
    let wakeTimer = 0;
    let frame = 0;
    let drag = null;
    let hover = false;
    let offset = 0; // px the cat has wandered from where the scroll position puts it (the cat walks about by itself now and then)
    let tween = 0;
    let wanderTimer = 0;

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
        const y = INSET + Math.min(travel, Math.max(0, progress * travel + offset));
        root.style.transform = `translate(${Math.round(rect.right - CAT_W)}px, ${Math.round(rect.top + y)}px)`;
        root.hidden = false;
    }
    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(place);
    };

    function onScroll() {
        lastScroll = performance.now();
        if (offset || tween) {
            // the list moved (the person scrolled): the cat goes back to where the scroll position puts it
            cancelAnimationFrame(tween);
            tween = 0;
            offset = 0;
        }
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

    // Idle life. Every few seconds the cat does one of two things, when nobody is using it:
    //   walks   it climbs up or down the edge and the list really scrolls with it (a short way, eased like a walk: slow, steady, slow);
    //   looks   it stays where it is, comes out and looks about: left, right, up, down, with its head turning after its eyes.
    // Neither happens while the cat is hovered or dragged, while the list is being scrolled by the person (or was in the last few
    // seconds), while the pointer is moving over the list (a list must never move under a click), or when motion is reduced.
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // slow start, steady middle, slow stop
    const stopWalk = () => {
        if (!tween) return;
        cancelAnimationFrame(tween);
        tween = 0;
        glideEnd = performance.now();
    };
    function glide(to) {
        const from = scroller.scrollTop;
        const distance = Math.abs(to - from);
        const duration = 900 + distance * 3.2; // about 300px a second at the steady part
        const started = performance.now();
        root.dataset.dir = to > from ? 'down' : 'up';
        wake();
        const step = (now) => {
            const t = Math.min(1, (now - started) / duration);
            scroller.scrollTop = from + (to - from) * ease(t);
            if (t < 1) tween = requestAnimationFrame(step);
            else {
                tween = 0;
                glideEnd = performance.now();
                clearTimeout(dirTimer);
                dirTimer = setTimeout(() => {
                    delete root.dataset.dir;
                    root.dataset.settle = ''; // a small shake after the walk
                    setTimeout(() => delete root.dataset.settle, 420);
                }, DIR_MS);
                wake();
            }
        };
        tween = requestAnimationFrame(step);
    }
    function walk() {
        const r = range();
        const top = scroller.scrollTop;
        const roomUp = top;
        const roomDown = r.scroll - top;
        // the way with more room is likelier; at an end there is only one way
        const down = Math.random() < roomDown / Math.max(1, roomUp + roomDown);
        const room = down ? roomDown : roomUp;
        if (room < 40) return;
        const distance = Math.min(room, 110 + Math.random() * 230);
        glide(top + (down ? distance : -distance));
    }
    // Looking about: the eyes go first, the head follows a moment later (--lx, --ly move the eyes; --tilt and --hx the head).
    const GAZES = [
        [-1.5, -0.8, -5, -1],
        [1.6, 0.2, 5, 1],
        [0.2, 1.3, 2, 0],
        [-1.3, 0.4, -4, -1],
        [0.8, -1.2, 4, 0.5]
    ];
    function lookAbout() {
        const count = 3 + Math.floor(Math.random() * 2);
        const picks = [...GAZES].sort(() => Math.random() - 0.5).slice(0, count);
        root.dataset.looking = '';
        wake();
        let at = 450;
        for (const [x, y, tilt, hx] of picks) {
            lookTimers.push(
                setTimeout(() => {
                    root.style.setProperty('--lx', x);
                    root.style.setProperty('--ly', y);
                    lookTimers.push(
                        setTimeout(() => {
                            root.style.setProperty('--tilt', tilt);
                            root.style.setProperty('--hx', hx);
                        }, 160)
                    );
                    wake();
                }, at)
            );
            at += 900 + Math.random() * 500;
        }
        lookTimers.push(setTimeout(endLook, at));
    }
    function endLook() {
        for (const t of lookTimers) clearTimeout(t);
        lookTimers = [];
        if (root.dataset.looking === undefined) return;
        delete root.dataset.looking;
        for (const name of ['--lx', '--ly', '--tilt', '--hx']) root.style.removeProperty(name);
        wake();
    }
    function idle() {
        if (root.hidden || hover || drag || tween || lookTimers.length || document.hidden || reduceMotion() || root.dataset.dir !== undefined) return;
        const now = performance.now();
        if (now - lastUser < 4000) return;
        if (Math.random() < 0.45) return lookAbout();
        const rect = scroller.getBoundingClientRect();
        const near = pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
        if (near && now - pointer.t < 8000) return lookAbout(); // the pointer is busy over this list: only look, do not move it
        walk();
    }
    const planWander = () => {
        wanderTimer = setTimeout(() => {
            idle();
            planWander();
        }, WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS));
    };
    planWander();
    // The person takes over: a wheel, a touch, a key or a click on the list stops the walk and the looking at once.
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) scroller.addEventListener(type, () => (stopWalk(), endLook()), { passive: true });

    // Dragging the cat: its travel is the track, so a pointer move scales to a scroll distance.
    function range() {
        const rect = scroller.getBoundingClientRect();
        return { scroll: scroller.scrollHeight - scroller.clientHeight, travel: Math.max(1, rect.height - CAT_H - INSET * 2) };
    }
    svg.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        stopWalk();
        endLook();
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
        stopWalk();
        endLook();
        hover = true;
        root.dataset.hover = '';
        wake();
    });
    svg.addEventListener('pointerleave', () => {
        hover = false;
        delete root.dataset.hover;
        sleepSoon();
    });

    // The eyes follow the pointer while the cat is out (not while it is scrolling, dragged or when motion is reduced).
    let lookFrame = 0;
    let lookEvent = null;
    function look() {
        lookFrame = 0;
        const e = lookEvent;
        if (!e || root.hidden || root.dataset.awake === undefined || root.dataset.drag !== undefined || root.dataset.looking !== undefined || reduceMotion()) return;
        const box = svg.getBoundingClientRect();
        const dx = e.clientX - (box.left + box.width * 0.5);
        const dy = e.clientY - (box.top + box.height * 0.36);
        const k = Math.min(1, Math.hypot(dx, dy) / 90) / (Math.hypot(dx, dy) || 1);
        root.style.setProperty('--lx', (dx * k * 1.5).toFixed(2));
        root.style.setProperty('--ly', (dy * k * 1.1).toFixed(2));
    }
    const onPointer = (event) => {
        if (root.dataset.awake === undefined) return;
        lookEvent = event;
        if (!lookFrame) lookFrame = requestAnimationFrame(look);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    scroller.addEventListener('scroll', onScroll, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(scroller);
    schedule();

    const cat = {
        place: schedule,
        destroy() {
            clearTimeout(dirTimer);
            clearTimeout(wakeTimer);
            clearTimeout(wanderTimer);
            if (tween) cancelAnimationFrame(tween);
            for (const t of lookTimers) clearTimeout(t);
            if (frame) cancelAnimationFrame(frame);
            scroller.removeEventListener('scroll', onScroll);
            window.removeEventListener('pointermove', onPointer);
            if (lookFrame) cancelAnimationFrame(lookFrame);
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

function trackPointer(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.t = performance.now();
}

function start() {
    if (layer || !document.body) return;
    shownSkin = skin();
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
    window.addEventListener('pointermove', trackPointer, { passive: true });
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
    window.removeEventListener('pointermove', trackPointer);
    document.removeEventListener('xplayer:appearance', queueScan);
    for (const cat of [...cats.values()]) cat.destroy();
    layer.remove();
    layer = null;
}

/** Starts the cats now and whenever Settings switches the option on; stops them when it is switched off. Call once at start-up. */
export function installCatScrollbar() {
    if (attrObserver) return;
    const sync = () => {
        if (!isOn()) return stop();
        if (layer && skin() !== shownSkin) stop(); // another skin: the cats are drawn again
        start();
    };
    attrObserver = new MutationObserver(sync);
    attrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scrollbar-cat', 'data-scrollbar-cat-skin'] });
    sync();
}
