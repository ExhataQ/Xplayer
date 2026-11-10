// Task C4: the ready-made messages above the AI chat box sit in the left panel's chip strip (arrows, fade, wheel), and still drag.
// Run in the real page against the real engine; the main process is a small stand-in.
//
// Run:   node --test tools/tests/ui-next-ai-quickrow.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

const STUB = `<script>
window.__sent = [];
const state = { enabled: true, privacyAccepted: true, hasKey: true, last4: '1234', model: 'openrouter/free', mode: 'medium', translateLanguage: '', autoTranslate: false, encryptionAvailable: true };
const fake = {
  aiGetStatus: async () => ({ ...state }),
  aiListModels: async () => ({ ok: true, models: [] }),
  aiKeyInfo: async () => ({ ok: false }),
  aiPlan: async (p) => { window.__sent.push(p.request); return { ok: false, error: 'stub' }; }
};
window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : fake[k] || ((...a) => (/^on[A-Z]/.test(String(k)) ? () => {} : Promise.resolve(null)))) });
</script>
`;

describe('C4 static rules', () => {
    const read = (...parts) => fs.readFileSync(path.join(NEXT_SRC, ...parts), 'utf8');

    test('the chat uses the left panel\'s chip strip, and the drag helper does not repeat the wheel', () => {
        const chat = read('views', 'ai', 'ai-chat.js');
        assert.match(chat, /import \{ chipStrip \} from '\.\.\/library\/chip-strip\.js'/);
        assert.match(chat, /chipStrip\(prompts, \{ label: 'ready-made messages' \}\)/);
        assert.match(chat, /sidewaysScroll\(strip\.row, \{ wheel: false \}\)/);
        assert.doesNotMatch(read('views', 'ai', 'ai.css'), /\.ai-quickrow\[data-edge/, 'the old fade rules are gone: the strip draws the fade');
    });
});

describe('Ready-made messages with arrows', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
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

    async function openChat(width = 1400) {
        const page = await browser.newPage({ viewport: { width, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        await page.evaluate(async () => (await import(new URL('shell/ai-slots.js', location.href).href)).setAiStatus({ enabled: true, privacyAccepted: true, hasKey: true, last4: '1234', model: 'openrouter/free', mode: 'medium', translateLanguage: '', autoTranslate: false, encryptionAvailable: true }));
        await page.locator('button[aria-label="AI chat"]').click();
        await page.locator('.ai-chat .ai-quickstrip').waitFor({ timeout: 3000 });
        return { page, errors };
    }
    const strip = (page) => page.locator('.ai-chat .ai-quickstrip');
    const row = (page) => page.locator('.ai-chat .ai-quickstrip .chip-strip__row');
    const left = (page) => row(page).evaluate((n) => Math.round(n.scrollLeft));
    const state = (page) => strip(page).evaluate((n) => ({ overflow: n.dataset.overflow, start: n.dataset.fadeStart, end: n.dataset.fadeEnd }));
    const back = (page) => page.getByRole('button', { name: 'Scroll ready-made messages back' });
    const forward = (page) => page.getByRole('button', { name: 'Scroll ready-made messages forward' });
    // Makes the row longer than its box on any screen, so every test starts with something to scroll.
    const crowd = (page) =>
        page.evaluate(() => {
            const rowEl = document.querySelector('.ai-quickrow');
            for (let i = 0; i < 6; i++) rowEl.append(rowEl.firstElementChild.cloneNode(true));
        });

    test('arrows show only on the side that has more; they page the row; the buttons are not in the way', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openChat();
        await crowd(page);
        await page.waitForFunction(() => document.querySelector('.ai-quickstrip').dataset.overflow === 'true');
        assert.deepEqual(await state(page), { overflow: 'true', start: 'false', end: 'true' });
        assert.equal(await back(page).isVisible(), false, 'nothing before the first message');
        assert.equal(await forward(page).isVisible(), true);

        await forward(page).click();
        await page.waitForFunction(() => document.querySelector('.ai-quickstrip .chip-strip__row').scrollLeft > 20);
        assert.equal(await state(page).then((s) => s.start), 'true');
        assert.equal(await back(page).isVisible(), true);

        for (let i = 0; i < 12 && (await state(page)).end === 'true'; i++) {
            await forward(page).click();
            await page.waitForTimeout(250);
        }
        assert.equal((await state(page)).end, 'false', 'the last message is reached');
        assert.equal(await forward(page).isVisible(), false);
        for (let i = 0; i < 12 && (await left(page)) > 1; i++) {
            await back(page).click();
            await page.waitForTimeout(250);
        }
        assert.equal(await left(page), 0, 'the first message is reached again');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('when every message fits there are no arrows', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openChat();
        await page.evaluate(() => {
            const r = document.querySelector('.ai-quickrow');
            while (r.children.length > 1) r.lastElementChild.remove();
        });
        await page.waitForFunction(() => document.querySelector('.ai-quickstrip').dataset.overflow === 'false');
        assert.equal(await back(page).isVisible(), false);
        assert.equal(await forward(page).isVisible(), false);
        await page.close();
    });

    test('one turn of the wheel moves the row once, not twice; dragging still moves it and is not a click', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openChat();
        await crowd(page);
        await page.waitForFunction(() => document.querySelector('.ai-quickstrip').dataset.overflow === 'true');
        const box = await row(page).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 60);
        await page.waitForTimeout(150);
        assert.equal(await left(page), 60, 'the wheel moved the row by exactly what it turned');

        const before = await left(page);
        const sentBefore = await page.evaluate(() => window.__sent.length);
        const y = box.y + box.height / 2;
        await page.mouse.move(box.x + 200, y);
        await page.mouse.down();
        await page.mouse.move(box.x + 120, y, { steps: 6 });
        await page.mouse.up();
        assert.ok((await left(page)) > before + 40, 'the drag moved the row');
        assert.equal(await page.evaluate(() => window.__sent.length), sentBefore, 'a drag does not press the button under it');
        await page.close();
    });

    test('the arrows are named, are real buttons, and can be reached with the keyboard', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await openChat();
        await crowd(page);
        await page.waitForFunction(() => document.querySelector('.ai-quickstrip').dataset.overflow === 'true');
        await forward(page).focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('.ai-quickstrip .chip-strip__row').scrollLeft > 20);
        assert.equal(await forward(page).evaluate((n) => n.tagName), 'BUTTON');
        await page.close();
    });
});
