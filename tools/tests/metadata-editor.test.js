// Browser tests for the metadata editor UI (right panel): what it sends on Save, and that it
// can no longer overwrite, blank or mis-target tags. The Electron/Python side is stubbed and
// records what the UI asks it to do.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

// What the file really contains, INCLUDING fields that are hidden until "More metadata tags" is opened.
const DISK = {
    title: "Don't Stop Me Now (a title far longer than the fifty characters the scanner keeps)", artist: ['Earth, Wind & Fire'], album: 'Jazz', albumArtist: ['Queen'], genre: ['Rock'], year: '1978',
    track: '7', trackTotal: '13', discNumber: '1', discTotal: '1', composer: ['Freddie Mercury'], conductor: [], remixer: [], label: 'EMI', publisher: '', producer: '', comment: 'my comment', bpm: '156', isrc: 'GBUM71029604',
    musicBrainzTrackId: 't1', musicBrainzAlbumId: 'a1', musicBrainzOriginalAlbumId: 'o1',
    copyright: '(c) 1978 EMI', grouping: 'Classics', compilation: '', mediaKind: '', description: '', mood: 'Happy', language: 'eng', sortTitle: 'Dont Stop Me Now, ', sortArtist: 'Queen', sortAlbum: 'Jazz',
    sortComposer: 'Mercury, Freddie', writer: 'Freddie Mercury', lyricist: 'Freddie Mercury', musicBrainzArtistId: ['art-1'], musicBrainzReleaseGroupId: 'rg1', otherTags: [], cover: null
};

const pw = loadPlaywright();

