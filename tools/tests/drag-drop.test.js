// Drag and drop (src/js/06f-drag-drop-songs.js, 06g-drag-drop-left-panel.js): behavior in the real page.
// These tests drive the real mouse (mousedown, move past the 5px threshold, move over a target, mouseup) and check
// what the user can see and what gets stored. They were written against the classic-script version and must keep
// passing unchanged when the two files are ES modules (D-09c), which is the point: the conversion must not change
// behavior. See drag-drop-modules.test.js for the module wiring itself.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

describe('drag and drop in the real page', { concurrency: false }, () => {
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

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        return { page, errors };
    }

    // Point inside an element: fx/fy are fractions of its width/height (default: the middle).
    const point = (page, selector, fx = 0.5, fy = 0.5) =>
        page.evaluate(
            ([sel, x, y]) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: r.left + r.width * x, y: r.top + r.height * y };
            },
            [selector, fx, fy]
        );

    // Press on `from`, move past the drag threshold, then over `to` in steps. Leaves the button down.
    async function dragOver(page, from, to) {
        assert.ok(from && to, 'drag endpoints must exist');
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + 12, from.y + 12);
        await page.mouse.move(to.x, to.y, { steps: 8 });
    }
    const drop = (page) => page.mouse.up();

    const state = (page) =>
        page.evaluate(() => ({
            ghosts: [...document.querySelectorAll('.drag-song-tooltip')].map((g) => g.textContent),
            dragging: document.body.classList.contains('dragging-song'),
            noSelect: document.body.classList.contains('no-select'),
            cursor: document.body.style.cursor,
            invalid: document.querySelectorAll('.drag-invalid').length,
            hover: document.querySelectorAll('.drag-hover, .drag-folder-hover').length,
            indicators: document.querySelectorAll('.pinned-drop-indicator').length,
            panelHover: document.getElementById('left-panel').classList.contains('drag-panel-hover')
        }));
    const idle = { ghosts: [], dragging: false, noSelect: false, cursor: '', invalid: 0, hover: 0, indicators: 0, panelHover: false };

    const SONG = (id) => `#song-list .song-item[data-song-id="${id}"]`;
    // Grab a row by its title: the artist and album links carry data-stop-mousedown and never start a drag.
    const SONG_GRAB = (id) => `${SONG(id)} .song-title`;
    const LEFT = (view) => `.left-panel-main-item[data-view="${view}"]`;

    describe('06f: dragging songs', () => {
        test('a song dropped on Liked Songs is liked; the ghost and the drag styling exist only during the drag', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                assert.equal(await page.evaluate(() => isFavorite(1)), false);
                const title = await page.evaluate(() => document.querySelector('#song-list .song-item[data-song-id="1"] .song-title').textContent);
                await dragOver(page, await point(page, SONG_GRAB(1)), await point(page, LEFT('favorites')));
                const during = await state(page);
                assert.equal(during.ghosts.length, 1);
                assert.ok(during.ghosts[0].includes(title), `ghost "${during.ghosts[0]}" should show "${title}"`);
                assert.equal(during.dragging, true);
                assert.equal(during.noSelect, true);
                assert.equal(during.cursor, 'not-allowed');
                assert.ok(during.invalid > 0, 'items that cannot take a song are marked');
                assert.equal(await page.evaluate(() => document.querySelectorAll('.left-panel-main-item.drag-hover').length), 1);
                await drop(page);
                assert.equal(await page.evaluate(() => isFavorite(1)), true);
                assert.deepEqual(await state(page), idle);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('a song dropped on a playlist is added once; dropping it again adds nothing', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                const playlistId = await page.evaluate(() => {
                    createPlaylist('Drag Target');
                    renderLeftPanelMainList();
                    return getPlaylists()[0].id;
                });
                const target = `.left-panel-main-item[data-view="playlist-${playlistId}"]`;
                for (let i = 0; i < 2; i++) {
                    await dragOver(page, await point(page, SONG_GRAB(2)), await point(page, target));
                    await drop(page);
                }
                assert.deepEqual(await page.evaluate(() => getPlaylists()[0].songs), [2]);
                assert.deepEqual(await state(page), idle);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('dropping on an item that cannot take songs (an album) is not a hover target; it falls back to the panel drop and likes the song', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                const album = await page.evaluate(() => document.querySelector('.left-panel-main-item[data-view^="a"]:not([data-view="all-songs"])').dataset.view);
                await dragOver(page, await point(page, SONG_GRAB(3)), await point(page, LEFT(album)));
                assert.equal(await page.evaluate(() => document.querySelectorAll('.left-panel-main-item.drag-hover').length), 0, 'no hover highlight on an invalid item');
                assert.equal((await state(page)).panelHover, true, 'the whole panel is highlighted instead');
                await drop(page);
                assert.equal(await page.evaluate(() => isFavorite(3)), true);
                assert.deepEqual(await state(page), idle);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('dropping on empty left-panel space likes the song', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                // Bottom edge of #left-panel: inside the panel, not necessarily over an item.
                const spot = await point(page, '#left-panel', 0.5, 0.995);
                assert.equal(await page.evaluate((p) => !!document.elementFromPoint(p.x, p.y)?.closest('#left-panel'), spot), true, 'test setup: the point is inside the left panel');
                await dragOver(page, await point(page, SONG_GRAB(4)), spot);
                await drop(page);
                assert.equal(await page.evaluate(() => isFavorite(4)), true);
                assert.deepEqual(await state(page), idle);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('dropping over the song list itself changes nothing and clears the drag styling', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await dragOver(page, await point(page, SONG_GRAB(1)), await point(page, SONG_GRAB(3)));
                assert.equal((await state(page)).ghosts.length, 1);
                await drop(page);
                assert.equal(await page.evaluate(() => [1, 2, 3].some((id) => isFavorite(id))), false);
                assert.deepEqual(await state(page), idle);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('a click that stays under the 5px threshold starts no drag', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                const from = await point(page, SONG_GRAB(2));
                await page.mouse.move(from.x, from.y);
                await page.mouse.down();
                await page.mouse.move(from.x + 2, from.y + 2);
                assert.deepEqual(await state(page), idle);
                await page.mouse.up();
                assert.equal(await page.evaluate(() => isFavorite(2)), false);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('only the left button drags', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                const from = await point(page, SONG_GRAB(3));
                await page.mouse.move(from.x, from.y);
                await page.mouse.down({ button: 'right' });
                await page.mouse.move(from.x + 40, from.y + 40, { steps: 4 });
                assert.deepEqual(await state(page), idle);
                await page.mouse.up({ button: 'right' });
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('dragging a selected song with others selected moves all of them', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await page.evaluate(() => {
                    selectedSongIds.add(1);
                    selectedSongIds.add(2);
                    document.querySelector('#song-list .song-item[data-song-id="1"]').classList.add('selected');
                });
                await dragOver(page, await point(page, SONG_GRAB(1)), await point(page, LEFT('favorites')));
                assert.deepEqual((await state(page)).ghosts, ['2 items']);
                await drop(page);
                assert.deepEqual(await page.evaluate(() => [isFavorite(1), isFavorite(2)]), [true, true]);
                assert.deepEqual(await state(page), idle);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('losing window focus mid-drag cancels it and cleans up, without liking anything', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await dragOver(page, await point(page, SONG_GRAB(1)), await point(page, LEFT('favorites')));
                assert.equal((await state(page)).ghosts.length, 1);
                await page.evaluate(() => window.dispatchEvent(new Event('blur')));
                assert.deepEqual(await state(page), idle);
                await drop(page);
                assert.equal(await page.evaluate(() => isFavorite(1)), false);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });
    });

    describe('06g: dragging left-panel items', () => {
        const pins = (page) => page.evaluate(() => getPinnedItems());

        test('a pinned item dropped on the top or bottom half of another pinned item is reordered', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await page.evaluate(() => {
                    savePinnedItems(['all-songs', 'favorites']);
                    renderLeftPanelMainList();
                });
                // favorites above all-songs
                await dragOver(page, await point(page, LEFT('favorites')), await point(page, LEFT('all-songs'), 0.5, 0.2));
                assert.equal((await state(page)).indicators, 1, 'a drop indicator is shown');
                await drop(page);
                assert.deepEqual(await pins(page), ['favorites', 'all-songs']);
                // and back: favorites below all-songs
                await dragOver(page, await point(page, LEFT('favorites')), await point(page, LEFT('all-songs'), 0.5, 0.8));
                await drop(page);
                assert.deepEqual(await pins(page), ['all-songs', 'favorites']);
                assert.deepEqual(await state(page), idle);
                assert.equal(await page.evaluate(() => [...document.querySelectorAll('.left-panel-main-item')].some((e) => e.style.opacity === '0.4')), false);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('an unpinned item dropped on a pinned item becomes pinned at that position', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await page.evaluate(() => {
                    savePinnedItems(['all-songs', 'favorites']);
                    renderLeftPanelMainList();
                });
                const album = await page.evaluate(() => document.querySelector('.left-panel-main-item[data-view^="a"]:not([data-view="all-songs"])').dataset.view);
                await dragOver(page, await point(page, LEFT(album)), await point(page, LEFT('favorites'), 0.5, 0.2));
                await drop(page);
                assert.deepEqual(await pins(page), ['all-songs', album, 'favorites']);
                assert.deepEqual(await state(page), idle);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });

        test('a press that stays under the 5px threshold starts no drag, and dropping on nothing changes no pins', async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await page.evaluate(() => {
                    savePinnedItems(['all-songs', 'favorites']);
                    renderLeftPanelMainList();
                });
                // a real drag that ends over the song list (not a left-panel item)
                await dragOver(page, await point(page, LEFT('favorites')), await point(page, SONG_GRAB(3)));
                assert.equal((await state(page)).ghosts.length, 1);
                await drop(page);
                assert.deepEqual(await pins(page), ['all-songs', 'favorites']);
                assert.deepEqual(await state(page), idle);
                // a press that moves under the threshold (the release is a normal click, so do this last)
                const from = await point(page, LEFT('favorites'));
                await page.mouse.move(from.x, from.y);
                await page.mouse.down();
                await page.mouse.move(from.x + 2, from.y + 1);
                assert.deepEqual(await state(page), idle);
                await page.mouse.up();
                assert.deepEqual(await pins(page), ['all-songs', 'favorites']);
                assert.deepEqual(errors, []);
            } finally {
                await page.close();
            }
        });
    });
});
