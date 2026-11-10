// Task C5: the AI chat keeps a usable size. The conversation never gets shorter than a minimum; when the window is too short for everything
// (the "Set up AI first" card above the box at the smallest window), the chat scrolls inside itself instead of squeezing the conversation to a
// sliver and pushing the box out of sight. Real page, real engine; the main process is a small stand-in.
//
// Run:   node --test tools/tests/ui-next-ai-minimum-size.test.js
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
window.__st = Object.assign({ enabled: true, privacyAccepted: true, hasKey: true, last4: '1234', model: 'openrouter/free', mode: 'medium', translateLanguage: '', autoTranslate: false, encryptionAvailable: true }, window.__init || {});
const fake = { aiGetStatus: async () => ({ ...window.__st }), aiListModels: async () => ({ ok: true, models: [] }), aiKeyInfo: async () => ({ ok: false }) };
window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : fake[k] || ((...a) => (/^on[A-Z]/.test(String(k)) ? () => {} : Promise.resolve(null)))) });
</script>
`;
const READY = {};
const NO_KEY = { hasKey: false, last4: '' };
const OFF = { enabled: false, privacyAccepted: false, hasKey: false, last4: '' };

describe('C5 static rules', () => {
    test('the chat scrolls inside itself and the conversation has a minimum height', () => {
        const css = fs.readFileSync(path.join(NEXT_SRC, 'views', 'ai', 'ai.css'), 'utf8');
        assert.match(css, /\.ai-chat \{ overflow-y: auto;/);
        assert.match(css, /\.ai-chat > \* \{ flex-shrink: 0; \}/);
        assert.match(css, /\.ai-chat > \.ai-chat__thread \{ flex: 1 0 160px; \}/);
    });
});

describe('AI chat at small sizes', { concurrency: false }, () => {
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

    // mode: 'view' (the big view), 'popup' (over the current view) or 'window' (the chat's own window, its smaller minimum size)
    async function open(mode, init, size) {
        const page = await browser.newPage({ viewport: size });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.addInitScript((i) => (window.__init = i), init);
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/') + (mode === 'window' ? '?tool=ai' : ''));
        await waitForAppSettled(page, 4000).catch(() => {});
        await page.waitForTimeout(500);
        if (mode !== 'window') {
            await page.evaluate(async (m) => {
                const slots = await import(new URL('shell/ai-slots.js', location.href).href);
                return m === 'view' ? slots.openAiChatView() : slots.openAiChat();
            }, mode);
        }
        await page.locator('.ai-chat').waitFor({ timeout: 4000 });
        await page.waitForTimeout(400);
        return { page, errors };
    }

    const measure = (page) =>
        page.evaluate(() => {
            const rect = (n) => (n ? (({ top, bottom, height }) => ({ top, bottom, height }))(n.getBoundingClientRect()) : null);
            const chat = document.querySelector('.ai-chat');
            return {
                chat: rect(chat),
                scrollable: chat.scrollHeight > chat.clientHeight + 1,
                thread: rect(document.querySelector('.ai-chat__thread')),
                composer: rect(document.querySelector('.ai-composer')),
                setup: rect(document.querySelector('.ai-chat__setup:not([hidden])')),
                innerHeight,
                pageScroll: document.documentElement.scrollHeight > innerHeight + 1
            };
        });

    for (const [mode, size] of [['view', { width: 800, height: 600 }], ['popup', { width: 800, height: 600 }], ['window', { width: 380, height: 480 }]]) {
        test(`${mode} at ${size.width}x${size.height} with AI ready: the same as before, nothing scrolls, the conversation is not squeezed`, TEST_OPTIONS, async (t) => {
            if (!guard(t)) return;
            const { page, errors } = await open(mode, READY, size);
            const m = await measure(page);
            assert.equal(m.scrollable, false, 'room for everything: no inner scroll');
            assert.ok(m.thread.height >= 160, `conversation ${m.thread.height}px`);
            assert.ok(m.composer.bottom <= m.chat.bottom + 1, 'the box to type in is inside the chat');
            assert.deepEqual(errors, []);
            await page.close();
        });

        for (const [name, init] of [['no key', NO_KEY], ['turned off', OFF]]) {
            test(`${mode} at ${size.width}x${size.height} with AI ${name}: "Set up AI first" stays usable and the chat scrolls inside itself`, TEST_OPTIONS, async (t) => {
                if (!guard(t)) return;
                const { page, errors } = await open(mode, init, size);
                const m = await measure(page);
                assert.ok(m.setup, 'the Set up AI first card is shown');
                assert.ok(m.thread.height >= 160, `the conversation keeps its minimum (${m.thread.height}px), it is not squeezed to a sliver`);
                assert.equal(m.scrollable, true, 'the chat has more than fits, and scrolls inside itself');
                assert.equal(m.pageScroll, false, 'the page itself does not scroll');
                const open_ = page.locator('.ai-chat__setup').getByRole('button', { name: 'Open Settings' });
                assert.equal(await open_.isVisible(), true);
                const box = await open_.boundingBox();
                assert.ok(box.y >= m.chat.top && box.y + box.height <= m.chat.bottom, 'the button to continue the set-up is in view without scrolling');
                // Everything below it can be reached by scrolling the chat: the box ends inside the chat.
                await page.evaluate(() => {
                    const chat = document.querySelector('.ai-chat');
                    chat.scrollTop = chat.scrollHeight;
                });
                const after = await measure(page);
                assert.ok(after.composer.bottom <= after.chat.bottom + 1 && after.composer.bottom <= after.innerHeight, 'scrolled to the end, the box to type in is fully in view');
                assert.deepEqual(errors, []);
                await page.close();
            });
        }
    }

    test('with plenty of room and AI not set up, nothing scrolls', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page } = await open('window', NO_KEY, { width: 700, height: 1000 });
        assert.equal((await measure(page)).scrollable, false);
        await page.close();
    });
});
