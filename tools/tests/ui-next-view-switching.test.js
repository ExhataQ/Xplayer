// Changing the main view, in the real shell and engine (shell/view-router.js, shell/view-registry.js, shell/shell.js).
//
// What this guards, each of which was a real way for the view to break:
//   - a view leaving something behind on the shared view host (data-lyrics-mode="sync" kept hiding the engine's content, so Library and
//     Settings came back blank after Sync had been open once), by the rail and by mouse back/forward;
//   - the Sync editor's "Discard Sync?" dialog answering later: the click that opened it was lost and the person had to click again;
//   - the engine changing page by itself (the Library toolbar stayed over Settings, Lyrics stayed over Favorites);
//   - the big AI view.
//
// Run:   node --test tools/tests/ui-next-view-switching.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const TEST_OPTIONS = { timeout: 60000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

// Only the AI status is faked: it makes the chat button and the big view available.
const STUB = `<script>
window.__ai = { state: { enabled: true, privacyAccepted: true, hasKey: true, last4: '1234', model: 'a/b:free', translateLanguage: '', autoTranslate: false, encryptionAvailable: true, songFields: ['title'] } };
const fake = { aiGetStatus: async () => ({ ...window.__ai.state }), aiListModels: async () => ({ ok: true, models: [] }), aiKeyInfo: async () => ({ ok: true, info: {} }), aiJournalList: async () => [] };
window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : fake[k] || ((...a) => (/^on[A-Z]/.test(String(k)) ? () => {} : Promise.resolve(null)))) });
</script>\n`;

