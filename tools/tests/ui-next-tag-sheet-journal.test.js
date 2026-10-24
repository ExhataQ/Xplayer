'use strict';

// PD-06 in the real new shell: applying in Metadata > Many songs writes a journal entry, the notification has an Undo button that puts the
// old tags back, and after a restart (a fresh page with the same journal and files) "Undo last apply" still works.
// Skips itself when Playwright or a browser is not there. Run: node --test tools/tests/ui-next-tag-sheet-journal.test.js

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const OPTIONS = { timeout: 60000 };

// What the main process would answer, kept in the page so the test can look at it: files (window.__disk), the journal (window.__journal).
function installApi(seed) {
    const disk = seed.disk || {};
    const journal = seed.journal || [];
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const DEFAULT = { title: 'T', artist: ['A'], album: 'Old', albumArtist: [], genre: ['Rock', 'Pop'], year: '2001', label: '' };
    const tags = (u) => (disk[u] = disk[u] || clone(DEFAULT));
    window.__disk = disk;
    window.__journal = journal;
    window.__api = {
        getAudioMetadata: async (u) => ({ success: true, metadata: clone(tags(u)) }),
        saveAudioMetadataMany: async (items) => ({
            success: true,
            results: items.map((item) => {
                const t = tags(item.fileUrl);
                const previous = {};
                for (const key of Object.keys(item.metadata)) previous[key] = clone(t[key]);
                Object.assign(t, clone(item.metadata));
                return { fileUrl: item.fileUrl, success: true, metadata: clone(item.metadata), previous };
            })
        }),
        aiJournalRecord: async (e) => { const entry = { id: `j${journal.length + 1}`, at: Date.now(), kind: e.kind, summary: e.summary, status: 'done', changes: clone(e.changes) }; journal.push(entry); return { ok: true, entry }; },
        aiJournalGet: async (id) => clone(journal.find((e) => e.id === id) || null),
        aiJournalList: async () => journal.slice().reverse().map(({ id, at, kind, summary, status, changes }) => ({ id, at, kind, summary, status, changeCount: changes.length })),
        aiJournalMarkUndone: async (id) => { const e = journal.find((x) => x.id === id); if (e) e.status = 'undone'; return { ok: Boolean(e) }; }
    };
}

describe('Undo journal in the tag sheet', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(window.__api&&window.__api[k])||((...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);}) });</script>\n`;
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open(seed = {}) {
        const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.addInitScript(`(${installApi.toString()})(${JSON.stringify(seed)})`);
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        await page.click('.rail-btn[data-view="metadata"]');
        await page.waitForSelector('.view-host[data-view="metadata"]');
        await page.evaluate(() => window.playSongFromList(window.SONGS_DATA[0].id));
        await page.click('.metadata-mode button:has-text("Many songs")');
        await page.waitForSelector('.tag-sheet');
        await page.selectOption('select[aria-label="Add songs from"]', 'all-songs');
        await page.waitForSelector('.tag-sheet tbody tr');
        return { page, errors };
    }
    // Check the first row, set its album, and press Review and apply, then Apply.
    async function changeFirstAlbum(page, value) {
        await page.locator('.tag-sheet tbody input[type="checkbox"]').nth(0).check();
        await page.selectOption('select[aria-label="Tag to apply"]', 'album');
        await page.fill('input[aria-label="Tag or name"]', value);
        await page.click('.tag-sheet button:has-text("Replace")');
        await page.click('.tag-sheet button:has-text("Review and apply")');
        await page.click('button:has-text("Apply 1 change")');
    }
    const albums = (page) => page.evaluate(() => Object.values(window.__disk).map((t) => t.album));
    const firstRow = (page) => page.locator('.tag-sheet tbody tr').first().innerText();

    test('applying journals the old values; the notification\'s Undo button puts them back', OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await changeFirstAlbum(page, 'New Album');
        await page.waitForFunction(() => window.__journal.length === 1);

        const entry = await page.evaluate(() => window.__journal[0]);
        assert.equal(entry.kind, 'tag-sheet');
        assert.equal(entry.summary, 'Tags of 1 song: Album');
        assert.equal(entry.changes[0].type, 'set_tags');
        assert.equal(entry.changes[0].undo.changed.length, 1);
        assert.deepEqual(entry.changes[0].undo.changed[0].previous, { album: 'Old' }, 'only the tag that changed, with its old value');
        assert.deepEqual(await albums(page), ['New Album']);

        const undo = page.getByRole('button', { name: 'Undo', exact: true }).first();
        await undo.waitFor({ state: 'visible' });
        await undo.click();
        await page.waitForFunction(() => window.__journal[0].status === 'undone');
        assert.deepEqual(await albums(page), ['Old']);
        await page.waitForFunction(() => document.body.innerText.includes('The old tags were put back'));
        assert.match(await firstRow(page), /Old/);
        assert.doesNotMatch(await firstRow(page), /New Album/);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('after a restart (fresh page, same journal and files) "Undo last apply" still works', OPTIONS, async (t) => {
        if (!guard(t)) return;
        const first = await open();
        await changeFirstAlbum(first.page, 'New Album');
        await first.page.waitForFunction(() => window.__journal.length === 1);
        const seed = await first.page.evaluate(() => ({ disk: window.__disk, journal: window.__journal }));
        await first.page.close();

        const { page, errors } = await open(seed);
        assert.deepEqual(await albums(page), ['New Album'], 'the new session starts with the saved file');
        const undo = page.locator('.tag-sheet button:has-text("Undo last apply")');
        await undo.waitFor({ state: 'visible' });
        await undo.click();
        await page.waitForFunction(() => window.__journal[0].status === 'undone');
        assert.deepEqual(await albums(page), ['Old']);
        await page.waitForFunction(() => document.querySelector('.tag-sheet tbody tr')?.innerText.includes('Old'));
        assert.equal(await page.locator('.tag-sheet button:has-text("Undo last apply")').count(), 0, 'nothing left to undo');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a change that was already undone is not offered after a restart', OPTIONS, async (t) => {
        if (!guard(t)) return;
        const first = await open();
        await changeFirstAlbum(first.page, 'New Album');
        await first.page.waitForFunction(() => window.__journal.length === 1);
        const seed = await first.page.evaluate(() => ({ disk: window.__disk, journal: window.__journal }));
        await first.page.close();
        seed.journal[0].status = 'undone';
        const { page, errors } = await open(seed);
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.tag-sheet button:has-text("Undo last apply")').count(), 0);
        assert.deepEqual(errors, []);
        await page.close();
    });
});
