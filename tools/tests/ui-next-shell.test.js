// The new shell (src/ui-next/index.html) running the real, unchanged engine. Exit criterion for tasks A-03 and A-04:
// the behavioral gate in .agent/archive/ui-redesign/design/ENGINE-CONTRACT.md section 10. Real browser, real mouse, real (generated)
// WAV audio. Gate numbers below are the numbers in that table.
//
// Run:   node --test tools/tests/ui-next-shell.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const SECONDS = 6;
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const ADAPTER = path.join(NEXT_SRC, 'adapter', 'legacy-dom-adapter.js');
const ADAPTER_LINE_BUDGET = 250; // decision D13

// Engine elements whose node identity must survive the whole scenario (ENGINE-CONTRACT.md 5.1, gate 11).
const TRACKED_IDS = ['audio', 'play-btn', 'shuffle-btn', 'repeat-btn', 'repeat-one', 'next-btn', 'prev-btn', 'current-time', 'total-time', 'progress-bar', 'progress-knob', 'volume-slider', 'volume-fill', 'volume-knob', 'volume-icon', 'player-title', 'player-artist', 'player-cover', 'lyrics-toggle-btn', 'song-list', 'queue-list', 'search-input', 'left-panel', 'right-panel', 'tags-content', 'main-content', 'album-art-image'];
const TRACKED_SELECTORS = ['.progress-container', '.player-song-info'];

function writeWav(file) {
    const rate = 8000;
    const n = rate * SECONDS;
    const b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + n * 2, 4);
    b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 3000), 44 + i * 2);
    fs.writeFileSync(file, b);
}

// The fixture's copy of the engine plus the real src/ui-next folder, with the same electronAPI stub the old page gets.
function buildNextApp() {
    const dir = buildApp(30);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('<script src="../player.js">'), 'index.html loads ../player.js');
    fs.writeFileSync(file, html.replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    return dir;
}

