// Tooltip rollout and the shared Space rule in the new shell (task A-08). Real browser, real engine, real mouse and keyboard.
//
// Run:   node --test tools/tests/ui-next-tooltips.test.js
// Needs: npm i -D playwright   (see scroll.test.js for setup notes)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 60000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

const STUB = `<script>
window.electronAPI = new Proxy({}, { get: (t, k) => {
    if (k === 'then') return undefined;
    return (...a) => { if (/^on[A-Z]/.test(String(k))) return () => {}; return Promise.resolve(null); };
} });
</script>
`;

// A few seconds of a quiet tone: enough for the engine to really play.
function writeWav(file) {
    const rate = 8000, n = rate * 8, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 3000), 44 + i * 2);
    fs.writeFileSync(file, b);
}

function buildNextApp() {
    const dir = buildApp(30);
    fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
    const file = path.join(dir, 'ui-next', 'index.html');
    let html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('<script src="../player.js">'), 'index.html loads ../player.js');
    html = html.replace('<script src="../player.js">', () => STUB + '<script src="../player.js">');
    fs.writeFileSync(file, html);
    return dir;
}

describe('tooltip rollout and shared Space rule in the new shell with the real engine', { concurrency: false }, () => {
    let browser, dir, skip, songUrl;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildNextApp();
        writeWav(path.join(dir, 'tone.wav'));
        songUrl = 'file://' + path.join(dir, 'tone.wav').replace(/\\/g, '/');
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
        await waitForAppSettled(page, 3000);
        return { page, errors };
    }
    const hoverAway = async (page) => {
        await page.mouse.move(700, 420);
        await page.waitForFunction(() => document.querySelector('#ui-tooltip')?.hidden !== false, null, { timeout: 2000 });
    };
    const read = (page) =>
        page.evaluate(() => {
            const q = (s) => document.querySelector(`#ui-tooltip ${s}`);
            const shown = (s) => (q(s).hidden ? '' : q(s).textContent);
            return { name: q('.tooltip__name').textContent, state: shown('.tooltip__state'), description: shown('.tooltip__description'), shortcut: shown('.tooltip__shortcut') };
        });
    const tip = async (page) => {
        await page.waitForSelector('#ui-tooltip:not([hidden])', { timeout: 3000 });
        return read(page);
    };
    // The engine's old tooltip is a .custom-tooltip div; the seek bar's time preview is one too and is not part of this.
    const oldTooltipShown = (page) =>
        page.evaluate(() => [...document.querySelectorAll('.custom-tooltip')].filter((n) => !n.classList.contains('progress-tooltip') && getComputedStyle(n).opacity === '1').map((n) => n.textContent));
    const hoverTip = async (page, selector) => {
        await hoverAway(page);
        await page.hover(selector);
        return tip(page);
    };
    // A control the way the engine builds one: a title, and a mouse that has not been over it yet.
    const addTitled = (page, attrs, html = 'x') =>
        page.evaluate(([a, h]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'probe';
            for (const [k, v] of Object.entries(a)) b.setAttribute(k, v);
            b.innerHTML = h;
            Object.assign(b.style, { position: 'fixed', left: '600px', top: '300px', zIndex: '5' });
            document.body.append(b);
        }, [attrs, html]);

    // ---------------------------------------------------------------- the engine's controls

    test('the engine\'s row buttons get the shared tooltip, and neither the old tooltip nor a title attribute is left', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        assert.deepEqual(await hoverTip(page, '.add-to-queue-btn'), { name: 'Add to queue', state: '', description: 'Plays right after the current song', shortcut: '' });
        await page.waitForTimeout(500);
        assert.deepEqual(await oldTooltipShown(page), [], 'no old tooltip over the queue button');
        assert.deepEqual(await hoverTip(page, '.favorite-btn'), { name: 'Add to favorites', state: '', description: '', shortcut: '' });
        assert.deepEqual(await hoverTip(page, '.more-info'), { name: 'More options for Song title number 1', state: '', description: '', shortcut: '' });
        await page.waitForTimeout(500);
        assert.deepEqual(await oldTooltipShown(page), [], 'no old tooltip over the row menu button');
        const left = await page.evaluate(() => [...document.querySelectorAll('.add-to-queue-btn, .favorite-btn, .more-info, #back-btn, #forward-btn')].filter((n) => n.hasAttribute('title') || n.hasAttribute('data-original-title')).length);
        assert.equal(left, 0, 'no title or data-original-title on the controls');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('controls that have their own tooltip are not shown twice: the title bar buttons lose the engine\'s text and get no data-tip', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.hover('.rail-btn[data-view="library"]');
        assert.equal((await tip(page)).name, 'Library');
        const counts = await page.evaluate(() => ({
            tooltips: document.querySelectorAll('#ui-tooltip').length,
            bound: [...document.querySelectorAll('#back-btn, #forward-btn, .rail-btn, .titlebar .icon-btn')].filter((n) => n.hasAttribute('data-tip')).length
        }));
        assert.deepEqual(counts, { tooltips: 1, bound: 0 });
        assert.deepEqual(await oldTooltipShown(page), []);
        await page.close();
    });

    test('a toggle keeps its tooltip after a click and shows the new text (favorite)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.equal((await hoverTip(page, '.favorite-btn')).name, 'Add to favorites');
        await page.click('.favorite-btn');
        await page.waitForFunction(() => {
            const n = document.querySelector('#ui-tooltip');
            return !n.hidden && n.querySelector('.tooltip__name').textContent === 'Remove from favorites';
        }, null, { timeout: 3000 });
        assert.deepEqual(await oldTooltipShown(page), []);
        await page.close();
    });

    // ---------------------------------------------------------------- what the bridge does with a title

    test('a title that ends in a shortcut shows it in the shortcut slot; other brackets stay in the name', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await addTitled(page, { title: 'Stamp current time (F1)' });
        assert.deepEqual(await hoverTip(page, '.probe'), { name: 'Stamp current time', state: '', description: '', shortcut: 'F1' });
        await page.evaluate(() => (document.querySelector('.probe').title = 'Ctrl+click opens it (maybe)'));
        assert.equal((await hoverTip(page, '.probe')).name, 'Ctrl+click opens it (maybe)');
        assert.equal((await read(page)).shortcut, '');
        await page.close();
    });

    test('the engine rewriting a title is followed, emptying it removes the tooltip, and no native title is ever left behind', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await addTitled(page, { title: 'First' });
        assert.equal((await hoverTip(page, '.probe')).name, 'First');
        await page.evaluate(() => (document.querySelector('.probe').title = 'Second'));
        await page.waitForFunction(() => !document.querySelector('.probe').hasAttribute('title'), null, { timeout: 1000 });
        assert.equal(await page.getAttribute('.probe', 'data-tip'), 'Second');
        assert.equal((await hoverTip(page, '.probe')).name, 'Second');
        await page.evaluate(() => document.querySelector('.probe').setAttribute('data-original-title', 'Third'));
        await page.waitForFunction(() => document.querySelector('.probe').getAttribute('data-tip') === 'Third', null, { timeout: 1000 });
        assert.equal(await page.getAttribute('.probe', 'data-original-title'), null);
        await page.evaluate(() => document.querySelector('.probe').setAttribute('title', ''));
        await page.waitForFunction(() => !document.querySelector('.probe').hasAttribute('data-tip') && !document.querySelector('.probe').hasAttribute('title'), null, { timeout: 1000 });
        await hoverAway(page);
        await page.hover('.probe');
        await page.waitForTimeout(800);
        assert.equal(await page.evaluate(() => document.querySelector('#ui-tooltip').hidden), true, 'an emptied title shows nothing');
        await page.close();
    });

    test('an icon-only control keeps an accessible name when its title is taken over; a control with text keeps its own', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await addTitled(page, { title: 'Rename', id: 'iconOnly' }, '<i class="fas fa-pen"></i>');
        await addTitled(page, { title: 'Rename the playlist', id: 'withText' }, 'Rename');
        await page.evaluate(() => (document.getElementById('withText').style.top = '400px'));
        await page.hover('#iconOnly');
        await page.hover('#withText');
        const names = await page.evaluate(() => [document.getElementById('iconOnly').getAttribute('aria-label'), document.getElementById('withText').getAttribute('aria-label')]);
        assert.deepEqual(names, ['Rename', null]);
        await page.close();
    });

    test('a disabled control shows no tooltip', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await addTitled(page, { title: 'Nope', disabled: '' });
        await addTitled(page, { title: 'Nope either', 'aria-disabled': 'true', id: 'ariaOff' });
        await page.evaluate(() => (document.getElementById('ariaOff').style.top = '360px'));
        for (const selector of ['.probe[disabled]', '#ariaOff']) {
            await page.mouse.move(700, 420);
            await page.hover(selector, { force: true });
            await page.waitForTimeout(800);
            assert.equal(await page.evaluate(() => document.querySelector('#ui-tooltip')?.hidden !== false), true, selector);
        }
        await page.close();
    });

    // ---------------------------------------------------------------- behavior

    test('the tooltip waits for a hover, hides on a press and stays quiet until the pointer comes back, and Escape hides it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await addTitled(page, { title: 'Probe' });
        await hoverAway(page);
        await page.waitForTimeout(400); // out of the warm window of an earlier tooltip
        await page.hover('.probe');
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => document.querySelector('#ui-tooltip')?.hidden !== false), true, 'not before the delay');
        await tip(page);
        await page.mouse.down();
        assert.equal(await page.evaluate(() => document.querySelector('#ui-tooltip').hidden), true, 'a press hides it');
        await page.mouse.up();
        await page.mouse.move(603, 303);
        await page.mouse.move(606, 306);
        await page.waitForTimeout(800);
        assert.equal(await page.evaluate(() => document.querySelector('#ui-tooltip').hidden), true, 'moving inside the control does not bring it back');
        await page.mouse.move(700, 420);
        await page.hover('.probe');
        await tip(page);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.querySelector('#ui-tooltip').hidden), true, 'Escape hides it');
        await page.close();
    });

    test('keyboard focus shows the tooltip at once, and moving focus away hides it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await addTitled(page, { title: 'Focus me' });
        await page.mouse.move(700, 420);
        await page.keyboard.press('Shift'); // a key press first: focus that follows it counts as keyboard focus
        await page.evaluate(() => document.querySelector('.probe').focus());
        assert.equal((await tip(page)).name, 'Focus me');
        await page.evaluate(() => document.querySelector('.probe').blur());
        await page.waitForFunction(() => document.querySelector('#ui-tooltip').hidden, null, { timeout: 2000 });
        await page.close();
    });

    test('scrolling the list hides the tooltip of a row button, even when the pointer does not move', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await hoverTip(page, '.favorite-btn');
        await page.evaluate(() => (document.querySelector('.content').scrollTop += 120)); // a scroll with no pointer event
        await page.waitForFunction(() => document.querySelector('#ui-tooltip').hidden, null, { timeout: 2000 });
        await page.close();
    });

    test('the tooltip layer is above the engine\'s dialogs, so a control inside one still shows its tooltip', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '100060', background: 'rgba(0,0,0,0.4)' });
            overlay.id = 'engineOverlay';
            document.body.append(overlay);
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'probe';
            b.title = 'Inside the dialog';
            Object.assign(b.style, { position: 'fixed', left: '600px', top: '300px' });
            overlay.append(b);
        });
        assert.equal((await hoverTip(page, '.probe')).name, 'Inside the dialog');
        const z = await page.evaluate(() => ({ tip: Number(getComputedStyle(document.querySelector('#ui-tooltip')).zIndex), overlay: 100060, same: document.querySelector('#ui-tooltip').parentNode === document.body }));
        assert.ok(z.tip > z.overlay && z.same, JSON.stringify(z));
        await page.close();
    });

    // ---------------------------------------------------------------- the list toolbar

    test('list toolbar: play says what it does, shuffle shows its state and key, find and more have names', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        assert.deepEqual(await hoverTip(page, '.list-toolbar .icon-btn--solid'), { name: 'Play', state: '', description: 'Play all songs in this list', shortcut: '' });
        assert.deepEqual(await hoverTip(page, '.list-toolbar .icon-btn[aria-label="Shuffle"]'), { name: 'Shuffle', state: 'Off', description: '', shortcut: 'S' });
        assert.deepEqual(await hoverTip(page, '.list-toolbar .icon-btn[aria-label="Find in this list"]'), { name: 'Find in this list', state: '', description: 'Filter the songs in this list', shortcut: '' });
        assert.deepEqual(await hoverTip(page, '.list-toolbar .icon-btn[aria-label="More options for this list"]'), { name: 'More options for this list', state: '', description: '', shortcut: '' });
        await page.close();
    });

    test('list toolbar: after Play the tooltip says Pause with no description, and Shuffle follows the engine', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.evaluate((url) => SONGS_DATA.forEach((song) => (song.url = url)), songUrl);
        await page.click('.list-toolbar .icon-btn--solid');
        await page.waitForFunction(() => !audioElement.paused && audioElement.currentTime > 0.1, null, { timeout: 8000 });
        await page.waitForFunction(() => document.querySelector('.list-toolbar .icon-btn--solid').getAttribute('aria-label') === 'Pause', null, { timeout: 3000 });
        assert.deepEqual(await hoverTip(page, '.list-toolbar .icon-btn--solid'), { name: 'Pause', state: '', description: '', shortcut: '' });
        await hoverAway(page);
        await page.keyboard.press('s'); // the engine's own key for shuffle: it asks for a mode first
        await page.waitForSelector('.shuffle-mode-modal');
        const queueBefore = await page.evaluate(() => audioElement.paused);
        await page.focus('.shuffle-mode-modal .playlist-modal-create-btn');
        await page.keyboard.press('Space'); // Space on an engine button inside an engine dialog presses it
        await page.waitForFunction(() => document.querySelector('.list-toolbar .icon-btn[aria-label="Shuffle"]').getAttribute('aria-pressed') === 'true', null, { timeout: 3000 });
        assert.equal(await page.evaluate(() => audioElement.paused), queueBefore, 'Space did not also pause the song behind the dialog');
        assert.equal((await hoverTip(page, '.list-toolbar .icon-btn[aria-label="Shuffle"]')).state, 'On');
        assert.deepEqual(errors, []);
        await page.close();
    });

    // ---------------------------------------------------------------- Space

    test('Space on a focused button presses it; the engine no longer plays or pauses instead', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const before = await page.evaluate(() => ({ paused: audioElement.paused, src: audioElement.src, queue: playbackQueue.length }));
        await page.focus('.rail-btn[data-view="settings"]');
        await page.keyboard.press('Space');
        await page.waitForFunction(() => document.querySelector('.view-host').dataset.view === 'settings', null, { timeout: 3000 });
        // the accent swatches of the Appearance section (A-10) are radios: Space picks one and does not start playback
        const pink = '.segmented__item[aria-label="Pink"]';
        await page.waitForSelector(pink);
        await page.focus(pink);
        await page.keyboard.press('Space');
        await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-checked') === 'true', pink, { timeout: 3000 });
        const after = await page.evaluate(() => ({ paused: audioElement.paused, src: audioElement.src, queue: playbackQueue.length }));
        assert.deepEqual(after, before, 'nothing started playing');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Space and Enter on a control that is not a real button press it once; holding the key does not repeat', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.evaluate(() => {
            const d = document.createElement('div');
            d.id = 'fake';
            d.setAttribute('role', 'button');
            d.tabIndex = 0;
            d.textContent = 'fake';
            window.__clicks = 0;
            d.addEventListener('click', () => window.__clicks++);
            document.body.append(d);
            const b = document.createElement('button');
            b.id = 'real';
            b.type = 'button';
            b.textContent = 'real';
            window.__real = 0;
            b.addEventListener('click', () => window.__real++);
            document.body.append(b);
        });
        await page.focus('#fake');
        await page.keyboard.press('Space');
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => window.__clicks), 2, 'one click each');
        await page.focus('#real');
        await page.keyboard.press('Enter'); // the browser does this one
        await page.keyboard.press('Space');
        assert.equal(await page.evaluate(() => window.__real), 2, 'one click each, none doubled');
        await page.keyboard.down('Space');
        await page.keyboard.down('Space');
        await page.keyboard.down('Space');
        await page.keyboard.up('Space');
        assert.equal(await page.evaluate(() => window.__real), 3, 'a held key presses once');
        await page.close();
    });

    test('Space still types in a text field and still plays or pauses from the page; menu items choose once', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await page.fill('.panel-host .field__input', '');
        await page.focus('.panel-host .field__input');
        await page.keyboard.type('a b');
        assert.equal(await page.inputValue('.panel-host .field__input'), 'a b');
        // the engine's own Space: with nothing focused and an empty queue it starts the list
        await page.evaluate(() => document.activeElement.blur());
        await page.mouse.click(5, 5);
        const queued = await page.evaluate(() => playbackQueue.length);
        await page.keyboard.press('Space');
        await page.waitForFunction((n) => playbackQueue.length > n, queued, { timeout: 3000 });
        // a menu keeps its own keys: Space on the focused item toggles it once
        await page.click('.icon-btn[aria-label="Columns and row height"]');
        await page.waitForSelector('.menu [role="menuitemcheckbox"]');
        const first = await page.evaluate(() => document.querySelector('.menu [role="menuitemcheckbox"]').getAttribute('aria-checked'));
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        await page.click('.icon-btn[aria-label="Columns and row height"]');
        await page.waitForSelector('.menu [role="menuitemcheckbox"]');
        const second = await page.evaluate(() => document.querySelector('.menu [role="menuitemcheckbox"]').getAttribute('aria-checked'));
        assert.deepEqual([first, second], ['true', 'false']);
        await page.close();
    });
});
