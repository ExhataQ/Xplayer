// Real-browser tests for the playback controls that run through data-action: the queue's
// "Load more" button and the buttons of the shuffle-mode dialog. They use real mouse clicks, so
// a click that never reaches document (and so never reaches the delegated listener) fails here.
//
// Run:   node --test tools/tests/playback-handlers.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 30000 };
const SONG_COUNT = 60; // above the 50 songs Smart Shuffle needs

describe('playback controls converted to data-action', { concurrency: false }, () => {
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
        await gotoApp(page, dir);
        await page.evaluate(() => {
            audioElement.play = () => Promise.resolve();
            audioElement.pause = () => {};
            window.__reachedDocument = [];
            document.addEventListener('click', (e) => window.__reachedDocument.push(e.target.className || e.target.tagName), false);
        });
        return { page, errors };
    }

    const queueOf = (n, listId) => `setPlaybackQueue(SONGS_DATA.slice(0, ${n}).map((s, i) => ({ song: s, listId: ${listId}, ghostSlot: i }))); setCurrentQueueIndex(0);`;
    const IN_ALL_SONGS = `currentView = VIEWS.ALL_SONGS; ${queueOf(5, 'VIEWS.ALL_SONGS')}`;
    const IN_FAVORITES = `currentView = VIEWS.FAVORITES; for (let i = 0; i < 3; i++) saveFavorite(SONGS_DATA[i].id); ${queueOf(3, 'VIEWS.FAVORITES')}`;

    async function openShuffleDialog(page) {
        await page.locator('#shuffle-btn').click();
        await page.locator('.shuffle-mode-modal').waitFor();
        await page.evaluate(() => { window.__reachedDocument.length = 0; });
    }
    const clickButton = (page, text) => page.locator('.shuffle-mode-modal button', { hasText: text }).first().click();
    const dialogOpen = (page) => page.evaluate(() => !!document.querySelector('.shuffle-mode-overlay'));
    const shuffleState = (page) => page.evaluate(() => ({ isShuffled, shuffleMode }));

    test('no inline on...= handler is left in 15b and 10c', (t) => {
        for (const file of ['playback/15b-controls-shuffle-btn.js', 'playback/10c-playback-queue.js']) {
            const text = fs.readFileSync(path.join(__dirname, '../../src/js', file), 'utf8');
            const found = text.match(/\bon(click|change|input|keydown|mousedown|contextmenu|dblclick|blur|error)\s*=\s*["'\\]/g);
            assert.equal(found, null, `${file} still has an inline handler: ${found}`);
        }
    });

    test('queue: scrolling to the end loads more songs, with no button, until the queue is out', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(() => {
            setPlaybackQueue(SONGS_DATA.slice(0, 40).map((s, i) => ({ song: s, listId: VIEWS.ALL_SONGS, ghostSlot: i })));
            setCurrentQueueIndex(0);
            setQueueDisplayLimit(5);
            switchRightPanelTab('queue');
            // With no song loaded the right panel shows placeholders and does not scroll; a song is playing in real use.
            document.querySelector('.right-panel-content-wrapper')?.classList.remove('showing-placeholders');
            updateQueueDisplay();
        });
        const items = () => page.locator('#queue-list .queue-item').count();
        // The scroller is the nearest ancestor that scrolls. Scrolling it to the end asks for the next page.
        const scrollToEnd = () =>
            page.evaluate(() => {
                let n = document.getElementById('queue-list').parentElement;
                while (n && n !== document.body && !['auto', 'scroll'].includes(getComputedStyle(n).overflowY)) n = n.parentElement;
                if (n && n !== document.body) n.scrollTop = n.scrollHeight;
            });
        const total = await page.evaluate(() => playbackQueue.length);
        assert.equal(await page.locator('#queue-list .queue-load-more-btn').count(), 0, 'there is no Load more button');
        for (let i = 0; i < 20 && (await items()) < total; i++) {
            await scrollToEnd();
            await page.waitForTimeout(150);
        }
        assert.equal(await items(), total, 'scrolling to the end loads the rest of the queue');
        assert.ok((await page.evaluate(() => queueDisplayLimit)) >= total);
        assert.equal(await page.locator('#queue-list .queue-load-more-btn').count(), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('shuffle dialog: "Normal Shuffle" turns shuffle on and closes the dialog', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(IN_ALL_SONGS);
        await openShuffleDialog(page);
        await clickButton(page, 'Normal Shuffle');
        assert.equal(await dialogOpen(page), false);
        assert.deepEqual(await shuffleState(page), { isShuffled: true, shuffleMode: 'normal' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('shuffle dialog: "Turn Shuffle Off" is offered while shuffled and turns it off', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(IN_ALL_SONGS);
        await openShuffleDialog(page);
        assert.equal(await page.locator('.shuffle-mode-modal button', { hasText: 'Turn Shuffle Off' }).count(), 0, 'not offered while shuffle is off');
        await clickButton(page, 'Normal Shuffle');
        await openShuffleDialog(page);
        await clickButton(page, 'Turn Shuffle Off');
        assert.equal(await dialogOpen(page), false);
        assert.equal((await shuffleState(page)).isShuffled, false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('shuffle dialog: "Turn Shuffle Off" also works while Smart Shuffle is on', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(IN_ALL_SONGS);
        await openShuffleDialog(page);
        await clickButton(page, 'Smart Shuffle');
        assert.deepEqual(await shuffleState(page), { isShuffled: true, shuffleMode: 'smart' });
        await openShuffleDialog(page);
        await clickButton(page, 'Turn Shuffle Off');
        assert.equal(await dialogOpen(page), false);
        assert.equal((await shuffleState(page)).isShuffled, false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('shuffle dialog: "Smart Shuffle" works on a list of more than 50 songs', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(IN_ALL_SONGS);
        await openShuffleDialog(page);
        assert.equal(await page.locator('.shuffle-mode-modal button', { hasText: 'Smart Shuffle' }).first().isDisabled(), false);
        await clickButton(page, 'Smart Shuffle');
        assert.equal(await dialogOpen(page), false);
        assert.deepEqual(await shuffleState(page), { isShuffled: true, shuffleMode: 'smart' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('shuffle dialog: "Smart Shuffle" is disabled on a short list and a click does nothing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(IN_FAVORITES);
        await openShuffleDialog(page);
        const smart = page.locator('.shuffle-mode-modal button', { hasText: 'Smart Shuffle' }).first();
        assert.equal(await smart.isDisabled(), true);
        assert.equal(await smart.getAttribute('data-action'), null, 'a disabled button carries no action');
        const box = await smart.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        assert.equal(await dialogOpen(page), true, 'the dialog stays open');
        assert.deepEqual(await shuffleState(page), { isShuffled: false, shuffleMode: 'normal' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('shuffle dialog: clicks inside it stay inside, and a click on the backdrop closes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(IN_ALL_SONGS);
        await openShuffleDialog(page);
        await page.locator('.shuffle-mode-modal h3').click();
        await page.locator('.shuffle-mode-modal p').click();
        const box = await page.locator('.shuffle-mode-modal').boundingBox();
        await page.mouse.click(box.x + 4, box.y + 4);
        assert.equal(await dialogOpen(page), true, 'text and padding do not close it');
        assert.deepEqual(await page.evaluate(() => window.__reachedDocument), [], 'those clicks do not leave the dialog');
        await page.mouse.click(5, 5);
        assert.equal(await dialogOpen(page), false, 'the backdrop closes it');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('shuffle dialog: a click on an action button does not clear the selected songs', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openApp();
        await page.evaluate(IN_ALL_SONGS);
        await openShuffleDialog(page);
        await page.evaluate(() => { selectedSongIds.add(SONGS_DATA[0].id); selectedSongIds.add(SONGS_DATA[1].id); });
        await clickButton(page, 'Normal Shuffle');
        assert.equal(await page.evaluate(() => selectedSongIds.size), 2);
        assert.deepEqual(errors, []);
        await page.close();
    });
});
