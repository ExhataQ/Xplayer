const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const pw = loadPlaywright();
const TEST_OPTIONS = { timeout: 40000 };
const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const ENGINE_GLOBALS = [
    'addSongToQueueNext',
    'audioElement',
    'currentQueueIndex',
    'currentView',
    'getSongsForList',
    'goBack',
    'goForward',
    'isShuffled',
    'on',
    'openAlbum',
    'openArtist',
    'playSongFromList',
    'playbackQueue',
    'repeatMode',
    'selectedSongIds',
    'switchView',
    'toggleFavorite',
    'toggleMute',
    'updateVolume'
];

function listJavaScript(dir, excluded = []) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (excluded.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...listJavaScript(fullPath));
        else if (entry.isFile() && fullPath.endsWith('.js')) files.push(fullPath);
    }
    return files;
}

function writeWav(file, seconds = 8) {
    const rate = 8000;
    const samples = rate * seconds;
    const buffer = Buffer.alloc(44 + samples * 2);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples * 2, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24);
    buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) {
        buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 3000), 44 + i * 2);
    }
    fs.writeFileSync(file, buffer);
}

test('adapter API stays within its line budget and outside code respects import/global boundaries', () => {
    const apiFiles = ['store.js', 'actions.js', 'events.js'].map((name) => path.join(NEXT_SRC, 'adapter', name));
    const codeLines = apiFiles.reduce((sum, file) => {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        return sum + lines.filter((line) => line.trim() && !/^\s*(?:\/\/|\/\*|\*|\*\/)/.test(line)).length;
    }, 0);
    assert.ok(codeLines <= 300, `adapter API uses ${codeLines} code lines (maximum 300)`);

    const globalPattern = new RegExp(`\\bwindow\\s*\\.\\s*(?:${ENGINE_GLOBALS.join('|')})\\b`);
    for (const file of listJavaScript(NEXT_SRC, ['adapter', 'components'])) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
            assert.doesNotMatch(match[1], /(?:^|\/)js(?:\/|$)|(?:^|\/)src\/js(?:\/|$)/, `${file} imports engine module ${match[1]}`);
        }
        const bracketGlobalPattern = new RegExp(`\\bwindow\\s*\\[\\s*['"](?:${ENGINE_GLOBALS.join('|')})['"]\\s*\\]`);
        assert.doesNotMatch(source, globalPattern, `${file} accesses an engine global on window`);
        assert.doesNotMatch(source, bracketGlobalPattern, `${file} accesses an engine global on window`);
    }
});

