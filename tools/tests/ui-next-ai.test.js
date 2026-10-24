// Tasks PE-09, PE-10 and the page side of PE-03/PE-04: the AI settings section, the first-use privacy screen, the chat, the plan
// preview, Apply and Undo, running in the real page against the real engine (playlists, folders, notifications). Only the main
// process is a stand-in: window.electronAPI.ai* answers from a small fake that records what the page sends.
//
// Run:   node --test tools/tests/ui-next-ai.test.js
// Needs: playwright and a browser (skips itself when missing).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');

// The fake main process. Everything the page sends is kept in window.__ai.calls.
const STUB = `<script>
window.__ai = { calls: [], state: { enabled: false, privacyAccepted: false, hasKey: false, last4: '', model: 'openrouter/free', translateLanguage: '', autoTranslate: false, encryptionAvailable: true, songFields: ['title', 'artist', 'album', 'genre', 'year'] }, journal: [], planResult: null };
const A = window.__ai;
const plan = (name) => ({ ok: true, model: 'a/b:free', sentRows: 3, plan: { summary: 'Make ' + name, actions: [{ type: 'create_playlist', args: { name } }] },
  preview: { summary: 'Make ' + name, changesData: true, counts: {}, lines: [{ index: 0, type: 'create_playlist', title: 'Create playlist', text: 'Create the playlist "' + name + '"', changesData: true }] } });
const fake = {
  aiGetStatus: async () => ({ ...A.state }),
  aiSetSettings: async (p) => { for (const k of ['enabled', 'privacyAccepted', 'model', 'translateLanguage', 'autoTranslate']) if (k in p && (k !== 'model' || /^[A-Za-z0-9._\\-/:]{1,100}$/.test(p.model)) && (k !== 'translateLanguage' || /^[A-Za-z ]{0,40}$/.test(p.translateLanguage))) A.state[k] = p[k]; A.calls.push(['settings', p]); return { ...A.state }; },
  aiSetKey: async (k) => { A.calls.push(['key', k.length]); if (k.length < 16) return { ok: false, error: 'bad-key' }; A.state.hasKey = true; A.state.last4 = k.slice(-4); return { ok: true }; },
  aiClearKey: async () => { A.state.hasKey = false; A.state.last4 = ''; return { ok: true }; },
  aiListModels: async () => ({ ok: true, models: [{ id: 'a/b:free', name: 'AB', structured: true }, { id: 'c/d:free', name: 'CD', structured: false }] }),
  aiKeyInfo: async () => ({ ok: true, info: { usage: 0.0123, limit: null, limit_remaining: null, is_free_tier: true, free_model_daily_requests: { used: 12, limit: 50, remaining: 38 } } }),
  aiDescribePrivacy: async () => ({ fields: ['genre'], tasks: [{ task: 'Organizing', sends: 'Titles and tags.' }], neverSent: ['File paths'], notes: ['Free models may keep data.'], example: '1. Example | Artist | Album | 215s | genre=Pop' }),
  aiPlan: async (p) => { A.calls.push(['plan', { request: p.request, count: p.songs.length, keys: Object.keys(p.songs[0] || {}), useWeb: p.useWeb, includeLyrics: p.includeLyrics, history: p.history, lyrics: p.songs[0] && p.songs[0].lyrics }]); if (A.delay) await new Promise((r) => setTimeout(r, A.delay)); return A.planResult || plan('Calm'); },
  aiTranslateLyrics: async (p) => { A.calls.push(['translate', { target: p.targetLanguage }]); return { ok: true, translation: A.translation || 'x', model: 'm', targetLanguage: p.targetLanguage, synced: Boolean(A.translation) }; },
  aiCancel: async () => ({ cancelled: false }),
  aiJournalList: async () => A.journal.slice().reverse().map((e) => ({ id: e.id, at: e.at, kind: e.kind, summary: e.summary, status: e.status, changeCount: e.changes.length })),
  aiJournalGet: async (id) => A.journal.find((e) => e.id === id) || null,
  aiJournalRecord: async (e) => { const entry = { id: 'j' + (A.journal.length + 1), at: Date.now(), status: 'done', ...e }; A.journal.push(entry); return { ok: true, entry }; },
  aiJournalMarkUndone: async (id) => { const e = A.journal.find((x) => x.id === id); if (e) e.status = 'undone'; return { ok: !!e }; }
};
window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : fake[k] || ((...a) => (/^on[A-Z]/.test(String(k)) ? () => {} : Promise.resolve(null)))) });
</script>
`;

