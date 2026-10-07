// Real-browser tests for the lyrics, metadata and panel views whose buttons run through data-action.
// They use real mouse clicks, so a click that never reaches the delegated listener on document fails here.
//
// Run:   node --test tools/tests/lyrics-panel-handlers.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 30000 };
const SRC = path.join(__dirname, '../../src/js');

describe('lyrics, metadata and panel views converted to data-action', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(25);
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
        await page.waitForTimeout(700);
        await page.evaluate(() => {
            SONGS_DATA.forEach((s) => {
                if (typeof s.duration === 'number') s.duration = Math.floor(s.duration / 60) + ':' + String(s.duration % 60).padStart(2, '0');
            });
            audioElement.play = () => Promise.resolve();
            audioElement.pause = () => {};
            setPlaybackQueue(SONGS_DATA.slice(0, 3).map((s, i) => ({ song: s, listId: VIEWS.ALL_SONGS, ghostSlot: i })));
            setCurrentQueueIndex(0);
        });
        return { page, errors };
    }

    const lyricsOf = (page, i) => page.evaluate((n) => getCustomLyricsStore()[SONGS_DATA[n].url] || null, i);
    const SYNC_LINES = `openSyncEditor(); syncEditorState.lines = [{ text: 'one', time: 1 }, { text: 'two', time: 2 }, { text: 'three', time: 3 }, { text: '', time: 4, instrumental: true }]; syncEditorState.focusedIndex = 0; renderSyncEditorLines();`;
    const times = (page) => page.evaluate(() => syncEditorState.lines.map((l) => l.time));

    test('no inline on...= handler is left in the converted files', () => {
        const files = ['08b-panel-album-art.js', '08e-panel-settings.js', '08g-panel-saved-lyrics.js', '11b-lyrics-import.js',
            '11c-sync-editor-shell.js', '11d-sync-editor-lines.js', '18-lyrics-editor.js', '19-online-lyrics.js', '20-metadata-editor.js'];
        for (const file of files) {
            const text = fs.readFileSync(path.join(SRC, file), 'utf8');
            const found = text.match(/\bon(click|change|input|keydown|mousedown|contextmenu|dblclick|blur|error)\s*=\s*["'\\]|setAttribute\(\s*['"]on/g);
            assert.equal(found, null, `${file} still has an inline handler: ${found}`);
        }
        // 08d keeps one: the close button of the extended info panel sits inside #extended-info-content, which
        // stops clicks inline in build/music_player.html, so a delegated click could never reach it.
        const d = fs.readFileSync(path.join(SRC, '08d-panel-right-tabs.js'), 'utf8').match(/\bon[a-z]+\s*=\s*"/g);
        assert.deepEqual(d, ['onclick="']);
    });

    test('lyrics editor: Save stores the text, the modal keeps clicks, the backdrop closes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => openLyricsEditor());
        await page.locator('.lyrics-editor-modal').click({ position: { x: 5, y: 5 } });
        assert.ok(await page.locator('#lyrics-editor-overlay').isVisible(), 'a click inside the modal must not close it');
        await page.locator('#lyrics-editor-textarea').fill('hello world');
        await page.locator('.lyrics-editor-btn-primary').click();
        assert.equal(await lyricsOf(page, 0), 'hello world');
        await page.evaluate(() => openLyricsEditor());
        await page.locator('#lyrics-editor-overlay').click({ position: { x: 3, y: 3 } });
        assert.equal(await page.locator('#lyrics-editor-overlay.active').count(), 0, 'the backdrop closes it');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('lyrics editor: Clear removes the saved lyrics', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => { setLyricsForSong(SONGS_DATA[0].id, 'abc'); openLyricsEditor(); });
        await page.locator('.lyrics-editor-btn-danger').click();
        assert.ok(!(await lyricsOf(page, 0)));
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('saved lyrics: a key with an apostrophe opens and deletes the right entry', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => {
            SONGS_DATA[2].url = "file:///music/it's a song.mp3";
            setLyricsForSong(SONGS_DATA[2].id, 'quoted');
            openAdvancedSettings();
            renderSavedLyricsList();
        });
        await page.locator('#saved-lyrics-list .library-location-item').first().click();
        assert.ok(await page.locator('#saved-lyrics-overlay').isVisible());
        await page.locator('.saved-lyrics-modal [title="Delete lyrics"]').click();
        assert.ok(!(await lyricsOf(page, 2)), 'the entry is gone');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('sync editor: clicking a line focuses it; shift buttons change the time and keep the focus', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(SYNC_LINES);
        await page.locator('.sync-editor-line[data-index="2"]').click({ position: { x: 4, y: 4 } });
        assert.equal(await page.evaluate(() => syncEditorState.focusedIndex), 2);
        await page.locator('.sync-editor-line[data-index="1"] .sync-editor-shift-btn').nth(3).click();
        assert.deepEqual(await times(page), [1, 2.1, 3, 4]);
        assert.equal(await page.evaluate(() => syncEditorState.focusedIndex), 2, 'the row did not take the click');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('sync editor: right-click on the time clears it without a menu; elsewhere on the row opens the menu', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(SYNC_LINES);
        await page.locator('.sync-editor-line[data-index="1"] .sync-editor-time').click({ button: 'right' });
        assert.deepEqual(await times(page), [1, null, 3, 4]);
        assert.equal(await page.locator('.sync-line-context-menu').count(), 0);
        await page.locator('.sync-editor-line[data-index="2"] .sync-editor-text').click({ button: 'right' });
        assert.ok(await page.locator('.sync-line-context-menu').count() > 0, 'the line menu opens');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('sync editor: double-click edits a line; an instrumental line cannot be edited', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(SYNC_LINES);
        await page.locator('.sync-editor-line[data-index="3"] .sync-editor-text').dblclick();
        assert.equal(await page.locator('.sync-editor-line[data-index="3"] .sync-editor-text-input').count(), 0);
        await page.locator('.sync-editor-line[data-index="1"] .sync-editor-text').dblclick();
        assert.equal(await page.locator('.sync-editor-line[data-index="1"] .sync-editor-text-input').count(), 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('settings: the sliders change the stored value and their label', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => openSettingsPanel());
        const set = (n, v) => page.locator('input[type=range]').nth(n).evaluate((el, value) => {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, v);
        await set(0, '7.5');
        await set(3, '3');
        const state = await page.evaluate(() => ({
            s: getAudioPlaybackSettings(),
            labels: [...document.querySelectorAll('input[type=range]')].map((r) => r.nextElementSibling && r.nextElementSibling.textContent)
        }));
        assert.equal(state.s.crossfadeDuration, 7.5);
        assert.equal(state.s.replayGainTrimDb, 3);
        assert.equal(state.labels[0], '7.5s');
        assert.equal(state.labels[3], '+3 dB');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('online lyrics: a result opens and closes; its buttons do not toggle the row', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => {
            window.electronAPI = {
                searchOnlineLyrics: async () => ({
                    success: true,
                    exact: true,
                    results: Array.from({ length: 6 }, (_, i) => ({ trackName: 'T' + i, artistName: 'A', albumName: 'B', duration: 200, syncedLyrics: '[00:01.00]x', plainLyrics: 'p' + i }))
                })
            };
            openOnlineLyricsSearchView(SONGS_DATA[0], true);
        });
        await page.waitForSelector('.online-lyrics-result-header');
        const selected = () => page.locator('.online-lyrics-result').evaluateAll((rows) => rows.map((r, i) => (r.classList.contains('selected') ? i : -1)).filter((i) => i >= 0));
        await page.locator('.online-lyrics-result-header').nth(2).click();
        assert.deepEqual(await selected(), [2]);
        await page.locator('.online-lyrics-result.selected .online-lyrics-expand').click();
        assert.deepEqual(await selected(), [], 'the arrow closes the open row instead of toggling it twice');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('metadata editor: Enter adds a value, the x removes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => {
            window.electronAPI = new Proxy({ getAudioMetadata: async () => ({ success: true, metadata: { title: 'T', artist: 'A', album: 'B', genre: 'G', year: '2000', track: '1' } }) }, {
                get: (target, key) => (key in target ? target[key] : key === 'then' ? undefined : (...args) => (/^on[A-Z]/.test(String(key)) ? () => {} : Promise.resolve(null)))
            });
            return openMetadataEditor();
        });
        await page.waitForTimeout(300);
        const input = page.locator('.metadata-multi-input').first();
        const before = await page.locator('.metadata-multi-chip').count();
        await input.fill('Zed');
        await input.press('Enter');
        assert.equal(await page.locator('.metadata-multi-chip').count(), before + 1);
        await page.locator('.metadata-multi-chip button').last().click();
        assert.equal(await page.locator('.metadata-multi-chip').count(), before);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('right panel: the header title navigates to the playing source; a right-click opens its menu', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => { currentView = VIEWS.FAVORITES; switchRightPanelTab('tags'); });
        await page.locator('#right-panel-header-title').click();
        await page.waitForTimeout(100);
        assert.ok(await page.evaluate(() => currentView), 'a view is shown');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('clicks on a stopped element do not reach other document listeners (selected songs stay selected)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => {
            selectedSongIds.add(SONGS_DATA[5].id);
            selectedSongIds.add(SONGS_DATA[6].id);
            updateTrackNextBox();
        });
        await page.locator('.track-next-item').hover();
        await page.locator('.track-next-play-btn').click();
        assert.equal(await page.evaluate(() => selectedSongIds.size), 2, 'the click was swallowed below document, as with the inline handler');
        assert.equal(await page.evaluate(() => currentQueueIndex), 1, 'and it still played the next track');
        assert.deepEqual(errors, []);
        await page.close();
    });
});