describe('metadata editor UI', { concurrency: false }, () => {
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(50);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    // opens the editor for song 1 with a stubbed backend; `read` decides what getAudioMetadata returns
    async function openEditor(read = { success: true, metadata: DISK }) {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(900);
        await page.evaluate(
            ([disk, readResult]) => {
                window.__saved = [];
                let resolveRead;
                window.__readGate = new Promise((r) => (resolveRead = r));
                window.__releaseRead = () => resolveRead();
                window.electronAPI = {
                    getAudioMetadata: async () => {
                        if (window.__gateReads) await window.__readGate;
                        return JSON.parse(JSON.stringify(readResult));
                    },
                    saveAudioMetadata: async (p) => {
                        window.__saved.push(p);
                        return { success: true, metadata: Object.assign({}, disk, p.metadata) };
                    }
                };
                playbackQueue = [SONGS_DATA[0], SONGS_DATA[1]];
                currentQueueIndex = 0;
            },
            [DISK, read]
        );
        return { page, errors };
    }
    const type = (page, key, value) =>
        page.evaluate(([k, v]) => {
            const el = document.querySelector(`[data-metadata-key="${k}"]`);
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, [key, value]);
    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    test('save sends ONLY the changed field (hidden fields and untouched fields are never sent)', async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openEditor();
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        await type(page, 'album', 'Jazz (Remastered)');
        await page.evaluate('saveMetadataEditor()');
        await page.waitForTimeout(300);
        const sent = await page.evaluate('window.__saved[0].metadata');
        assert.deepEqual(sent, { album: 'Jazz (Remastered)' });
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('opening and saving without changing anything writes nothing', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor();
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        await type(page, 'album', 'temp');
        await type(page, 'album', 'Jazz'); // typed, then put back
        await page.evaluate('saveMetadataEditor()');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate('window.__saved.length'), 0, 'a net-zero edit must not touch the file');
        await page.close();
    });

    test('clearing a field is sent as an explicit empty value', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor();
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        await type(page, 'label', '');
        await page.evaluate('saveMetadataEditor()');
        await page.waitForTimeout(300);
        assert.deepEqual(await page.evaluate('window.__saved[0].metadata'), { label: '' });
        await page.close();
    });

    test('the form shows the real tags from the file (not the scanner\'s shortened copy)', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor();
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(`document.querySelector('[data-metadata-key="title"]').value`), DISK.title);
        assert.equal(await page.evaluate(`document.querySelector('[data-metadata-key="track"]').value`), '7');
        await page.close();
    });

    test('fields are locked (and Save disabled) until the file has been read', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor();
        await page.evaluate('window.__gateReads = true; openMetadataEditor()');
        await page.waitForTimeout(300);
        const locked = await page.evaluate(`({ titleDisabled: document.querySelector('[data-metadata-key="title"]').disabled, saveDisabled: document.getElementById('metadata-editor-save').disabled })`);
        assert.deepEqual(locked, { titleDisabled: true, saveDisabled: true });
        await page.evaluate('window.__releaseRead()');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(`document.querySelector('[data-metadata-key="title"]').disabled`), false);
        await page.close();
    });

    test('if the tags cannot be read, editing is disabled instead of falling back to shortened data', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor({ success: false, error: 'Python runtime not found' });
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(`document.querySelector('[data-metadata-key="title"]')`), null, 'no editable form should be shown');
        assert.match(await page.evaluate(`document.getElementById('metadata-editor-content').textContent`), /Python runtime not found/);
        assert.equal(await page.evaluate('window.__saved.length'), 0);
        await page.close();
    });

    test('toggling "More metadata tags" keeps what you typed', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor();
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        await type(page, 'title', 'My unsaved edit');
        await page.evaluate('toggleMetadataMore()');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(`document.querySelector('[data-metadata-key="title"]').value`), 'My unsaved edit');
        assert.equal(await page.evaluate(`document.querySelector('[data-metadata-key="copyright"]').value`), '(c) 1978 EMI', 'hidden field should now show the file value');
        await page.evaluate('saveMetadataEditor()');
        await page.waitForTimeout(300);
        assert.deepEqual(await page.evaluate('window.__saved[0].metadata'), { title: 'My unsaved edit' });
        await page.close();
    });

    test('an edit is written to the edited file and applied to that song even if playback moves on', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor();
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        await type(page, 'album', 'EDIT FOR SONG 1');
        const before = await page.evaluate('[SONGS_DATA[0].album, SONGS_DATA[1].album]');
        await page.evaluate('currentQueueIndex = 1'); // next track starts while the editor is open
        await page.evaluate('saveMetadataEditor()');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate('window.__saved[0].fileUrl'), 'file:///music/1.mp3');
        assert.equal(await page.evaluate('SONGS_DATA[0].album'), 'EDIT FOR SONG 1');
        assert.equal(await page.evaluate('SONGS_DATA[1].album'), before[1], 'the song that is playing now must not receive the edit');
        await page.close();
    });

    test('online import fills only what the source provided and never blanks existing values', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor();
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        await page.evaluate('toggleMetadataMore()');
        await page.waitForTimeout(300);
        await page.evaluate(() => setMetadataFields({ title: 'Imported title', track: '', trackTotal: '', bpm: '', copyright: '', composer: [], conductor: '' }));
        const v = await page.evaluate(`({ title: document.querySelector('[data-metadata-key="title"]').value, track: document.querySelector('[data-metadata-key="track"]').value, bpm: document.querySelector('[data-metadata-key="bpm"]').value, copyright: document.querySelector('[data-metadata-key="copyright"]').value })`);
        assert.deepEqual(v, { title: 'Imported title', track: '7', bpm: '156', copyright: '(c) 1978 EMI' });
        await page.close();
    });

    test('multi-value fields are compared by value (unchanged artist chips are not re-sent)', async (t) => {
        if (!guard(t)) return;
        const { page } = await openEditor();
        await page.evaluate('openMetadataEditor()');
        await page.waitForTimeout(400);
        await type(page, 'title', 'Only the title');
        const changes = await page.evaluate('metadataEditorChanges()');
        assert.deepEqual(Object.keys(changes), ['title'], 'artist "Earth, Wind & Fire" must not appear in the patch');
        await page.close();
    });
});