describe('adapter API against the engine', { concurrency: false }, () => {
    let browser;
    let dir;
    let wav;
    let skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
        wav = path.join(dir, 'adapter-api-tone.wav');
        writeWav(wav);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function open() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error.message)));
        await page.goto(`file://${path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/')}`);
        await waitForAppSettled(page, 3000);
        await page.evaluate(([audioUrl]) => {
            SONGS_DATA.forEach((song) => (song.url = audioUrl));
            return Promise.all([
                import('./ui-next/adapter/store.js'),
                import('./ui-next/adapter/actions.js'),
                import('./ui-next/adapter/events.js'),
                import('./ui-next/adapter/engine-view.js')
            ]).then(([store, actions, events, view]) => {
                window.API = { store, actions, events, view };
            });
        }, [`file://${wav.replace(/\\/g, '/')}`]);
        return { page, errors };
    }

    test('store returns read-only state copies, and events are allow-listed and unsubscribe cleanly', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        const initial = await page.evaluate(() => {
            const selection = API.store.getSelection();
            const songs = API.store.songs('all-songs');
            selection.add(-1);
            songs.pop();
            return {
                view: API.store.getCurrentView(),
                queue: API.store.getQueue(),
                index: API.store.getQueueIndex(),
                song: API.store.getCurrentSong(),
                playing: API.store.isPlaying(),
                volume: API.store.getVolume(),
                muted: API.store.isMuted(),
                repeat: API.store.getRepeatMode(),
                shuffled: API.store.isShuffled(),
                selectionSize: API.store.getSelection().size,
                listCount: API.store.songs('all-songs').length,
                events: API.events.ENGINE_EVENTS.length
            };
        });
        assert.equal(initial.view, 'all-songs');
        assert.deepEqual(initial.queue, []);
        assert.equal(initial.index, -1);
        assert.equal(initial.song, null);
        assert.equal(initial.playing, false);
        assert.equal(initial.muted, false);
        assert.equal(initial.repeat, 0);
        assert.equal(initial.shuffled, false);
        assert.equal(initial.selectionSize, 0);
        assert.equal(initial.listCount, 30);
        assert.ok(initial.volume >= 0 && initial.volume <= 1);
        assert.ok(initial.events >= 30);

        const eventResult = await page.evaluate(() => {
            const payloads = [];
            const off = API.events.on('view:changed', (payload) => payloads.push(payload));
            API.actions.switchView('search');
            const railAfterSearch = document.querySelector('.rail-btn[aria-current="page"]')?.dataset.view;
            off();
            API.actions.switchView('all-songs');
            let rejected = false;
            try {
                API.events.on('timeupdate', () => {});
            } catch (error) {
                rejected = error instanceof RangeError;
            }
            return { payloads, railAfterSearch, rejected, currentView: API.store.getCurrentView() };
        });
        assert.deepEqual(eventResult.payloads, [{ view: 'search' }]);
        assert.equal(eventResult.railAfterSearch, 'search');
        assert.equal(eventResult.rejected, true);
        assert.equal(eventResult.currentView, 'all-songs');
        await page.waitForFunction(() => document.querySelector('.rail-btn[aria-current="page"]')?.dataset.view === 'library');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('actions invoke real playback, navigation, queue, favorite, and view behavior', TEST_OPTIONS, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await open();
        await page.mouse.click(5, 5);
        const started = await page.evaluate(() => {
            const firstSong = SONGS_DATA[0];
            API.actions.playSongFromList(firstSong.id, 'all-songs', 0);
            return firstSong.id;
        });
        await page.waitForFunction(() => API.store.isPlaying() && API.store.getCurrentSong()?.id === window.SONGS_DATA[0].id, null, { timeout: 8000 });

        const copyState = await page.evaluate(() => {
            const queue = API.store.getQueue();
            const length = API.store.getQueue().length;
            const current = API.store.getCurrentSong();
            (queue[0].song || queue[0]).title = '__adapter_copy__';
            current.title = '__adapter_copy__';
            queue.pop();
            return {
                unchangedTitle: API.store.getCurrentSong().title !== '__adapter_copy__',
                unchangedLength: API.store.getQueue().length === length
            };
        });
        assert.deepEqual(copyState, { unchangedTitle: true, unchangedLength: true });

        const queueBefore = await page.evaluate(() => API.store.getQueue().length);
        await page.evaluate(() => API.actions.next());
        await page.waitForFunction(() => API.store.getQueueIndex() === 1);
        await page.evaluate(() => API.actions.previous());
        await page.waitForFunction(() => API.store.getQueueIndex() === 0);
        const playbackState = await page.evaluate((songId) => {
            API.actions.seekTo(2);
            const seekTime = audioElement.currentTime;
            API.actions.setVolume(0.37);
            const volume = API.store.getVolume();
            API.actions.toggleMute();
            const muted = API.store.isMuted();
            API.actions.setVolume(0.42);
            API.actions.togglePlayback();
            const queuedSongId = SONGS_DATA[2].id;
            API.actions.addSongToQueueNext(queuedSongId);
            API.actions.toggleFavorite(songId);
            let seekRejected = false;
            let volumeRejected = false;
            try { API.actions.seekTo(-1); } catch (error) { seekRejected = error instanceof RangeError; }
            try { API.actions.setVolume(2); } catch (error) { volumeRejected = error instanceof RangeError; }
            return {
                queueAfter: API.store.getQueue().length,
                currentSong: API.store.getCurrentSong(),
                containsAddedSong: API.store.getQueue().some((item) => (item.song || item).id === queuedSongId),
                seekTime,
                volume,
                muted,
                favoriteSongs: API.store.songs('favorites').map((song) => song.id),
                seekRejected,
                volumeRejected
            };
        }, started);
        assert.ok(queueBefore > 1);
        assert.equal(playbackState.queueAfter, queueBefore + 1);
        assert.equal(playbackState.currentSong.id, started);
        assert.equal(playbackState.containsAddedSong, true);
        assert.ok(Math.abs(playbackState.seekTime - 2) < 0.1);
        assert.ok(Math.abs(playbackState.volume - 0.37) < 0.01);
        assert.equal(playbackState.muted, true);
        assert.ok(playbackState.favoriteSongs.includes(started));
        assert.equal(playbackState.seekRejected, true);
        assert.equal(playbackState.volumeRejected, true);
        await page.waitForFunction(() => !API.store.isPlaying());
        await page.evaluate(() => API.actions.play());
        await page.waitForFunction(() => API.store.isPlaying());
        await page.evaluate(() => API.actions.pause());
        await page.waitForFunction(() => !API.store.isPlaying());

        const navigation = await page.evaluate(() => {
            API.actions.switchView('settings');
            API.actions.goBack();
            const back = API.store.getCurrentView();
            API.actions.goForward();
            const forward = API.store.getCurrentView();
            const album = window.getAlbums()[0];
            const artist = window.getArtists()[0];
            API.actions.openAlbum(album.id);
            const albumView = API.store.getCurrentView();
            API.actions.openArtist(artist.id);
            const artistView = API.store.getCurrentView();
            return { back, forward, albumView, artistView, expectedAlbum: album.id, expectedArtist: artist.id };
        });
        assert.equal(navigation.back, 'all-songs');
        assert.equal(navigation.forward, 'settings');
        assert.equal(navigation.albumView, navigation.expectedAlbum);
        assert.equal(navigation.artistView, navigation.expectedArtist);
        await page.waitForFunction(() => document.querySelector('.rail-btn[aria-current="page"]')?.dataset.view === 'library');
        assert.deepEqual(errors, []);
        await page.close();
    });
});
