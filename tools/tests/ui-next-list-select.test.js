// The song list while selecting (follow-up to PB-01): one square selection block, the more button clear of the highlight's edge, and
// no artist or album navigation while Shift, Ctrl or Cmd is held.
//
// Run:   node --test tools/tests/ui-next-list-select.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForStartupGone } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 60000 };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

describe('static', () => {
    test('the selection layer has no radius of its own, the more button has an inset, and the names stop looking like links', () => {
        const rows = read('src', 'ui-next', 'adapter', 'songlist-rows.css');
        const sel = rows.indexOf('#selection-styles-set > div {');
        assert.match(rows.slice(sel, rows.indexOf('}', sel)), /--radius-xs: 0px;/);
        assert.match(rows, /\.right-song-item \{[^}]*padding-right: var\(--sl-more-inset\)/);
        assert.match(rows, /html\[data-select='on'\] \.view-host\[data-songlist\] :is\(\.song-artist-name, \.song-album-name\):hover \{\s*color: inherit;\s*text-decoration: none;/);
        assert.match(read('src', 'ui-next', 'views', 'library', 'song-list.css'), /--sl-more-inset: var\(--space-2\)/);
    });
});

describe('selecting rows', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(40);
        fs.cpSync(path.join(ROOT, 'src', 'ui-next'), path.join(dir, 'ui-next'), { recursive: true });
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
    const row = (page, i) => page.locator('#song-list .song-item').nth(i);
    const selectedCount = (page) => page.evaluate(() => document.querySelectorAll('#song-list .song-item.selected').length);

    test('selected rows are one square block: no rounded corner on the first or the last row, or on a single row', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        await row(page, 2).locator('.song-title').click();
        await page.keyboard.down('Shift');
        await row(page, 4).locator('.song-title').click();
        await page.keyboard.up('Shift');
        await page.keyboard.down('Control');
        await row(page, 7).locator('.song-title').click();
        await page.keyboard.up('Control');
        await page.waitForFunction(() => document.querySelectorAll('#selection-styles-set > div').length === 4);
        const radii = await page.evaluate(() => [...document.querySelectorAll('#selection-styles-set > div')].map((d) => getComputedStyle(d).borderRadius));
        assert.deepEqual(radii, ['0px', '0px', '0px', '0px']);
        await page.close();
    });

    test('the more button is 12 to 16 px from the highlight edge, and the columns button sits above it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const box = await row(page, 3).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
        await page.waitForFunction(() => document.getElementById('hover-highlight-single')?.style.display !== 'none');
        const m = await page.evaluate(() => {
            const r = document.querySelectorAll('#song-list .song-item')[3];
            const hl = document.getElementById('hover-highlight-single').getBoundingClientRect();
            const glyph = r.querySelector('.more-info .material-symbols-outlined').getBoundingClientRect();
            const btn = document.querySelector('.songlist-head__tail > :last-child')?.getBoundingClientRect();
            const more = r.querySelector('.more-info').getBoundingClientRect();
            return { gap: Math.round(hl.right - glyph.right), headBtnRight: btn && Math.round(btn.right), moreRight: Math.round(more.right) };
        });
        assert.ok(m.gap >= 12 && m.gap <= 16, `the gap is ${m.gap}px`);
        assert.ok(Math.abs(m.headBtnRight - m.moreRight) <= 1, `the columns button right edge ${m.headBtnRight} against the more button ${m.moreRight}`);
        await page.close();
    });

    test('Shift or Ctrl on an artist or album name selects the row and does not open it; a plain click still opens it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const view = () => page.evaluate(() => currentView);
        const start = await view();
        await row(page, 1).locator('.song-title').click();
        assert.equal(await selectedCount(page), 1);
        await page.keyboard.down('Shift');
        await row(page, 3).locator('.song-album-name').click();
        await page.keyboard.up('Shift');
        assert.equal(await view(), start, 'Shift on an album name did not open the album');
        assert.equal(await selectedCount(page), 3, 'Shift selected the range');
        await page.keyboard.down('Control');
        await row(page, 6).locator('.song-artist-name').first().click();
        assert.equal(await view(), start, 'Ctrl on an artist name did not open the artist');
        assert.equal(await selectedCount(page), 4, 'Ctrl added the row');
        await row(page, 6).locator('.song-album-name').click();
        await page.keyboard.up('Control');
        assert.equal(await selectedCount(page), 3, 'Ctrl on the same row again took it out');
        assert.equal(await view(), start);
        await page.keyboard.down('Shift');
        await row(page, 8).locator('.song-album-name').dblclick();
        await page.keyboard.up('Shift');
        assert.equal(await page.evaluate(() => (typeof currentSong !== 'undefined' && currentSong ? currentSong.id : null)), null, 'a double click with Shift does not play');
        await row(page, 5).locator('.song-album-name').click();
        await page.waitForFunction((before) => currentView !== before, start);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('with Shift held the names stop looking like links, and look like links again when it is released', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open();
        const name = row(page, 4).locator('.song-album-name');
        const look = () => name.evaluate((e) => ({ line: getComputedStyle(e).textDecorationLine, cursor: getComputedStyle(e).cursor, flag: document.documentElement.dataset.select || null }));
        await name.hover();
        assert.deepEqual(await look(), { line: 'underline', cursor: 'pointer', flag: null });
        await page.keyboard.down('Shift');
        assert.deepEqual(await look(), { line: 'none', cursor: 'default', flag: 'on' });
        await page.keyboard.up('Shift');
        assert.deepEqual(await look(), { line: 'underline', cursor: 'pointer', flag: null });
        await page.close();
    });
});
