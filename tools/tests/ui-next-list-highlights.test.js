// Task PB-01: the engine's hover, selection and playing highlight layers sit exactly on their rows in the new screen, also after the list
// has scrolled. The layers are position: absolute children of .content, placed from row rectangles plus scrollTop (ui/04a), so .content
// has to be their containing block (adapter/engine-view.css). Without it they stay where they were drawn while the rows move.
//
// Run:   node --test tools/tests/ui-next-list-highlights.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForStartupGone } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 60000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

describe('list highlights stay on their rows', () => {
    test('the engine host is the containing block of the highlight layers, and the selection layer has no radius rule of its own', () => {
        const view = read('src', 'ui-next', 'adapter', 'engine-view.css');
        assert.match(view, /\.view-host\[data-engine\] \.content \{\s*position: relative;/);
        const rows = read('src', 'ui-next', 'adapter', 'songlist-rows.css');
        for (const id of ['#hover-highlight-single', '#active-hover-styles-set > div:not(#hover-highlight-single)']) {
            const at = rows.indexOf(id + ' {');
            assert.ok(at > 0, id);
            assert.match(rows.slice(at, rows.indexOf('}', at)), /border-radius: var\(--radius-sm\) !important/, id);
        }
        // The engine rounds only the ends of a run of selected rows (inline); a rule here would round every row (PB-01 follow-up).
        const sel = rows.indexOf('#selection-styles-set > div {');
        assert.ok(sel > 0);
        assert.doesNotMatch(rows.slice(sel, rows.indexOf('}', sel)), /border-radius\s*:/);
    });

    for (const count of [30, 400]) {
        describe(`${count} songs${count > 200 ? ' (virtual scroll)' : ''}`, { concurrency: false }, () => {
            let browser, dir, skip;

            before(async () => {
                if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
                browser = await launch(pw);
                if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
                dir = buildApp(count);
                fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
                const file = path.join(dir, 'ui-next', 'index.html');
                const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
                fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
            });

            after(async () => {
                if (browser) await browser.close();
                if (dir) fs.rmSync(dir, { recursive: true, force: true });
            });

            const guard = (t) => (skip ? (t.skip(skip), false) : true);

            async function open() {
                const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
                const errors = [];
                page.on('pageerror', (e) => errors.push(String(e.message)));
                await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
                await page.waitForSelector('#song-list .song-item:not(.lazy-skeleton)');
                await waitForStartupGone(page);
                return { page, errors };
            }

            // Where the pointer rests: inside the list, a little below its top. The title bar sits above the list in the scroller.
            const pointer = (page) =>
                page.evaluate(() => {
                    const l = document.getElementById('song-list').getBoundingClientRect();
                    return { x: Math.round(l.left + l.width / 2), y: Math.round(l.top + 100) };
                });

            // Waits for the hover highlight to settle on the row under the pointer (the engine throttles it), then returns both tops.
            async function hoverTops(page, at) {
                await page.waitForFunction(
                    ({ x, y }) => {
                        const row = document.elementFromPoint(x, y)?.closest('.song-item:not(.lazy-skeleton)');
                        const hl = document.getElementById('hover-highlight-single');
                        return row && hl && hl.style.display !== 'none' && Math.abs(hl.getBoundingClientRect().top - row.getBoundingClientRect().top) < 1.5;
                    },
                    at,
                    { timeout: 4000 }
                ).catch(() => {});
                return page.evaluate(({ x, y }) => {
                    const row = document.elementFromPoint(x, y)?.closest('.song-item');
                    const hl = document.getElementById('hover-highlight-single');
                    return { row: row && Math.round(row.getBoundingClientRect().top), skeleton: !!row?.classList.contains('lazy-skeleton'), hl: hl && hl.style.display !== 'none' ? Math.round(hl.getBoundingClientRect().top) : null, height: hl ? Math.round(hl.getBoundingClientRect().height) : null };
                }, at);
            }

            test('the hover highlight is on the row under the pointer after the wheel scrolls, and after a jump', TEST_OPTIONS, async (t) => {
                if (!guard(t)) return;
                const { page, errors } = await open();
                const at = await pointer(page);
                await page.mouse.move(at.x, at.y, { steps: 3 });
                let tops = await hoverTops(page, at);
                assert.ok(tops.row !== null && tops.row === tops.hl, `at rest ${JSON.stringify(tops)}`);
                await page.mouse.wheel(0, 520);
                await page.waitForFunction(() => document.querySelector('.content').scrollTop >= 500);
                tops = await hoverTops(page, at);
                assert.equal(tops.hl, tops.row, `after the wheel ${JSON.stringify(tops)}`);
                assert.equal(tops.height, 56);
                await page.evaluate(() => (document.querySelector('.content').scrollTop += 6 * 56));
                await page.waitForFunction(() => document.querySelector('.content').scrollTop >= 850);
                tops = await hoverTops(page, at);
                assert.equal(tops.hl, tops.row, `after a jump ${JSON.stringify(tops)}`);
                assert.deepEqual(errors, []);
                await page.close();
            });

            test('rows are 56 px with a 40 px cover, and the list has 12 px of air above the first row and below the last', TEST_OPTIONS, async (t) => {
                if (!guard(t)) return;
                const { page } = await open();
                const top = await page.evaluate(() => {
                    const list = document.getElementById('song-list').getBoundingClientRect();
                    const row = document.querySelector('#song-list .song-item');
                    const cover = row.querySelector('.song-cover').getBoundingClientRect();
                    const r = row.getBoundingClientRect();
                    return { row: r.height, cover: [cover.width, cover.height], above: Math.round(cover.top - r.top), below: Math.round(r.bottom - cover.bottom), pad: Math.round(r.top - list.top), engine: window.ITEM_HEIGHT };
                });
                assert.deepEqual(top, { row: 56, cover: [40, 40], above: 8, below: 8, pad: 12, engine: 56 });
                await page.evaluate(() => (document.querySelector('.content').scrollTop = 1e9));
                await page.waitForFunction((last) => [...document.querySelectorAll('#song-list .song-item:not(.lazy-skeleton) .song-title')].some((e) => e.textContent.trim() === last), `Song title number ${count}`);
                const end = await page.evaluate((last) => {
                    const row = [...document.querySelectorAll('#song-list .song-item:not(.lazy-skeleton)')].find((r) => r.querySelector('.song-title').textContent.trim() === last);
                    const c = document.querySelector('.content');
                    return { gap: Math.round(c.getBoundingClientRect().bottom - row.getBoundingClientRect().bottom), atEnd: Math.abs(c.scrollTop - (c.scrollHeight - c.clientHeight)) < 2 };
                }, `Song title number ${count}`);
                assert.deepEqual(end, { gap: 12, atEnd: true });
                await page.close();
            });

            test('selected rows read as one block: no rounded corner on any row (see ui-next-list-select.test.js)', TEST_OPTIONS, async (t) => {
                if (!guard(t)) return;
                const { page } = await open();
                const title = (i) => page.locator('#song-list .song-item').nth(i).locator('.song-title');
                await title(2).click();
                await page.keyboard.down('Shift');
                await title(4).click();
                await page.keyboard.up('Shift');
                await page.keyboard.down('Control');
                await title(7).click();
                await page.keyboard.up('Control');
                await page.waitForFunction(() => document.querySelectorAll('#selection-styles-set > div').length === 4);
                const radii = await page.evaluate(() => [...document.querySelectorAll('#selection-styles-set > div')].map((d) => getComputedStyle(d).borderRadius));
                assert.deepEqual(radii, ['0px', '0px', '0px', '0px']);
                await page.close();
            });

            test('the selection highlight follows its row when the list scrolls', TEST_OPTIONS, async (t) => {
                if (!guard(t)) return;
                const { page } = await open();
                await page.locator('#song-list .song-item').nth(3).locator('.song-title').click();
                await page.waitForSelector('#song-list .song-item.selected');
                const tops = () =>
                    page.evaluate(() => {
                        const row = document.querySelector('#song-list .song-item.selected');
                        const hl = document.querySelector('#selection-styles-set > div');
                        return { row: Math.round(row.getBoundingClientRect().top), hl: hl ? Math.round(hl.getBoundingClientRect().top) : null, content: Math.round(document.querySelector('.content').scrollTop) };
                    });
                const rest = await tops();
                assert.equal(rest.hl, rest.row, 'at rest');
                await page.mouse.move(700, 400);
                await page.mouse.wheel(0, 120);
                await page.waitForFunction(() => document.querySelector('.content').scrollTop >= 110);
                const moved = await tops();
                assert.ok(moved.content >= 110 && moved.row < rest.row, 'the row moved up with the scroll');
                assert.equal(moved.hl, moved.row, `after scrolling ${JSON.stringify(moved)}`);
                await page.close();
            });
        });
    }
});