function codeLines(file) {
    return fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

describe('ui-next shell with the real engine', { concurrency: false }, () => {
    let browser, dir, wav, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp();
        wav = path.join(dir, 'tone.wav');
        writeWav(wav);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    // Opens the new shell. With `play`, the first mouse click gives autoplay its user activation and a 4-song queue starts.
    async function open({ play = false } = {}) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const problems = { errors: [], failedRequests: [], consoleErrors: [] };
        page.on('pageerror', (e) => problems.errors.push(String(e.message)));
        page.on('requestfailed', (r) => problems.failedRequests.push(r.url()));
        page.on('console', (m) => m.type() === 'error' && problems.consoleErrors.push(m.text()));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        const url = 'file://' + wav.replace(/\\/g, '/');
        await page.evaluate((u) => SONGS_DATA.forEach((s) => (s.url = u)), url);
        if (play) {
            await page.mouse.click(5, 5);
            await startQueue(page, 4);
        }
        return { page, problems };
    }

    async function startQueue(page, count) {
        await page.evaluate((n) => createQueueFromSongList(SONGS_DATA.slice(0, n), 0, VIEWS.ALL_SONGS), count);
        await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 0.2, null, { timeout: 8000 });
    }

    const state = (page) =>
        page.evaluate(() => ({
            index: currentQueueIndex,
            length: playbackQueue.length,
            repeat: repeatMode,
            shuffled: isShuffled,
            paused: audioElement.paused,
            muted: audioElement.muted,
            volume: audioElement.volume,
            title: document.getElementById('player-title').textContent,
            hasSong: document.querySelector('.player-song-info').classList.contains('has-song'),
            repeatOne: document.getElementById('repeat-one').style.display
        }));

    // The engine swaps the glyph a moment after the audio element changes state, so tests wait for it.
    const glyph = (page, selector, name) => page.waitForFunction(([sel, cls]) => !!document.querySelector(`${sel} .${cls}`), [selector, name], { timeout: 3000 });

    async function clickAt(page, selector, fraction) {
        const box = await page.locator(selector).boundingBox();
        await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();
    }

    test('boots with no page error, failed request or console error; the engine finishes start-up', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open();
        assert.deepEqual(problems.errors, []);
        assert.deepEqual(problems.failedRequests, []);
        assert.deepEqual(problems.consoleErrors, []);
        assert.equal(await page.evaluate(() => document.body.hasAttribute('aria-busy')), false, 'the engine removes aria-busy when start-up is done');
        assert.equal(await page.evaluate(() => SONGS_DATA.length), 30);
        await page.close();
    });

    test('the controls the user touches are visible; the old panels are hidden', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        for (const selector of ['#play-btn', '#prev-btn', '#next-btn', '#shuffle-btn', '#repeat-btn', '.progress-container', '#volume-slider', '#volume-icon', '#player-title', '#back-btn', '#maximize-btn', '.rail-btn[data-view="library"]']) {
            assert.equal(await page.locator(selector).first().isVisible(), true, `${selector} is visible`);
        }
        for (const selector of ['#queue-list', '#legacy-host']) {
            assert.equal(await page.locator(selector).first().isVisible(), false, `${selector} is hidden`);
        }
        // B-03: the Library view shows the engine's song list in the view host.
        assert.equal(await page.locator('.view-host #song-list').first().isVisible(), true, '#song-list is shown in the view host');
        const inside = await page.evaluate(() => ['play-btn', 'progress-bar', 'volume-fill', 'player-cover'].every((id) => document.querySelector('.player-host').contains(document.getElementById(id))));
        assert.equal(inside, true, 'the player elements live in the player host');
        await page.close();
    });

    test('gate 1 and 2: start, pause and resume; the engine-written glyphs draw as Lucide icons (D12)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        const s = await state(page);
        assert.equal(s.index, 0);
        assert.equal(s.paused, false);
        assert.equal(s.title, 'Song title number 1');
        assert.equal(s.hasSong, true);
        await glyph(page, '#play-btn', 'fa-pause');
        const mask = () => page.evaluate(() => { const g = document.querySelector('#play-btn .fas'); const c = getComputedStyle(g); return { width: g.getBoundingClientRect().width, mask: c.maskImage || c.webkitMaskImage }; });
        let m = await mask();
        assert.ok(m.width >= 16, 'the glyph has a size');
        assert.match(m.mask, /^url\("data:image\/svg\+xml/, 'the glyph is a Lucide mask');
        await page.click('#play-btn');
        await page.waitForFunction(() => audioElement.paused);
        await glyph(page, '#play-btn', 'fa-play');
        m = await mask();
        assert.match(m.mask, /^url\("data:image\/svg\+xml/);
        await page.click('#play-btn');
        await page.waitForFunction(() => !audioElement.paused);
        await glyph(page, '#play-btn', 'fa-pause');
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('gate 3 and 4: next, previous and auto-advance at the end of a track', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.click('#next-btn');
        await page.waitForFunction(() => currentQueueIndex === 1);
        assert.equal((await state(page)).title, 'Song title number 2');
        await page.click('#prev-btn');
        await page.waitForFunction(() => currentQueueIndex === 0);
        assert.equal((await state(page)).title, 'Song title number 1');
        await page.waitForFunction(() => Number.isFinite(audioElement.duration) && audioElement.duration > 0);
        await page.evaluate(() => (audioElement.currentTime = audioElement.duration - 0.4));
        await page.waitForFunction(() => currentQueueIndex === 1, null, { timeout: 5000 });
        assert.equal((await state(page)).paused, false, 'the next track plays');
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('gate 5: a click on the seek bar seeks and keeps playing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await clickAt(page, '.progress-container', 0.8);
        await page.waitForTimeout(250);
        const s = await page.evaluate(() => ({ t: audioElement.currentTime, d: audioElement.duration, paused: audioElement.paused }));
        assert.ok(Math.abs(s.t - s.d * 0.8) < 0.6, `currentTime ${s.t} near 80% of ${s.d}`);
        assert.equal(s.paused, false);
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('gate 6: a click on the volume slider sets the volume (after the track fade-in, see D-3)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.waitForFunction(() => audioElement.currentTime > 1.5, null, { timeout: 8000 });
        await clickAt(page, '#volume-slider', 0.25);
        await page.waitForTimeout(150);
        const v = await page.evaluate(() => ({ volume: audioElement.volume, fill: parseFloat(document.getElementById('volume-fill').style.width) }));
        assert.ok(Math.abs(v.volume - 0.25) < 0.06, `volume ${v.volume}`);
        assert.ok(Math.abs(v.fill - 25) < 6, `fill ${v.fill}%`);
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('gate 7: mute and unmute', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await page.click('#volume-icon');
        await page.waitForFunction(() => audioElement.muted);
        await glyph(page, '#volume-icon', 'fa-volume-mute');
        const mask = await page.evaluate(() => getComputedStyle(document.querySelector('#volume-icon .fas')).maskImage);
        assert.match(mask, /^url\("data:image\/svg\+xml/, 'the mute glyph is a Lucide mask');
        await page.click('#volume-icon');
        await page.waitForFunction(() => !audioElement.muted);
        await glyph(page, '#volume-icon', 'fa-volume-up');
        await page.close();
    });

    test('gate 8: repeat cycles off, all, one, off and shows the "1" only for one', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        const seen = [];
        for (let i = 0; i < 3; i++) {
            await page.click('#repeat-btn');
            await page.waitForFunction((n) => repeatMode === n, [1, 2, 0][i]);
            const s = await state(page);
            seen.push([s.repeat, s.repeatOne, await page.locator('#repeat-btn').evaluate((b) => b.classList.contains('active'))]);
        }
        assert.deepEqual(seen, [[1, 'none', true], [2, 'block', true], [0, 'none', false]]);
        await page.close();
    });

    test('gate 9: the shuffle dialog turns shuffle on and marks the button', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.click('#shuffle-btn');
        await page.locator('.shuffle-mode-modal button', { hasText: 'Normal Shuffle' }).click();
        await page.waitForFunction(() => isShuffled === true);
        assert.equal(await page.locator('#shuffle-btn').evaluate((b) => b.classList.contains('active')), true);
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('gate 10: queue add and remove, and emptying the queue resets the player', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.evaluate(() => removeFromQueue(1));
        assert.equal((await state(page)).length, 3);
        const id = await page.evaluate(() => SONGS_DATA[10].id);
        await page.evaluate((songId) => addSongToQueueNext(songId), id);
        const q = await page.evaluate(() => ({ length: playbackQueue.length, next: playbackQueue[currentQueueIndex + 1].song.id }));
        assert.deepEqual(q, { length: 4, next: id });
        const rows = await page.evaluate(() => document.querySelectorAll('#queue-list .queue-item').length);
        assert.ok(rows >= 1, 'the engine renders queue rows into #queue-list');
        for (let i = 0; i < 4; i++) await page.evaluate(() => playbackQueue.length && removeFromQueue(0));
        const s = await state(page);
        assert.equal(s.length, 0, 'the queue is empty');
        assert.equal(s.hasSong, false, 'has-song is cleared');
        assert.equal(s.title, 'No song selected');
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('gate 11: every tracked engine element keeps its node through the whole scenario', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.evaluate(({ ids, selectors }) => {
            window.__before = {};
            for (const id of ids) window.__before[id] = document.getElementById(id);
            for (const s of selectors) window.__before[s] = document.querySelector(s);
        }, { ids: TRACKED_IDS, selectors: TRACKED_SELECTORS });
        await page.click('#play-btn');
        await page.click('#play-btn');
        await page.click('#next-btn');
        await page.click('#prev-btn');
        await clickAt(page, '.progress-container', 0.5);
        await page.click('#volume-icon');
        await page.click('#volume-icon');
        for (let i = 0; i < 3; i++) await page.click('#repeat-btn');
        await page.evaluate(() => { removeFromQueue(1); renderSongsList(getSongsForList(VIEWS.ALL_SONGS), VIEWS.ALL_SONGS); });
        await page.evaluate(() => emit('library:rebuilt'));
        await page.waitForTimeout(300);
        const changed = await page.evaluate(() => Object.entries(window.__before).filter(([key, node]) => !node || (key.startsWith('.') ? document.querySelector(key) : document.getElementById(key)) !== node).map(([key]) => key));
        assert.deepEqual(changed, []);
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('gate 12: library:rebuilt stops playback and resets the player', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.evaluate(() => emit('library:rebuilt'));
        await page.waitForFunction(() => audioElement.paused && document.getElementById('player-title').textContent === 'No song selected');
        assert.equal((await state(page)).hasSong, false);
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('rail, panel host and logo menu work, and never touch engine elements', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open({ play: true });
        await page.click('.rail-btn[data-view="settings"]');
        assert.equal(await page.locator('.rail-btn[aria-current="page"]').getAttribute('data-view'), 'settings');
        // Settings shows the engine's own page since D-05 (adapter/engine-view.js); the other rail items still show the empty view.
        assert.equal(await page.locator('.view-host .settings-panel-title').textContent(), 'Settings');
        await page.click('.panel-host__header .icon-btn');
        assert.equal(await page.locator('.panel-host').getAttribute('data-panel'), 'compact');
        await page.click('.panel-host__header .icon-btn');
        assert.equal(await page.locator('.panel-host').getAttribute('data-panel'), 'expanded');
        await page.click('.logo-btn');
        assert.equal(await page.locator('.menu').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.menu').count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement.className), 'logo-btn', 'focus returns to the logo');
        assert.equal((await state(page)).paused, false, 'playback is unaffected');
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('rail and title bar buttons have the component tooltip, not a native title', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, problems } = await open();
        await page.hover('.rail-btn[data-view="search"]');
        await page.waitForSelector('.tooltip:not([hidden])', { timeout: 3000 });
        const tip = await page.evaluate(() => {
            const box = document.querySelector('.tooltip').getBoundingClientRect();
            const rail = document.querySelector('.rail-btn[data-view="search"]').getBoundingClientRect();
            return { right: box.left >= rail.right, text: document.querySelector('.tooltip').textContent, hasTitle: document.querySelector('.rail-btn').hasAttribute('title') };
        });
        assert.equal(tip.right, true, 'rail tooltips open to the right');
        assert.match(tip.text, /Search/);
        assert.equal(tip.hasTitle, false);
        await page.mouse.move(600, 400);
        await page.hover('.close-app-btn');
        await page.waitForSelector('.tooltip:not([hidden])', { timeout: 3000 });
        assert.match(await page.locator('.tooltip').textContent(), /Close app/);
        assert.deepEqual(problems.errors, []);
        await page.close();
    });

    test('an engine context menu keeps its submenu arrow', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const arrow = await page.evaluate(() => {
            document.body.insertAdjacentHTML('beforeend', '<div class="context-menu active" style="left:40px;top:60px"><div class="context-menu-item submenu-parent"><i class="fas fa-plus"></i><span>Add to</span><i class="fas fa-chevron-right"></i></div></div>');
            const mark = document.querySelector('.context-menu i.fa-chevron-right').getBoundingClientRect();
            const plus = document.querySelector('.context-menu i.fa-plus').getBoundingClientRect();
            return { arrowShown: mark.width > 0, otherIconHidden: plus.width === 0 };
        });
        assert.deepEqual(arrow, { arrowShown: true, otherIconHidden: true });
        await page.close();
    });

    test('a narrow window collapses the panel, and widening brings the saved choice back', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const panel = () => page.locator('.panel-host').getAttribute('data-panel');
        const toggle = page.locator('.panel-host__header .icon-btn');
        await page.setViewportSize({ width: 1400, height: 800 });
        assert.equal(await panel(), 'expanded');
        await page.setViewportSize({ width: 900, height: 800 });
        await page.waitForFunction(() => document.querySelector('.panel-host').dataset.panel === 'compact');
        assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
        await toggle.click(); // opening it in a narrow window must not overwrite the saved choice
        assert.equal(await panel(), 'expanded');
        assert.equal(await page.evaluate(() => localStorage.getItem('xplayer.ui-next.panel')), null);
        await page.setViewportSize({ width: 1400, height: 800 });
        await page.waitForFunction(() => document.querySelector('.panel-host').dataset.panel === 'expanded');
        await toggle.click(); // a wide window saves the choice
        await page.setViewportSize({ width: 900, height: 800 });
        await page.setViewportSize({ width: 1400, height: 800 });
        await page.waitForFunction(() => document.querySelector('.panel-host').dataset.panel === 'compact');
        assert.equal(await page.evaluate(() => localStorage.getItem('xplayer.ui-next.panel')), 'compact');
        await page.close();
    });

    test('resizes down to the minimum window size without the player overflowing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open({ play: true });
        await page.setViewportSize({ width: 800, height: 600 });
        const overflow = await page.evaluate(() => {
            const bar = document.querySelector('.player-host').getBoundingClientRect();
            return { scrollsX: document.documentElement.scrollWidth > window.innerWidth, playerBottom: Math.round(bar.bottom), height: window.innerHeight, volumeRight: Math.round(document.getElementById('volume-slider').getBoundingClientRect().right) };
        });
        assert.equal(overflow.scrollsX, false, 'no horizontal overflow');
        assert.equal(overflow.playerBottom, overflow.height, 'the player stays at the bottom');
        assert.ok(overflow.volumeRight <= 800, 'the volume slider stays on screen');
        await page.close();
    });
});

describe('adapter boundary and size (gates 13 and 14)', () => {
    const files = walk(NEXT_SRC).filter((f) => /\.(js|css|html)$/.test(f) && !f.includes(`${path.sep}fonts${path.sep}`) && !f.includes(`${path.sep}dev${path.sep}`));
    const outsideAdapter = files.filter((f) => !f.startsWith(path.join(NEXT_SRC, 'adapter')));

    test('gate 13: nothing outside adapter/ uses the legacy list classes or the hidden host (register L-01)', () => {
        const offenders = outsideAdapter.filter((f) => /\.song-item|\.song-number-item|#song-list|song-list['"\s]|legacy-host/.test(fs.readFileSync(f, 'utf8')));
        assert.deepEqual(offenders.map((f) => path.relative(NEXT_SRC, f)), []);
    });

    test('gate 13: JavaScript outside adapter/ never looks up an element the adapter creates', () => {
        const ids = [...fs.readFileSync(ADAPTER, 'utf8').matchAll(/#([a-z][\w-]*)/g)].map((m) => m[1]);
        const looked = [...new Set(ids)].filter((id) => ids.length && !['maximize-icon'].includes(id));
        const offenders = [];
        for (const f of outsideAdapter.filter((x) => x.endsWith('.js'))) {
            const text = fs.readFileSync(f, 'utf8');
            for (const id of looked) if (new RegExp(`getElementById\\(\\s*['"]${id}['"]|querySelector(All)?\\(\\s*['"][^'"]*#${id}\\b`).test(text)) offenders.push(`${path.relative(NEXT_SRC, f)} -> #${id}`);
        }
        assert.deepEqual(offenders, []);
    });

    test(`gate 14: the adapter stays within ${ADAPTER_LINE_BUDGET} lines of code (D13)`, () => {
        const lines = codeLines(ADAPTER);
        assert.ok(lines <= ADAPTER_LINE_BUDGET, `legacy-dom-adapter.js has ${lines} code lines; the budget is ${ADAPTER_LINE_BUDGET}. Over budget means revisit D10.`);
    });
});
