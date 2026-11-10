// The opening animation of the search boxes (components/reveal.js) and the scroll shadow of the queue list (components/scroll-shadow.js).
// Pure Node: the browser pieces are replaced by small fakes. The real thing, in a real page, is in ui-next-open-animations.test.js.
// Run: node --test tools/tests/ui-next-reveal.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const NEXT = path.join(__dirname, '..', '..', 'src', 'ui-next');
const load = (...p) => import(pathToFileURL(path.join(NEXT, ...p)).href);
const read = (...p) => fs.readFileSync(path.join(NEXT, ...p), 'utf8');

function fakeNode(width) {
    const calls = [];
    return { calls, getBoundingClientRect: () => ({ width }), animate: (frames, options) => (calls.push({ frames, options }), { fake: true }) };
}
const withMotion = (reduced, fn) => {
    const before = globalThis.document;
    globalThis.document = { documentElement: { dataset: { motion: reduced ? 'reduced' : 'full' } } };
    try {
        return fn();
    } finally {
        globalThis.document = before;
    }
};

test('growWidth: a box that gets wider grows from its old width to the new one and fades in, and leaves nothing behind', async () => {
    const { growWidth, REVEAL_MS } = await load('components', 'reveal.js');
    const node = fakeNode(220);
    const animation = withMotion(false, () => growWidth(node, 0, { fade: true }));
    assert.deepEqual(animation, { fake: true });
    assert.equal(node.calls.length, 1);
    assert.deepEqual(node.calls[0].frames, [{ width: '0px', opacity: 0 }, { width: '220px', opacity: 1 }]);
    assert.equal(node.calls[0].options.duration, REVEAL_MS);
    assert.ok(!('fill' in node.calls[0].options), 'no fill: when it ends, the real layout is what shows');
});

test('growWidth: an item that sizes itself with flex-grow moves its flex-basis, and one that gets narrower fades out', async () => {
    const { growWidth } = await load('components', 'reveal.js');
    const wider = fakeNode(275);
    withMotion(false, () => growWidth(wider, 28, { flex: true }));
    assert.deepEqual(wider.calls[0].frames, [{ flexGrow: 0, flexShrink: 0, flexBasis: '28px' }, { flexGrow: 0, flexShrink: 0, flexBasis: '275px' }]);
    const narrower = fakeNode(28);
    withMotion(false, () => growWidth(narrower, 275, { flex: true, fade: true }));
    assert.deepEqual(narrower.calls[0].frames, [{ flexGrow: 0, flexShrink: 0, flexBasis: '275px', opacity: 1 }, { flexGrow: 0, flexShrink: 0, flexBasis: '28px', opacity: 0 }]);
});

test('growWidth: nothing animates for reduced motion, an unchanged width, a missing old width or a node that cannot animate', async () => {
    const { growWidth } = await load('components', 'reveal.js');
    const reduced = fakeNode(220);
    assert.equal(withMotion(true, () => growWidth(reduced, 0)), null);
    assert.equal(reduced.calls.length, 0);
    const same = fakeNode(220);
    assert.equal(withMotion(false, () => growWidth(same, 219)), null, 'a change of under 2 px is not worth an animation');
    assert.equal(withMotion(false, () => growWidth(fakeNode(220), NaN)), null);
    assert.equal(withMotion(false, () => growWidth(fakeNode(220), undefined)), null);
    assert.equal(withMotion(false, () => growWidth({ getBoundingClientRect: () => ({ width: 220 }) }, 0)), null);
    assert.equal(withMotion(false, () => growWidth(null, 0)), null);
});

// ---- the scroll shadow ---------------------------------------------------------------------------------------------------
function shadowWorld() {
    const frames = [];
    class FakeElement {
        constructor(props = {}) {
            Object.assign(this, { scrollTop: 0, clientHeight: 300, scrollHeight: 300, dataset: {}, selector: '', listeners: {} }, props);
        }
        matches(selector) {
            return selector === this.selector;
        }
        addEventListener(type, fn) {
            this.listeners[type] = fn;
        }
        removeEventListener(type) {
            delete this.listeners[type];
        }
        querySelector(selector) {
            return this.child && this.child.selector === selector ? this.child : null;
        }
    }
    const observers = [];
    class FakeObserver {
        constructor(fn) {
            this.fn = fn;
            this.disconnected = false;
            observers.push(this);
        }
        observe() {}
        disconnect() {
            this.disconnected = true;
        }
    }
    globalThis.Element = FakeElement;
    globalThis.requestAnimationFrame = (fn) => frames.push(fn);
    globalThis.ResizeObserver = FakeObserver;
    globalThis.MutationObserver = FakeObserver;
    const flush = () => frames.splice(0).forEach((fn) => fn());
    return { FakeElement, observers, flush };
}

