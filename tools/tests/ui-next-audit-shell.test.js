// Task PA-15: findings of the shell and chrome audit that were fixed in the new shell (the report lists the rest).
//
// Run:   node --test tools/tests/ui-next-audit-shell.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('the drop overlay (engine-view.css)', () => {
    const css = fs.readFileSync(path.join(NEXT_SRC, 'adapter', 'engine-view.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = css.match(/\.content-wrapper\.drag-over::after \{[^}]*\}/)?.[0] || '';

    test('uses tokens only', () => {
        assert.ok(rule, 'rule exists');
        assert.doesNotMatch(rule, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|--c-[a-z]/);
        const tokens = fs.readFileSync(path.join(NEXT_SRC, 'tokens.css'), 'utf8');
        for (const name of rule.matchAll(/var\((--[a-z0-9-]+)(?:,[^)]*)?\)/g)) assert.ok(tokens.includes(name[1] + ':'), name[1]);
    });
});

describe('the drop overlay in the real shell', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('dragging files over the list shows the overlay over the whole list, and leaving removes it', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        const fire = (type) => page.evaluate((ty) => {
            const target = document.querySelector('.view-host .content-wrapper');
            const dt = new DataTransfer();
            dt.items.add(new File(['x'], 'a.mp3', { type: 'audio/mpeg' }));
            target.dispatchEvent(new DragEvent(ty, { bubbles: true, cancelable: true, dataTransfer: dt }));
        }, type);
        await fire('dragenter');
        const shown = await page.evaluate(() => {
            const wrap = document.querySelector('.view-host .content-wrapper');
            const cs = getComputedStyle(wrap, '::after');
            const box = wrap.getBoundingClientRect();
            return { text: cs.content, border: cs.borderTopStyle, width: parseFloat(cs.width), wrap: box.width, pe: cs.pointerEvents };
        });
        assert.equal(shown.text, '"Drop files to import"');
        assert.equal(shown.border, 'dashed');
        assert.ok(shown.width > shown.wrap - 40, JSON.stringify(shown));
        assert.equal(shown.pe, 'none');
        await fire('dragleave');
        assert.equal(await page.evaluate(() => document.querySelector('.view-host .content-wrapper').classList.contains('drag-over')), false);
        await page.close();
    });
});
