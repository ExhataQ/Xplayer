// Modal dialogs in src/js/06b-modals.js: what has to be cleaned up when a dialog closes (D-09d-1).
// Each of these dialogs attaches a document keydown listener while it is open, and the edit-playlist dialog also puts
// window.handleEditPlaylistCover / window._editPlaylistTempCover on window. Closing the dialog, by any route
// (Cancel button, Escape, click on the overlay, or opening another dialog and closing that one), has to remove
// them. The close functions used to be reassigned by every dialog to arrange this; this test is the behavior they
// must keep, and it passes on the version before that was changed as well as after.
// A leaked keydown handler is seen with a probe: it calls preventDefault() on Enter/Escape, a closed dialog must not.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

describe('modal dialogs clean up when they close (real page)', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(5);
    });
    after(async () => {
        if (shared) await shared.page.close().catch(() => {});
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    // Loading the app takes about 1.2 s, so one page serves the whole file. Before a test gets it again it is reset
    // (any open dialog closed) and checked against the clean state a fresh page has; a page that is not clean is
    // replaced by a new one, so a leak is never carried into the next test.
    let shared = null;
    async function open() {
        if (shared) {
            if (shared.inUse) throw new Error('the shared page is still in use by another test');
            const clean = await shared.page
                .evaluate(() => {
                    closePlaylistModal();
                    closeAddLinkModal();
                    const swallowed = (key) => {
                        const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
                        document.dispatchEvent(e);
                        return e.defaultPrevented;
                    };
                    return (
                        document.querySelectorAll('.playlist-modal-overlay').length === 0 &&
                        !swallowed('Enter') &&
                        !swallowed('Escape') &&
                        typeof window.handleEditPlaylistCover === 'undefined' &&
                        typeof window._editPlaylistTempCover === 'undefined'
                    );
                })
                .catch(() => false);
            if (clean) {
                shared.errors.length = 0;
                shared.inUse = true;
                return shared;
            }
            await shared.page.close().catch(() => {});
            shared = null;
        }
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        shared = { page, errors, inUse: true };
        return shared;
    }
    const release = async () => {
        if (shared) shared.inUse = false;
    };

    // true when some keydown listener called preventDefault() on a synthetic key press on the document.
    const swallows = (page, key) =>
        page.evaluate((k) => {
            const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
            document.dispatchEvent(e);
            return e.defaultPrevented;
        }, key);
    const overlays = (page) => page.evaluate(() => document.querySelectorAll('.playlist-modal-overlay').length);
    const cancel = (page) => page.click('.playlist-modal-cancel-btn');
    const helpers = (page) =>
        page.evaluate(() => ({ cover: typeof window.handleEditPlaylistCover, temp: typeof window._editPlaylistTempCover }));
    const show = (page, call) => page.evaluate(call);

    const DIALOGS = {
        'create playlist': 'showCreatePlaylistDialog()',
        'edit playlist': "showEditPlaylistDialog(createPlaylist('P').id)",
        'create folder': 'showCreateFolderDialog()',
        'edit folder': "showEditFolderDialog(createFolder('F').id)",
        'add link': 'showAddLinkDialog()'
    };

    test('with no dialog open, Enter and Escape are not swallowed (the probe is meaningful)', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            assert.equal(await swallows(page, 'Enter'), false);
            assert.equal(await swallows(page, 'Escape'), false);
            await page.evaluate(() => closePlaylistModal());
            await page.evaluate(() => closeAddLinkModal());
            assert.deepEqual(errors, []);
        } finally {
            await release();
        }
    });

    for (const [name, call] of Object.entries(DIALOGS)) {
        // Enter in an edit dialog saves and closes it, so only the create / link dialogs are probed while open.
        const enterWhileOpen = !name.startsWith('edit');

        test(`${name}: while open Enter is handled; Cancel closes it and removes its keydown handler`, async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await show(page, call);
                assert.equal(await overlays(page), 1);
                if (enterWhileOpen) assert.equal(await swallows(page, 'Enter'), true, 'the open dialog handles Enter');
                await cancel(page);
                assert.equal(await overlays(page), 0);
                assert.equal(await swallows(page, 'Enter'), false);
                assert.equal(await swallows(page, 'Escape'), false);
                assert.deepEqual(errors, []);
            } finally {
                await release();
            }
        });

        test(`${name}: Escape closes it and removes its keydown handler`, async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await show(page, call);
                await page.keyboard.press('Escape');
                assert.equal(await overlays(page), 0);
                assert.equal(await swallows(page, 'Enter'), false);
                assert.equal(await swallows(page, 'Escape'), false);
                assert.deepEqual(errors, []);
            } finally {
                await release();
            }
        });

        // add link has its own overlay test below: on the version before D-09d-1 it leaked its handler here.
        if (name !== 'add link') test(`${name}: a click on the overlay closes it and removes its keydown handler`, async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                await show(page, call);
                await page.mouse.click(5, 5);
                assert.equal(await overlays(page), 0);
                assert.equal(await swallows(page, 'Enter'), false);
                assert.deepEqual(errors, []);
            } finally {
                await release();
            }
        });

        test(`${name}: it can be opened and closed again and again`, async (t) => {
            if (skip) return void t.skip(skip);
            const { page, errors } = await open();
            try {
                for (let i = 0; i < 3; i++) {
                    await show(page, call);
                    assert.equal(await overlays(page), 1);
                    if (enterWhileOpen) assert.equal(await swallows(page, 'Enter'), true);
                    await cancel(page);
                    assert.equal(await overlays(page), 0);
                    assert.equal(await swallows(page, 'Enter'), false);
                }
                assert.deepEqual(errors, []);
            } finally {
                await release();
            }
        });
    }

    // These two have no keydown handler. The overlay closes both; the played-data dialog also has a Close button
    // (the create-item buttons open the create dialogs instead).
    test('create item and played data dialogs: a click on the overlay closes them, and Close closes played data', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            for (const call of ['showCreateItemDialog()', 'showPlayedDataModal(SONGS_DATA[0].id)']) {
                await show(page, call);
                assert.equal(await overlays(page), 1, call);
                await page.mouse.click(5, 5);
                assert.equal(await overlays(page), 0, `${call}: overlay click`);
            }
            await show(page, 'showPlayedDataModal(SONGS_DATA[0].id)');
            await page.evaluate(() => document.querySelector('.playlist-modal button').click());
            assert.equal(await overlays(page), 0, 'played data: Close button');
            await show(page, 'showCreateItemDialog()');
            await page.evaluate(() => document.querySelector('.playlist-modal button').click()); // "Playlist": swaps in the create dialog
            assert.equal(await overlays(page), 1);
            assert.equal(await page.evaluate(() => document.querySelector('.playlist-modal-title').textContent.trim().length > 0), true);
            assert.deepEqual(errors, []);
        } finally {
            await release();
        }
    });

    test('edit playlist: its window helpers exist while it is open and are removed when it closes', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            assert.deepEqual(await helpers(page), { cover: 'undefined', temp: 'undefined' });
            await show(page, DIALOGS['edit playlist']);
            assert.deepEqual(await helpers(page), { cover: 'function', temp: 'object' }); // _editPlaylistTempCover is null
            await cancel(page);
            assert.deepEqual(await helpers(page), { cover: 'undefined', temp: 'undefined' });
            assert.deepEqual(errors, []);
        } finally {
            await release();
        }
    });

    test('a dialog opened over another one: closing the newer one also cleans up the older one', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            // Opening a dialog removes the previous dialog's elements but does not run its cleanup.
            await show(page, DIALOGS['edit playlist']);
            await show(page, DIALOGS['create playlist']);
            await show(page, DIALOGS['create folder']);
            assert.equal(await overlays(page), 1);
            assert.equal((await helpers(page)).cover, 'function', 'the replaced edit dialog has not been cleaned up yet');
            await cancel(page);
            assert.equal(await overlays(page), 0);
            assert.deepEqual(await helpers(page), { cover: 'undefined', temp: 'undefined' });
            assert.equal(await swallows(page, 'Enter'), false);
            assert.equal(await swallows(page, 'Escape'), false);
            assert.deepEqual(errors, []);
        } finally {
            await release();
        }
    });

    test('add link: a click on the overlay removes its keydown handler (it was left attached before D-09d-1)', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await show(page, DIALOGS['add link']);
            await page.mouse.click(5, 5);
            assert.equal(await overlays(page), 0);
            assert.equal(await swallows(page, 'Enter'), false, 'Enter must not be swallowed after the dialog is gone');
            assert.equal(await swallows(page, 'Escape'), false);
            assert.deepEqual(errors, []);
        } finally {
            await release();
        }
    });

    test('add link opened twice: one close removes both keydown handlers', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await show(page, DIALOGS['add link']);
            await show(page, DIALOGS['add link']);
            assert.equal(await overlays(page), 1);
            await cancel(page);
            assert.equal(await overlays(page), 0);
            assert.equal(await swallows(page, 'Enter'), false);
            assert.equal(await swallows(page, 'Escape'), false);
            assert.deepEqual(errors, []);
        } finally {
            await release();
        }
    });

    test('closing an add-link dialog does not touch a playlist dialog opened after it, and vice versa', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await open();
        try {
            await show(page, DIALOGS['add link']);
            await show(page, DIALOGS['create playlist']); // replaces the link dialog's elements
            await page.evaluate(() => closeAddLinkModal()); // removes the link dialog's handler (and the visible overlay)
            await show(page, DIALOGS['create playlist']);
            assert.equal(await swallows(page, 'Enter'), true, 'the new playlist dialog still handles Enter');
            await cancel(page);
            assert.equal(await swallows(page, 'Enter'), false);
            assert.deepEqual(errors, []);
        } finally {
            await release();
        }
    });
});