test('scrollShadow with bottom: data-scrolled follows scrollTop, data-more says whether more is below, and both follow size changes too', async () => {
    const { scrollShadow } = await load('components', 'scroll-shadow.js');
    const { FakeElement, observers, flush } = shadowWorld();
    const scroller = new FakeElement({ selector: '.body', scrollHeight: 1000 });
    const wrapper = new FakeElement({ child: scroller });
    const stop = scrollShadow(wrapper, '.body', { bottom: true });
    flush();
    assert.deepEqual([wrapper.dataset.scrolled, wrapper.dataset.more], ['false', 'true'], 'at the top of a long list: more below, nothing above');
    scroller.scrollTop = 200;
    wrapper.listeners.scroll({ target: scroller });
    flush();
    assert.deepEqual([wrapper.dataset.scrolled, wrapper.dataset.more], ['true', 'true'], 'in the middle: both');
    scroller.scrollTop = 700; // 700 + 300 = 1000: the end
    wrapper.listeners.scroll({ target: scroller });
    flush();
    assert.deepEqual([wrapper.dataset.scrolled, wrapper.dataset.more], ['true', 'false'], 'at the bottom: only the top shadow');
    scroller.scrollHeight = 300; // the list got shorter (songs removed): no scroll event, the size observer notices
    scroller.scrollTop = 0;
    observers[0].fn();
    flush();
    assert.deepEqual([wrapper.dataset.scrolled, wrapper.dataset.more], ['false', 'false'], 'a list that fits has no shadow');
    scroller.scrollHeight = 900; // songs added
    observers[1].fn();
    flush();
    assert.equal(wrapper.dataset.more, 'true');
    stop();
    assert.equal(wrapper.listeners.scroll, undefined);
    assert.ok(observers.every((o) => o.disconnected));
});

test('scrollShadow ignores scrolling of anything that is not the list, and without bottom it is the old top-only shadow', async () => {
    const { scrollShadow } = await load('components', 'scroll-shadow.js');
    const { FakeElement, observers, flush } = shadowWorld();
    const scroller = new FakeElement({ selector: '.body', scrollHeight: 1000 });
    const other = new FakeElement({ selector: '.other', scrollTop: 500 });
    const wrapper = new FakeElement({ child: scroller });
    scrollShadow(wrapper, '.body');
    assert.equal(observers.length, 0, 'no observers unless asked for');
    assert.equal('more' in wrapper.dataset, false, 'no data-more unless asked for');
    wrapper.listeners.scroll({ target: other });
    flush();
    assert.equal(wrapper.dataset.scrolled, 'false');
    scroller.scrollTop = 50;
    wrapper.listeners.scroll({ target: scroller });
    flush();
    assert.equal(wrapper.dataset.scrolled, 'true');
});

// ---- where it is used ---------------------------------------------------------------------------------------------------
test('the three places are wired: the Library search box and the list toolbar find box grow open, the queue list has the shadow', () => {
    assert.match(read('views', 'library', 'panel-search.js'), /import \{ growWidth \} from '\.\.\/\.\.\/components\/reveal\.js'/);
    assert.match(read('views', 'library', 'panel-search.js'), /growWidth\(root, before, \{ flex: true \}\)/);
    const toolbar = read('views', 'library', 'list-toolbar.js');
    assert.match(toolbar, /growWidth\(findBox, 0, \{ fade: true \}\)/);
    assert.match(toolbar, /if \(wasHidden\) growWidth/, 'only the opening animates; closing stays instant (the box is hidden at once)');
    const queue = read('views', 'playback', 'queue-panel.js');
    assert.match(queue, /scroll-shadow--overlay scroll-shadow--bottom/);
    assert.match(queue, /scrollShadow\(scroll, '\.queue-panel__body', \{ bottom: true \}\)/);
    const css = read('components', 'components.css');
    assert.match(css, /\.scroll-shadow--overlay\.scroll-shadow--bottom\[data-more='true'\]::after/);
    assert.match(css, /data-motion='reduced'[\s\S]*scroll-shadow--bottom::after/);
});
