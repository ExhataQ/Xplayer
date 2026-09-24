// Regression tests for a class of bug: several views write their own content directly into
// #song-list (settings, advanced settings, albums, recently played, search history) instead
// of going through renderSongsList(). If a big virtualized list was showing right before,
// #song-list is left with a stale `song-list--virtual` class and an explicit inline height
// (set by the main list's virtual scroll to `songCount * ITEM_HEIGHT`), and that leftover
// state bleeds into whatever gets written next:
//   - a huge blank scrollable area below the real content (the height never gets reset), and
//   - for views that reuse the `.song-item` class for their own rows (albums, recently
//     played), every row gets absolute-positioned with no transform and stacks on top of
//     itself instead of laying out normally.
// These tests call the render functions directly (not via switchView()) because switchView()
// already clears virtual-scroll state itself before routing - the bug only shows up for
// callers that reach these functions some other way (e.g. browser back/forward), so testing
// through switchView() alone would not catch a regression here.
//
// Run:   cd electron && npm test            (or: node --test tools/tests/view-switch-song-list-cleanup.test.js)
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 30000 };
const SONG_COUNT = 800; // above VIRTUAL_SCROLL_THRESHOLD (200), so All Songs virtualizes

describe('leaving a virtualized song list never leaves stale height/positioning behind', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(SONG_COUNT);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function openApp() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(900);
        return { page, errors };
    }

    // Puts the page back into a big virtualized All Songs list, and confirms it really is
    // virtualized (and #song-list really does have a large inline height) before the caller
    // does whatever it's testing - otherwise a false pass would just mean this setup silently
    // stopped working, not that the fix held.
    async function ensureVirtualizedAllSongs(page) {
        await page.evaluate(() => switchView('all-songs'));
        await page.waitForTimeout(150);
        const before = await page.evaluate(() => ({
            enabled: virtualScrollState.enabled,
            height: document.getElementById('song-list').style.height
        }));
        assert.equal(before.enabled, true, 'setup: All Songs should be virtualized with 800 songs');
        assert.ok(parseInt(before.height, 10) > 5000, 'setup: #song-list should have a large inline height before the test even starts');
    }

    // What "cleaned up" means for #song-list after leaving a virtualized list.
    async function songListCleanupState(page) {
        return page.evaluate(() => {
            const el = document.getElementById('song-list');
            return {
                hasVirtualClass: el.classList.contains('song-list--virtual'),
                inlineHeight: el.style.height
            };
        });
    }

    // For views that reuse `.song-item` for their own rows (albums, recently played): if the
    // stale virtual-positioning CSS were still active, every row would render at the same
    // spot (no transform ever gets set on them) instead of stacking downward normally.
    async function rowsAreStackedNotOverlapping(page) {
        return page.evaluate(() => {
            const rows = [...document.querySelectorAll('#song-list .song-item')];
            if (rows.length < 2) return true;
            const tops = rows.map((r) => r.getBoundingClientRect().top);
            return tops.every((t, i) => i === 0 || t > tops[i - 1]);
        });
    }

    const scenarios = [
        {
            name: 'settings panel',
            open: () => window.toggleSettingsPanel()
        },
        {
            name: 'advanced settings panel',
            open: () => window.toggleSettingsPanel() // needs to land on settings first
        },
        {
            name: 'albums view',
            open: () => window.renderAlbumsView(),
            checkStacking: true
        },
        {
            name: 'recently played view',
            open: () => window.renderRecentlyPlayed()
        },
        {
            name: 'search history view',
            open: () => window.renderSearchHistoryView()
        }
    ];

    for (const scenario of scenarios) {
        test(`${scenario.name}: leaves no stale virtual-list class or height on #song-list`, TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page, errors } = await openApp();
            await ensureVirtualizedAllSongs(page);

            if (scenario.name === 'advanced settings panel') {
                // Reach it the way it's actually reached: settings panel first, then advanced.
                await page.evaluate(() => window.toggleSettingsPanel());
                await page.waitForTimeout(50);
                await page.evaluate(() => window.openAdvancedSettings());
            } else {
                await page.evaluate(scenario.open);
            }
            await page.waitForTimeout(150);

            const state = await songListCleanupState(page);
            assert.equal(state.hasVirtualClass, false, `${scenario.name}: #song-list should not still have song-list--virtual`);
            assert.equal(state.inlineHeight, '', `${scenario.name}: #song-list should not still have a leftover inline height`);

            if (scenario.checkStacking) {
                assert.equal(await rowsAreStackedNotOverlapping(page), true, `${scenario.name}: rows should be laid out top-to-bottom, not stacked on top of each other`);
            }

            assert.deepEqual(errors, []);
            await page.close();
        });
    }

    test('switching back to All Songs after settings re-virtualizes cleanly', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await ensureVirtualizedAllSongs(page);

        await page.evaluate(() => window.toggleSettingsPanel());
        await page.waitForTimeout(150);
        await page.evaluate(() => window.toggleSettingsPanel());
        await page.waitForTimeout(150);

        const after = await page.evaluate(() => ({
            enabled: virtualScrollState.enabled,
            realRows: document.querySelectorAll('#song-list .song-item:not(.lazy-skeleton)').length,
            height: document.getElementById('song-list').style.height
        }));
        assert.equal(after.enabled, true, 'All Songs should be virtualized again after closing settings');
        assert.ok(after.realRows > 0, 'real song rows should be rendered again, not left empty');
        assert.ok(parseInt(after.height, 10) > 5000, '#song-list height should reflect the full song count again');

        assert.deepEqual(errors, []);
        await page.close();
    });
});
