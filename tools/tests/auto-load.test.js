// Tests for the paging rules in src/ui-next/components/auto-load.js (task PB-18). Pure Node: createPager has no DOM.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// auto-load.js imports ./dom.js, which only touches `document` when called, so the pager loads in plain Node.
const load = () => import(pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'components', 'auto-load.js')).href);

const source = (n) => Array.from({ length: n }, (_, i) => i);
const pageOf = (all) => async (offset, count) => all.slice(offset, offset + count);

test('pages come in order and the last short page ends it', async () => {
    const { createPager } = await load();
    const pager = createPager({ pageSize: 4, loadPage: pageOf(source(10)) });
    assert.deepEqual((await pager.next()).items, [0, 1, 2, 3]);
    assert.deepEqual((await pager.next()).items, [4, 5, 6, 7]);
    const last = await pager.next();
    assert.deepEqual([last.items, last.done], [[8, 9], true]);
    assert.deepEqual(await pager.next(), { items: [], done: true });
});

test('an exact multiple needs one more (empty) page to know it is over', async () => {
    const { createPager } = await load();
    const pager = createPager({ pageSize: 5, loadPage: pageOf(source(10)) });
    await pager.next();
    assert.equal((await pager.next()).done, false);
    assert.equal((await pager.next()).done, true);
});

test('reset starts over, and a page that was on its way is dropped', async () => {
    const { createPager } = await load();
    let release;
    const slow = new Promise((resolve) => (release = resolve));
    let first = true;
    const pager = createPager({
        pageSize: 3,
        loadPage: async (offset, count) => {
            if (first) {
                first = false;
                await slow;
                return ['old', 'old', 'old'];
            }
            return source(5).slice(offset, offset + count);
        }
    });
    const pending = pager.next();
    pager.reset();
    release();
    assert.equal((await pending).stale, true);
    assert.deepEqual((await pager.next()).items, [0, 1, 2]);
    assert.equal(pager.offset, 3);
});

test('createPager needs loadPage', async () => {
    const { createPager } = await load();
    assert.throws(() => createPager({}), /loadPage/);
});