describe('Changing the main view', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => STUB + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        return { page, errors };
    }

    const rail = (page, view) => page.locator(`.rail-btn[data-view="${view}"]`).click();
    // The Library rail item only opens the panel. The way back to the song list is a row in that panel ("All Songs"): the engine opens its
    // page by itself, and the shell has to follow. It is clicked from the page so a dialog on top of the window does not get in the way.
    const clickAllSongs = (page) =>
        page.evaluate(() => [...document.querySelectorAll('.panel-host .subfolder-row')].find((row) => /All Songs/.test(row.textContent)).click());
    const toLibrary = async (page) => {
        await clickAllSongs(page);
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
    };
    const mouse = (page, button) =>
        page.evaluate((b) => {
            document.body.dispatchEvent(new MouseEvent('mousedown', { button: b, bubbles: true, cancelable: true }));
            document.body.dispatchEvent(new MouseEvent('mouseup', { button: b, bubbles: true, cancelable: true }));
        }, button);
    const viewOf = (page) => page.evaluate(() => document.querySelector('.view-host').dataset.view);
    const hostAttrs = (page) => page.evaluate(() => Object.keys(document.querySelector('.view-host').dataset).sort());
    const railOf = (page) => page.evaluate(() => document.querySelector('.rail-btn[aria-current="page"]')?.dataset.view || null);
    const visibleRows = (page) =>
        page.evaluate(() => [...document.querySelectorAll('.view-host .song-item')].filter((row) => { const b = row.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).length);
    const play = (page) =>
        page.evaluate(() => {
            const song = window.SONGS_DATA[0];
            song.duration = '03:00.00';
            window.setLyricsForSong(song.id, 'Line one\nLine two\n\nLine three');
            window.playSongFromList(song.id);
        });
    // The Lyrics item opens the Sync tool when a song is playing; with timings stamped, leaving it asks "Discard Sync?".
    async function toSyncWithTimings(page) {
        await play(page);
        await rail(page, 'lyrics');
        await page.waitForSelector('#sync-editor-overlay.active');
        await page.click('.sync-editor-source-bar button:has-text("Load Plain Lyrics")');
        await page.waitForSelector('.sync-editor-line');
        await page.evaluate(() => {
            syncEditorState.lines[0].time = 1;
        });
    }
    const dialogs = (page) => page.locator('#confirm-ok-btn').count();

    test('Sync once, then Metadata, Settings and Library: nothing is left on the host and every page draws', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await rail(page, 'lyrics');
        await page.waitForSelector('#sync-editor-overlay.active');
        assert.ok((await hostAttrs(page)).includes('lyricsMode'), 'precondition: Lyrics marks the host');
        await rail(page, 'metadata');
        await page.waitForSelector('.view-host[data-view="metadata"]');
        assert.equal((await hostAttrs(page)).includes('lyricsMode'), false, 'Metadata starts on a clean host');
        await rail(page, 'settings');
        await page.waitForSelector('.view-host[data-view="settings"]');
        assert.deepEqual(await hostAttrs(page), ['engine', 'view']);
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.view-host .content-wrapper')).display), 'block', 'Settings is not hidden');
        await toLibrary(page);
        await page.waitForSelector('.view-host[data-view="library"] .song-item');
        assert.ok((await visibleRows(page)) >= 10, 'the song list is drawn');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('mouse back and forward through Lyrics, Metadata, Settings and AI to Library draw the Library every time', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await play(page);
        await rail(page, 'lyrics');
        await page.waitForSelector('#sync-editor-overlay.active');
        await rail(page, 'settings');
        await rail(page, 'metadata');
        await toLibrary(page);
        for (let step = 0; step < 4; step++) await mouse(page, 3);
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
        assert.ok((await visibleRows(page)) >= 10, 'back to the first Library');
        for (let step = 0; step < 4; step++) await mouse(page, 4);
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
        assert.ok((await visibleRows(page)) >= 10, 'forward to the last Library');
        assert.equal(await railOf(page), 'library');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the big AI view goes to every rail item and back, and the Library draws after it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        for (const target of ['settings', 'lyrics', 'metadata', 'home']) {
            await page.locator('button[aria-label="AI chat"]').click();
            await page.locator('.ai-popup').waitFor();
            await page.getByRole('button', { name: 'Expand to the big view' }).click();
            await page.locator('.view-host .ai-chat--view').waitFor();
            await rail(page, target);
            await page.waitForFunction((v) => document.querySelector('.view-host').dataset.view === v, target);
        }
        await toLibrary(page);
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
        assert.ok((await visibleRows(page)) >= 10);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Sync with timings: going to the Library asks once, Discard goes to Library without a second click, Keep Editing stays', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await toSyncWithTimings(page);
        await clickAllSongs(page);
        await page.waitForSelector('#confirm-ok-btn');
        assert.equal(await viewOf(page), 'lyrics', 'still asking');
        await clickAllSongs(page); // a second try while the dialog is open must not ask again
        assert.equal(await dialogs(page), 1);
        await page.click('#confirm-cancel-btn'); // Keep Editing
        await page.waitForFunction(() => !document.getElementById('confirm-ok-btn'));
        await page.waitForTimeout(300);
        assert.equal(await viewOf(page), 'lyrics');
        assert.equal(await page.evaluate(() => document.getElementById('sync-editor-overlay').classList.contains('active')), true, 'the editor and its timings are still there');

        await clickAllSongs(page);
        await page.waitForSelector('#confirm-ok-btn');
        await page.click('#confirm-ok-btn'); // Discard
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
        assert.ok((await visibleRows(page)) >= 10);
        assert.equal(await page.evaluate(() => document.getElementById('sync-editor-overlay').classList.contains('active')), false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Sync with timings: the choice made while the dialog is open is the one that happens (Settings, then Metadata)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toSyncWithTimings(page);
        await rail(page, 'settings');
        await page.waitForSelector('#confirm-ok-btn');
        // The dialog covers the page; the router is told directly, as the menu or a hotkey would.
        await page.evaluate(() => document.querySelector('.rail-btn[data-view="metadata"]').click());
        assert.equal(await dialogs(page), 1);
        await page.click('#confirm-ok-btn');
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'metadata');
        await page.close();
    });

    test('Sync with timings: mouse back asks, and Discard then goes back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await toSyncWithTimings(page);
        await mouse(page, 3);
        await page.waitForSelector('#confirm-ok-btn');
        assert.equal(await viewOf(page), 'lyrics');
        await mouse(page, 3); // a second press while the question is open does nothing
        assert.equal(await dialogs(page), 1);
        await page.click('#confirm-ok-btn');
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
        assert.ok((await visibleRows(page)) >= 10);
        await mouse(page, 4); // forward again works: the history was not corrupted by the wait
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'lyrics');
        await page.close();
    });

    test('the engine changes page by itself: the shell follows, so no view keeps the toolbar or styles of another', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate(() => window.switchView('settings'));
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'settings');
        assert.equal(await page.locator('.view-host .songlist-bar').count(), 0, 'the Library toolbar is gone from Settings');
        assert.equal(await railOf(page), 'settings');

        await toLibrary(page);
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
        await play(page);
        await rail(page, 'lyrics');
        await page.waitForSelector('.lyrics-bar');
        await page.evaluate(() => window.switchView('favorites')); // as the end of a song or "go to the playing song" does
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'library');
        assert.equal(await page.evaluate(() => window.currentView), 'favorites', 'the page the engine chose is the page shown');
        assert.equal(await page.locator('.view-host .lyrics-bar').count(), 0);

        await rail(page, 'home');
        await page.evaluate(() => window.switchView('settings')); // hidden behind Home: nothing on screen changes, and the rail does not lie
        await page.waitForTimeout(300);
        assert.deepEqual([await viewOf(page), await railOf(page)], ['home', 'home']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the player bar lyrics button still opens Lyrics from any view', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await rail(page, 'home');
        await page.evaluate(() => window.switchView('lyrics'));
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'lyrics');
        await page.close();
    });

    test('Home card, then back: the playlist opens in Library and back returns to Home with Home drawn', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await rail(page, 'home');
        await page.waitForSelector('.view-host[data-view="home"] .home');
        await toLibrary(page);
        await mouse(page, 3);
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'home');
        assert.equal(await page.locator('.view-host .home').count(), 1);
        assert.deepEqual(errors, []);
        await page.close();
    });
});