describe('AI screens', { concurrency: false }, () => {
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

    async function open(state = {}) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.addInitScript((s) => { window.__initial = s; }, state);
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 4000);
        await page.waitForSelector('.view-host .song-item:not(.lazy-skeleton)');
        if (Object.keys(state).length) {
            await page.evaluate(async (s) => {
                Object.assign(window.__ai.state, s);
                (await import(new URL('shell/ai-slots.js', location.href).href)).setAiStatus({ ...window.__ai.state });
            }, state);
        }
        return { page, errors };
    }

    const ON = { enabled: true, privacyAccepted: true, hasKey: true, last4: '1234' };
    const view = (page) => page.evaluate(() => document.querySelector('.view-host').dataset.view);
    const chatButton = (page) => page.locator('button[aria-label="AI chat"]');
    const playlists = (page) => page.evaluate(() => getPlaylists().map((p) => p.name));
    const calls = (page, kind) => page.evaluate((k) => window.__ai.calls.filter((c) => c[0] === k).map((c) => c[1]), kind);

    test('Settings: turning AI on shows what is sent first, and only "I understand" turns it on', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-card[data-page="ai"]').click(); // Settings opens on the hub; the AI card opens the AI page
        const section = page.locator('.ai-settings');
        await section.waitFor({ timeout: 4000 });
        const toggle = section.getByRole('button', { name: 'Turn on AI' });
        await toggle.click();
        const dialog = page.locator('dialog.dialog');
        await dialog.waitFor({ timeout: 3000 });
        assert.match(await dialog.innerText(), /Never sent/);
        assert.match(await dialog.innerText(), /genre=Pop/);
        await dialog.getByRole('button', { name: 'Not now' }).click();
        assert.equal((await page.evaluate(() => window.__ai.state.enabled)), false);
        await toggle.click();
        await dialog.getByRole('button', { name: 'I understand, turn it on' }).click();
        await section.getByRole('button', { name: 'Turn off AI' }).waitFor({ timeout: 3000 });
        assert.deepEqual(await page.evaluate(() => [window.__ai.state.enabled, window.__ai.state.privacyAccepted]), [true, true]);
        await chatButton(page).waitFor({ timeout: 3000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Settings: a bad key is refused with a clear message; a good one is saved, cleared from the box, and only its end is shown', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-card[data-page="ai"]').click(); // Settings opens on the hub; the AI card opens the AI page
        const section = page.locator('.ai-settings');
        await section.waitFor({ timeout: 4000 });
        const input = section.getByLabel('OpenRouter key');
        assert.equal(await input.getAttribute('type'), 'password');
        await input.fill('short');
        await section.getByRole('button', { name: 'Save key' }).click();
        await section.getByText('does not look like an OpenRouter key').waitFor({ timeout: 3000 });
        await input.fill('sk-or-v1-0123456789abcdef9999');
        await section.getByRole('button', { name: 'Save key' }).click();
        await section.getByText('ends in 9999').waitFor({ timeout: 3000 });
        assert.equal(await input.inputValue(), '');
        assert.equal(await section.getByRole('button', { name: 'Remove key' }).isDisabled(), false);
        assert.ok(!(await section.innerText()).includes('0123456789abcdef'));
        await section.getByRole('button', { name: 'Remove key' }).click();
        await section.getByText('Paste a new one').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
        assert.equal(await page.evaluate(() => window.__ai.state.hasKey), false);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Settings: the model can be loaded, picked or typed, and an invalid name is refused', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-card[data-page="ai"]').click(); // Settings opens on the hub; the AI card opens the AI page
        const section = page.locator('.ai-settings');
        await section.waitFor({ timeout: 4000 });
        await section.getByRole('button', { name: 'Load model list' }).click();
        await section.getByText('2 free models loaded').waitFor({ timeout: 3000 });
        assert.equal(await section.locator('.ai-model__select option').count(), 3, 'Automatic plus the two loaded models');
        const input = section.getByLabel('Other model name', { exact: true });
        await input.fill('a/b:free');
        await section.getByRole('button', { name: 'Use this model' }).click();
        await section.getByText('Using a/b:free').waitFor({ timeout: 3000 });
        await input.fill('bad name!');
        await section.getByRole('button', { name: 'Use this model' }).click();
        await section.getByText('not a valid model name').waitFor({ timeout: 3000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Chat with AI off or no key explains what is missing and leads to Settings', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ enabled: true, privacyAccepted: true, hasKey: false });
        await chatButton(page).click();
        const chat = page.locator('.ai-chat');
        await chat.waitFor({ timeout: 3000 });
        await chat.getByText('Set up AI first').waitFor({ timeout: 3000 });
        assert.match(await chat.innerText(), /no OpenRouter key/);
        assert.equal(await chat.getByLabel('Message', { exact: true }).isDisabled(), true);
        await chat.getByRole('button', { name: 'Open Settings' }).click();
        await page.locator('.ai-settings').waitFor({ timeout: 4000 });
        assert.equal(await view(page), 'settings');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Chat: ask, read the preview, Apply creates the playlist in the real engine, Undo removes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await chatButton(page).click();
        const chat = page.locator('.ai-chat');
        await chat.getByLabel('Message', { exact: true }).waitFor({ timeout: 3000 });
        await chat.getByLabel('Message', { exact: true }).fill('make a calm playlist');
        await chat.getByRole('button', { name: 'Send' }).click();
        await chat.getByText('Create the playlist "Calm"').waitFor({ timeout: 4000 });
        assert.match(await chat.innerText(), /This changes your library/);
        assert.deepEqual(await playlists(page), [], 'nothing runs before Apply');
        const sent = (await calls(page, 'plan'))[0];
        assert.equal(sent.request, 'make a calm playlist');
        assert.ok(sent.count > 0);
        for (const key of sent.keys) assert.ok(['id', 'duration', 'favorite', 'title', 'artist', 'album', 'genre', 'year', 'playing'].includes(key), `unexpected field sent: ${key}`);
        assert.ok(!sent.keys.includes('url') && !sent.keys.includes('cover') && !sent.keys.includes('lyrics'));

        await chat.getByRole('button', { name: 'Apply' }).click();
        await chat.getByText('Done. Use Undo').waitFor({ timeout: 4000 });
        assert.deepEqual(await playlists(page), ['Calm']);
        assert.equal(await page.evaluate(() => window.__ai.journal.length), 1);

        const undo = page.locator('#notification-center button, .toast button', { hasText: 'Undo' }).first();
        await page.getByRole('button', { name: /notification/i }).first().click().catch(() => {});
        await undo.waitFor({ timeout: 4000 });
        await undo.click();
        await page.waitForFunction(() => getPlaylists().length === 0, null, { timeout: 4000 });
        assert.equal(await page.evaluate(() => window.__ai.journal[0].status), 'undone');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Chat: Discard changes nothing; the selected-songs scope refuses an empty selection; errors say what to do', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await chatButton(page).click();
        const chat = page.locator('.ai-chat');
        await chat.getByLabel('Message', { exact: true }).waitFor({ timeout: 3000 });
        await chat.getByLabel('Message', { exact: true }).fill('one');
        await chat.getByRole('button', { name: 'Send' }).click();
        await chat.getByRole('button', { name: 'Discard' }).click();
        await chat.getByText('Discarded. Nothing was changed.').waitFor({ timeout: 3000 });
        assert.deepEqual(await playlists(page), []);

        await chat.getByRole('radio', { name: 'Selected' }).click();
        await chat.getByLabel('Message', { exact: true }).fill('two');
        await chat.getByRole('button', { name: 'Send' }).click();
        await chat.getByText('Select some songs in the list first').waitFor({ timeout: 3000 });
        assert.equal((await calls(page, 'plan')).length, 1, 'no request went out for an empty selection');

        await chat.getByRole('radio', { name: 'All songs' }).click();
        await page.evaluate(() => { window.__ai.planResult = { ok: false, error: 'rate-limit' }; });
        await chat.getByLabel('Message', { exact: true }).fill('three');
        await chat.getByRole('button', { name: 'Send' }).click();
        await chat.getByText('free daily limit is used up').waitFor({ timeout: 3000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Chat: the "look up tags online" switch is sent, and Playback > AI shuffle opens the chat with the request started', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await page.evaluate(async () => (await import(new URL('shell/ai-slots.js', location.href).href)).getAiCommands().shuffle());
        const chat = page.locator('.ai-chat');
        await chat.waitFor({ timeout: 3000 });
        const composer = chat.getByLabel('Message', { exact: true });
        assert.match(await composer.inputValue(), /^Build a play order/);
        await chat.getByRole('button', { name: 'Look up tags online' }).click();
        await composer.fill('Build a play order from my library for: running');
        await chat.getByRole('button', { name: 'Send' }).click();
        await chat.getByText('Create the playlist').waitFor({ timeout: 4000 });
        assert.equal((await calls(page, 'plan'))[0].useWeb, true);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Chat: Translate lyrics says so when nothing with lyrics is playing', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await chatButton(page).click();
        const chat = page.locator('.ai-chat');
        await chat.getByRole('button', { name: 'Translate lyrics' }).click();
        await chat.getByText(/Play a song with lyrics first|no lyrics to translate/).waitFor({ timeout: 3000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Pop-up: the chat opens over the current view, expands to the big view and shrinks back with the conversation kept, Escape closes it', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await chatButton(page).click();
        const popup = page.locator('.ai-popup');
        await popup.waitFor({ timeout: 3000 });
        assert.equal(await view(page), 'library', 'the pop-up does not replace the view');
        assert.equal(await chatButton(page).getAttribute('aria-pressed'), 'true');
        await popup.getByLabel('Message', { exact: true }).fill('calm');
        await popup.getByRole('button', { name: 'Send' }).click();
        await popup.getByText('Create the playlist').waitFor({ timeout: 4000 });
        await popup.getByRole('button', { name: 'Expand to the big view' }).click();
        await page.locator('.view-host .ai-chat--view').waitFor({ timeout: 3000 });
        assert.equal(await page.locator('.ai-popup').count(), 0);
        assert.equal(await view(page), 'ai-chat');
        await page.locator('.ai-chat--view').getByText('Create the playlist').waitFor({ timeout: 3000 });
        await page.getByRole('button', { name: 'Make smaller (pop-up)' }).click();
        await page.locator('.ai-popup').getByText('Create the playlist').waitFor({ timeout: 3000 });
        assert.equal(await view(page), 'library');
        await page.locator('.ai-popup textarea').focus();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.ai-popup').count(), 0);
        assert.equal(await chatButton(page).getAttribute('aria-pressed'), 'false');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Chat box: the model is chosen next to the message box, and the limits line shows OpenRouter\'s own numbers with a countdown', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await chatButton(page).click();
        const popup = page.locator('.ai-popup');
        const select = popup.locator('.ai-model__select');
        await select.locator('option[value="a/b:free"]').waitFor({ state: 'attached', timeout: 4000 });
        await select.selectOption('a/b:free');
        await popup.getByText('Saved.').waitFor({ timeout: 3000 });
        assert.equal(await page.evaluate(() => window.__ai.state.model), 'a/b:free');
        await popup.locator('.ai-limits').getByText(/Free requests today: 12 of 50 used, 38 left · resets in \d+h \d\dm/).waitFor({ timeout: 3000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Shuffle: the songs are listed in the chat, a notification offers Save as playlist, and saving makes a playlist with them', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await page.evaluate(() => {
            const ids = SONGS_DATA.slice(0, 3).map((s) => s.id);
            window.__ai.planResult = { ok: true, model: 'a/b:free', sentRows: 3, plan: { summary: 'Calm evening', actions: [{ type: 'set_play_order', args: { songs: ids } }] },
                preview: { summary: 'Calm evening', changesData: false, counts: {}, lines: [{ index: 0, type: 'set_play_order', title: 'Build a play order', text: 'Play 3 songs in a new order', changesData: false }] } };
        });
        await chatButton(page).click();
        const popup = page.locator('.ai-popup');
        await popup.getByLabel('Message', { exact: true }).fill('calm evening');
        await popup.getByRole('button', { name: 'Send' }).click();
        await popup.locator('.ai-songs__item').first().waitFor({ timeout: 4000 });
        assert.equal(await popup.locator('.ai-songs__item').count(), 3);
        await popup.getByRole('button', { name: 'Apply' }).click();
        await page.getByText(/AI shuffle|Calm evening: playing 3 songs/).first().waitFor({ timeout: 4000 });
        await page.getByText('Calm evening: playing 3 songs').first().waitFor({ timeout: 4000 });
        assert.equal(await page.locator('[aria-controls="queue-panel"]').getAttribute('aria-expanded'), 'true', 'applying a shuffle opens the queue');
        await popup.getByRole('button', { name: 'Save as playlist' }).click();
        const dialog = page.locator('dialog.dialog');
        await dialog.getByLabel('Playlist name').fill('Evening mix');
        await dialog.getByRole('button', { name: 'Save' }).click();
        await page.waitForFunction(() => getPlaylists().some((p) => p.name === 'Evening mix'), null, { timeout: 4000 });
        assert.equal(await page.evaluate(() => getPlaylists().find((p) => p.name === 'Evening mix').songs.length), 3);
        assert.deepEqual(errors, []);
        await page.close();
    });

    const talk = (reply) => ({ ok: true, model: 'm', sentRows: 3, plan: { summary: '', reply, actions: [] }, preview: { summary: '', lines: [], changesData: false, counts: {} } });

    test('Talk: a question is answered in words (no plan card) and the next message carries the earlier ones', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await page.evaluate((r) => { window.__ai.planResult = r; }, talk('Hello! I can build playlists and shuffle.'));
        await chatButton(page).click();
        const popup = page.locator('.ai-popup');
        await popup.getByLabel('Message', { exact: true }).fill('hi');
        await popup.getByRole('button', { name: 'Send' }).click();
        await popup.getByText('Hello! I can build playlists and shuffle.').waitFor({ timeout: 4000 });
        assert.equal(await popup.locator('.ai-card').count(), 0);
        await popup.getByLabel('Message', { exact: true }).fill('and what else?');
        await popup.getByRole('button', { name: 'Send' }).click();
        await page.waitForFunction(() => window.__ai.calls.filter((c) => c[0] === 'plan').length === 2);
        const second = (await calls(page, 'plan'))[1];
        assert.deepEqual(second.history, [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'Hello! I can build playlists and shuffle.' }]);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Background: a request keeps running when the window is closed, says so when it finishes, and shows Thinking when reopened', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await page.evaluate(() => { window.__ai.delay = 1200; });
        await chatButton(page).click();
        let popup = page.locator('.ai-popup');
        await popup.getByLabel('Message', { exact: true }).fill('first');
        await popup.getByRole('button', { name: 'Send' }).click();
        await popup.getByText('Thinking…').waitFor({ timeout: 3000 });
        await popup.getByRole('button', { name: 'Close the chat' }).click();
        await page.getByText('The AI answered').first().waitFor({ timeout: 5000 });
        await chatButton(page).click();
        popup = page.locator('.ai-popup');
        await popup.getByText('Create the playlist').waitFor({ timeout: 3000 });
        await popup.getByLabel('Message', { exact: true }).fill('second');
        await popup.getByRole('button', { name: 'Send' }).click();
        await popup.getByRole('button', { name: 'Close the chat' }).click();
        await chatButton(page).click();
        await page.locator('.ai-popup').getByText('Thinking…').waitFor({ timeout: 3000 });
        await page.locator('.ai-popup .ai-card').nth(1).waitFor({ timeout: 5000 });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Pop-up: the window can be dragged by its title bar and stays on the page', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await chatButton(page).click();
        const popup = page.locator('.ai-popup');
        await popup.waitFor({ timeout: 3000 });
        const before = await popup.boundingBox();
        await page.mouse.move(before.x + 40, before.y + 20);
        await page.mouse.down();
        await page.mouse.move(before.x - 260, before.y + 160, { steps: 5 });
        await page.mouse.up();
        const after = await popup.boundingBox();
        assert.ok(Math.abs(after.x - (before.x - 300)) < 3 && Math.abs(after.y - (before.y + 140)) < 3, `moved from ${before.x},${before.y} to ${after.x},${after.y}`);
        await page.mouse.move(after.x + 40, after.y + 20);
        await page.mouse.down();
        await page.mouse.move(-500, -500, { steps: 3 });
        await page.mouse.up();
        const edge = await popup.boundingBox();
        assert.ok(edge.x >= 0 && edge.y >= 0);
        assert.deepEqual(errors, []);
        await page.close();
    });

    const playWithLyrics = (page) => page.evaluate(() => {
        const s = SONGS_DATA[0];
        setSyncedLyricsForSong(s.id, '[00:01.00]Hello\n[00:02.00]World');
        setPlaybackQueue([{ song: s, listId: 'all-songs', ghostSlot: 0 }]);
        setCurrentQueueIndex(0);
    });

    test('Lyrics: Translate saves a lyrics version, Original / Translated switch between them, nothing shown until AI is set up', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ ...ON, translateLanguage: 'French' });
        await page.evaluate(() => { window.__ai.translation = '[00:01.00]Bonjour\n[00:02.00]Monde'; });
        await playWithLyrics(page);
        await page.locator('.rail-btn[data-view="lyrics"]').click();
        const tools = page.locator('.ai-lyrics-tools');
        await tools.getByRole('button', { name: 'Translate' }).waitFor({ timeout: 4000 });
        assert.equal(await tools.getByRole('radio', { name: 'Translated' }).isVisible(), false, 'no translation yet');
        await tools.getByRole('button', { name: 'Translate' }).click();
        await tools.getByRole('radio', { name: 'Translated' }).waitFor({ timeout: 4000 });
        const active = () => page.evaluate(() => getActiveSyncedLyricsForSong(SONGS_DATA[0]).text);
        assert.match(await active(), /Bonjour/);
        assert.equal((await calls(page, 'translate'))[0].target, 'French');
        await tools.getByRole('radio', { name: 'Original' }).click();
        await page.waitForFunction(() => /Hello/.test(getActiveSyncedLyricsForSong(SONGS_DATA[0]).text));
        await tools.getByRole('radio', { name: 'Translated' }).click();
        await page.waitForFunction(() => /Bonjour/.test(getActiveSyncedLyricsForSong(SONGS_DATA[0]).text));
        await page.evaluate(async () => (await import(new URL('shell/ai-slots.js', location.href).href)).setAiStatus({ enabled: false }));
        await page.waitForFunction(() => document.querySelector('.ai-lyrics-tools').hidden);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Auto-translate: when it is on, a song that starts is translated into the default language and shown; a second start does not ask again', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open({ ...ON, translateLanguage: 'French', autoTranslate: true });
        await page.evaluate(() => { window.__ai.translation = '[00:01.00]Bonjour\n[00:02.00]Monde'; });
        await playWithLyrics(page);
        await page.evaluate(() => emit('queue:indexChanged', { index: 0 }));
        await page.waitForFunction(() => /Bonjour/.test(getActiveSyncedLyricsForSong(SONGS_DATA[0]).text), null, { timeout: 6000 });
        await page.evaluate(() => emit('queue:indexChanged', { index: 0 }));
        await page.waitForTimeout(2500);
        assert.equal((await calls(page, 'translate')).length, 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Lyrics reading: "AI may read lyrics" and "Playing now" send only the playing song with its lyrics; without the switch no lyrics leave', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await playWithLyrics(page);
        await chatButton(page).click();
        const popup = page.locator('.ai-popup');
        await popup.getByLabel('Message', { exact: true }).fill('plain');
        await popup.getByRole('button', { name: 'Send' }).click();
        await popup.getByText('Create the playlist').waitFor({ timeout: 4000 });
        let sent = (await calls(page, 'plan'))[0];
        assert.deepEqual([sent.includeLyrics, sent.lyrics], [false, undefined]);
        await popup.getByRole('radio', { name: 'Playing now' }).click();
        await popup.getByRole('button', { name: 'AI may read lyrics' }).click();
        await popup.getByLabel('Message', { exact: true }).fill('what is this song about?');
        await popup.getByRole('button', { name: 'Send' }).click();
        await page.waitForFunction(() => window.__ai.calls.filter((c) => c[0] === 'plan').length === 2);
        sent = (await calls(page, 'plan'))[1];
        assert.deepEqual([sent.count, sent.includeLyrics], [1, true]);
        assert.match(sent.lyrics, /Hello/);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('Settings: default translation language and auto-translate are saved (auto needs a language first)', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open(ON);
        await page.locator('.rail-btn[data-view="settings"]').click();
        await page.locator('.settings-card[data-page="ai"]').click();
        const section = page.locator('.ai-settings');
        await section.waitFor({ timeout: 4000 });
        await section.getByRole('button', { name: 'Translate lyrics automatically' }).click();
        await section.getByText('Choose a default language first').waitFor({ timeout: 3000 });
        await section.getByLabel('Default translation language').fill('Persian');
        await section.getByRole('button', { name: 'Save language' }).click();
        await section.getByText('Translating into Persian').waitFor({ timeout: 3000 });
        await section.getByRole('button', { name: 'Translate lyrics automatically' }).click();
        await page.waitForFunction(() => window.__ai.state.autoTranslate === true);
        assert.equal(await page.evaluate(() => window.__ai.state.translateLanguage), 'Persian');
        assert.deepEqual(errors, []);
        await page.close();
    });
});
