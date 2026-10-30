// Task PC-05 (request for A): the old screen's `* { user-select: none }` with the field exceptions (src/css/base.css), in ui-next/base.css.
//
// Run:   node --test tools/tests/ui-next-selection.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

describe('base.css selection rules (static)', () => {
    const css = fs.readFileSync(path.join(NEXT_SRC, 'base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    test('everything is unselectable, with fields, editable text and the AI messages as exceptions', () => {
        assert.match(css, /\*\s*\{[^}]*user-select:\s*none/);
        const exception = css.match(/input,[^{]*\{[^}]*user-select:\s*text/)?.[0] || '';
        for (const part of ['input', 'textarea', 'contenteditable', '.ai-msg__bubble']) assert.ok(exception.includes(part), part);
    });
});

describe('selection in the real shell', { concurrency: false }, () => {
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

    test('bars, rows and the rail cannot be selected; a field and an AI message can', TEST_OPTIONS, async (t) => {
        if (skip) return t.skip(skip);
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        const got = await page.evaluate(() => {
            const sel = (el) => getComputedStyle(el).userSelect;
            const input = document.querySelector('input');
            const bubble = Object.assign(document.createElement('div'), { className: 'ai-msg__bubble', innerHTML: '<p>answer</p>' });
            const editable = Object.assign(document.createElement('div'), { contentEditable: 'true', innerHTML: '<span>x</span>' });
            document.body.append(bubble, editable);
            return {
                row: sel(document.querySelector('.song-item')),
                rail: sel(document.querySelector('.rail')),
                titlebar: sel(document.querySelector('.titlebar')),
                input: input ? sel(input) : 'text',
                bubble: sel(bubble.querySelector('p')),
                editable: sel(editable.querySelector('span'))
            };
        });
        assert.deepEqual(got, { row: 'none', rail: 'none', titlebar: 'none', input: 'text', bubble: 'text', editable: 'text' });
        await page.close();
    });
});
