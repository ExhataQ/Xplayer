// window.updateExternalScrollbar: the one name no file declares. initExternalScrollbar('main-content', ...) in
// src/js/06c-scrollbar-widget.js publishes it during start-up, and about 20 call sites in other files use it as a
// bare global (tools/lint-globals.js allows exactly this name). Four of those callers (render of the song list,
// search results, search history, recents:cleared) call it unguarded from a setTimeout, so it has to exist before
// those timers fire. This checks the behavior in the real page:
//   - start-up: every timer that calls it finds it defined, and nothing throws;
//   - callback: it updates the MAIN content scrollbar (not a side panel's), and shows/hides the thumb by overflow;
//   - a later initExternalScrollbar() for another element does not replace it.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

describe('window.updateExternalScrollbar (published by the main-content scrollbar)', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    // Opens a fresh page. probe=true records, for every setTimeout callback whose source mentions
    // updateExternalScrollbar, whether the function existed when the callback ran and whether it threw.
    async function open({ probe = false } = {}) {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        if (probe) {
            await page.addInitScript(() => {
                window.__timerRuns = [];
                // gotoApp's own timer tracker wraps window.setTimeout after this script runs, and its wrapper calls
                // whatever window.setTimeout was when it started (this wrapper). The accessor keeps this wrapper
                // outermost, so it sees the app's own callback; the tracker's assignment is called next, and the
                // re-entrant call from the tracker goes to the real setTimeout.
                const realSet = window.setTimeout.bind(window);
                let tracker = null;
                let nested = false;
                const outer = (fn, ms, ...args) => {
                    if (nested) return realSet(fn, ms, ...args);
                    let callback = fn;
                    // The source text only picks WHICH timers to watch; what is asserted is what they find at run time.
                    if (typeof fn === 'function' && Function.prototype.toString.call(fn).includes('updateExternalScrollbar')) {
                        callback = (...a) => {
                            const record = { definedWhenRun: typeof window.updateExternalScrollbar === 'function', threw: null };
                            try {
                                return fn(...a);
                            } catch (e) {
                                record.threw = String(e);
                                throw e;
                            } finally {
                                window.__timerRuns.push(record);
                            }
                        };
                    }
                    if (!tracker) return realSet(callback, ms, ...args);
                    nested = true;
                    try {
                        return tracker(callback, ms, ...args);
                    } finally {
                        nested = false;
                    }
                };
                Object.defineProperty(window, 'setTimeout', {
                    configurable: true,
                    get: () => outer,
                    set: (v) => {
                        tracker = v;
                    }
                });
            });
        }
        await gotoApp(page, dir);
        return { page, errors };
    }

    test('start-up: the three scrollbars are set up, and timers that call it find it defined', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open({ probe: true });
        try {
            const state = await page.evaluate(() => ({
                published: typeof window.updateExternalScrollbar,
                instanceIds: (window.scrollbarInstances || []).map((i) => i.content && i.content.id),
                timerRuns: window.__timerRuns
            }));
            assert.equal(state.published, 'function');
            assert.deepEqual(state.instanceIds, ['main-content', 'right-panel-content', 'left-panel-main-content']);
            // renderSongsList schedules at least one such timer during start-up; make sure the check below really ran.
            assert.ok(state.timerRuns.length >= 1, `expected at least one start-up timer calling updateExternalScrollbar, got ${state.timerRuns.length}`);
            assert.deepEqual(
                state.timerRuns.filter((r) => !r.definedWhenRun || r.threw),
                []
            );
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('calling it updates the main-content thumb: shown with a size when content overflows, hidden when it fits', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            const r = await page.evaluate(() => {
                const content = document.getElementById('main-content');
                const mainThumb = document.getElementById('external-scrollbar-thumb');
                const rightThumb = document.getElementById('right-panel-scrollbar-thumb');
                const leftThumb = document.getElementById('left-panel-scrollbar-thumb');
                const snapshot = (el) => el.getAttribute('style') || '';
                const out = {};

                // Overflowing content: a tall spacer inside the scroll container.
                const spacer = document.createElement('div');
                spacer.style.cssText = 'height:6000px;width:1px;';
                content.appendChild(spacer);
                const sideBefore = [snapshot(rightThumb), snapshot(leftThumb)];
                window.updateExternalScrollbar();
                out.overflowDisplay = mainThumb.style.display;
                out.overflowHeight = parseInt(mainThumb.style.height, 10);
                out.sideUntouched = JSON.stringify(sideBefore) === JSON.stringify([snapshot(rightThumb), snapshot(leftThumb)]);

                // Content that fits: remove the spacer and make the container taller than its content.
                spacer.remove();
                content.style.setProperty('height', '20000px', 'important');
                content.style.setProperty('flex', 'none', 'important');
                out.fitsScrollable = content.scrollHeight > content.clientHeight;
                window.updateExternalScrollbar();
                out.fitsDisplay = mainThumb.style.display;
                out.fitsHeight = mainThumb.style.height;
                return out;
            });
            assert.equal(r.overflowDisplay, 'block');
            assert.ok(r.overflowHeight >= 30, `thumb height ${r.overflowHeight}`);
            assert.equal(r.sideUntouched, true, 'the side panels thumbs must not change');
            assert.equal(r.fitsScrollable, false, 'test setup: the container should now be taller than its content');
            assert.equal(r.fitsDisplay, 'none');
            assert.equal(r.fitsHeight, '0px');
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });

    test('a later initExternalScrollbar() for another element adds an instance but does not replace the published function', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            const r = await page.evaluate(() => {
                const before = window.updateExternalScrollbar;
                const countBefore = window.scrollbarInstances.length;
                for (const id of ['extra-content', 'extra-scrollbar', 'extra-thumb']) {
                    const el = document.createElement('div');
                    el.id = id;
                    document.body.appendChild(el);
                }
                initExternalScrollbar('extra-content', 'extra-scrollbar', 'extra-thumb');
                return {
                    added: window.scrollbarInstances.length - countBefore,
                    same: window.updateExternalScrollbar === before
                };
            });
            assert.equal(r.added, 1);
            assert.equal(r.same, true);
            assert.deepEqual(errors, []);
        } finally {
            await page.close();
        }
    });
});
