// The equalizer (task: equalizer): the pure parts of the engine module, the media protocol that lets Web Audio hear a file:// track, the markup of the
// settings section, and the wiring that sends every audio source through assignAudioSource. No browser: the Web Audio chain itself needs a real
// player, so it is only checked here for how it is wired.
//
// Run:   node --test tools/tests/equalizer.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const load = (...p) => import(pathToFileURL(path.join(ROOT, ...p)).href);

describe('equalizer settings and presets', () => {
    test('ten bands, every preset has ten gains inside the range, and a preset is found again from its bands', async () => {
        const eq = await load('src', 'js', 'playback', '15h-equalizer.js');
        assert.equal(eq.EQ_FREQUENCIES.length, 10);
        assert.equal(eq.EQ_LABELS.length, 10);
        for (const preset of eq.EQ_PRESETS) {
            assert.equal(preset.bands.length, 10, preset.id);
            assert.ok(preset.bands.every((db) => db >= eq.EQ_MIN_DB && db <= eq.EQ_MAX_DB), preset.id);
            assert.equal(eq.detectPreset(preset.bands), preset.id);
        }
        assert.deepEqual(eq.EQ_PRESETS[0].bands, new Array(10).fill(0), 'flat is the first preset');
        assert.equal(eq.detectPreset([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'custom');
    });

    test('gains are clamped to the range and to half decibels; bad saved data falls back to the defaults', async () => {
        const eq = await load('src', 'js', 'playback', '15h-equalizer.js');
        assert.equal(eq.clampDb(99), 12);
        assert.equal(eq.clampDb(-99), -12);
        assert.equal(eq.clampDb(2.3), 2.5);
        assert.equal(eq.clampDb('x'), 0);
        assert.deepEqual(eq.normalizeEqualizerSettings(null), eq.DEFAULT_EQUALIZER_SETTINGS);
        assert.deepEqual(eq.normalizeEqualizerSettings('nope'), eq.DEFAULT_EQUALIZER_SETTINGS);
        const odd = eq.normalizeEqualizerSettings({ enabled: 'yes', bands: [20, -20, 'a'], preamp: 40, preventClipping: false });
        assert.equal(odd.enabled, false, 'only true turns it on');
        assert.deepEqual(odd.bands, [12, -12, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert.equal(odd.preamp, 12);
        assert.equal(odd.preventClipping, false);
        assert.equal(odd.preset, 'custom');
    });

    test('prevent clipping lowers the preamp by the loudest boost, and only by a boost', async () => {
        const eq = await load('src', 'js', 'playback', '15h-equalizer.js');
        const bands = [6, 0, 0, 0, 0, 0, 0, 0, -3, 0];
        assert.equal(eq.headroomDb(bands), 6);
        assert.equal(eq.headroomDb([-4, -2, 0, 0, 0, 0, 0, 0, 0, 0]), 0);
        assert.equal(eq.effectivePreampDb({ preamp: 2, bands, preventClipping: true }), -4);
        assert.equal(eq.effectivePreampDb({ preamp: 2, bands, preventClipping: false }), 2);
        assert.ok(Math.abs(eq.dbToGain(6) - 1.9953) < 0.001);
        assert.equal(eq.dbToGain(0), 1);
    });

    test('a file or https url is served through the media protocol, anything else is left alone', async () => {
        const eq = await load('src', 'js', 'playback', '15h-equalizer.js');
        const file = 'file:///C:/My Music/a #1.mp3';
        const mapped = eq.toMediaUrl(file);
        assert.match(mapped, /^xplayer-media:\/\/media\//);
        assert.equal(decodeURIComponent(new URL(mapped).pathname.slice(1)), file);
        assert.ok(eq.toMediaUrl('https://example.com/a.mp3').startsWith('xplayer-media://'));
        assert.equal(eq.toMediaUrl('blob:file:///abc'), 'blob:file:///abc');
        assert.equal(eq.toMediaUrl(''), '');
        assert.equal(eq.isMediaUrl(mapped), true);
        assert.equal(eq.isMediaUrl(file), false);
    });
});

describe('media protocol (electron/media-protocol.js)', () => {
    const media = require(path.join(ROOT, 'electron', 'media-protocol.js'));
    const handler = media.makeHandler({ fetch: async () => new Response('remote', { status: 200 }) });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-media-'));
    const song = path.join(dir, 'song.mp3');
    fs.writeFileSync(song, Buffer.from('0123456789'));
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'secret');
    const ask = (file, headers = {}) => handler(new Request(`xplayer-media://media/${encodeURIComponent(pathToFileURL(file).href)}`, { headers }));

    test('a whole file is served with its type, the byte-range header and the CORS approval', async () => {
        const response = await ask(song);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), 'audio/mpeg');
        assert.equal(response.headers.get('accept-ranges'), 'bytes');
        assert.equal(response.headers.get('access-control-allow-origin'), '*');
        assert.equal(await response.text(), '0123456789');
    });

    test('a range is answered with 206 and the right bytes, so the seek bar works', async () => {
        const response = await ask(song, { Range: 'bytes=2-5' });
        assert.equal(response.status, 206);
        assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
        assert.equal(response.headers.get('content-length'), '4');
        assert.equal(await response.text(), '2345');
        const tail = await ask(song, { Range: 'bytes=7-' });
        assert.equal(await tail.text(), '789');
        const suffix = await ask(song, { Range: 'bytes=-3' });
        assert.equal(await suffix.text(), '789');
    });

    test('a range past the end is refused with 416', async () => {
        assert.equal((await ask(song, { Range: 'bytes=50-60' })).status, 416);
        assert.equal((await ask(song, { Range: 'bytes=abc' })).status, 416);
    });

    test('only audio files that exist are served: a text file or a missing file is not', async () => {
        assert.equal((await ask(path.join(dir, 'notes.txt'))).status, 404);
        assert.equal((await ask(path.join(dir, 'missing.mp3'))).status, 404);
        assert.equal((await handler(new Request('xplayer-media://media/'))).status, 400);
    });

    test('an https url is passed through with the CORS approval added', async () => {
        const response = await handler(new Request(`xplayer-media://media/${encodeURIComponent('https://example.com/a.mp3')}`));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('access-control-allow-origin'), '*');
        assert.equal(await response.text(), 'remote');
        const insecure = await handler(new Request(`xplayer-media://media/${encodeURIComponent('http://example.com/a.mp3')}`));
        assert.equal(insecure.status, 404, 'plain http is not passed through');
    });

    test('parseRange', () => {
        assert.deepEqual(media.parseRange('bytes=0-3', 10), { start: 0, end: 3 });
        assert.deepEqual(media.parseRange('bytes=4-99', 10), { start: 4, end: 9 });
        assert.equal(media.parseRange(null, 10), null);
        assert.equal(media.parseRange('bytes=-', 10), 'invalid');
        assert.equal(media.parseRange('bytes=-0', 10), 'invalid');
    });
});

describe('wiring', () => {
    test('every audio source goes through assignAudioSource: no song url is assigned to an element directly', () => {
        for (const file of ['10d-playback-song.js', '10c-playback-queue.js', '15g-controls-volume-fade.js']) {
            const code = read('src', 'js', 'playback', file);
            assert.doesNotMatch(code, /(audioElement|gaplessAudioElement)\.src\s*=\s*song\.url/, file);
            assert.match(code, /import \{ assignAudioSource \} from '\.\/15h-equalizer\.js'/, file);
        }
    });

    test('the main process declares the scheme before ready and serves it after; the preload says it is there', () => {
        const main = read('electron', 'main.js');
        assert.ok(main.indexOf('mediaProtocol.registerScheme') < main.indexOf('app.whenReady()'), 'declared first');
        assert.match(main, /mediaProtocol\.install\(/);
        assert.match(read('electron', 'preload.js'), /mediaProtocolAvailable: \(\) => true/);
        assert.match(read('src', 'js', 'api', 'desktop-api.js'), /mediaProtocolAvailable: 'sync'/);
    });

    test('the policy lets the page play the protocol, in both interfaces, and loosens nothing else', () => {
        for (const file of [['src', 'ui-next', 'index.html'], ['src', 'old-ui', 'music_player.template.html']]) {
            assert.match(read(...file), /media-src 'self' blob: file: https: xplayer-media:;/, file.join('/'));
        }
        assert.doesNotMatch(read('electron', 'main.js'), /webSecurity\s*:\s*false/);
    });

    test('the modules are loaded and the section is in the Playback tab', () => {
        const main = read('src', 'js', 'main.js');
        assert.match(main, /playback\/15h-equalizer\.js/);
        assert.match(main, /ui\/08e1-equalizer-settings\.js/);
        assert.match(read('src', 'js', 'ui', '08e-panel-settings.js'), /\$\{buildEqualizerSection\(\)\}/);
        assert.match(read('src', 'ui-next', 'shell', 'settings-layout.js'), /titles: \['Playback', 'Equalizer'/);
    });
});

describe('settings section markup', () => {
    test('ten vertical band sliders with their labels, a preset menu with the saved choice, and the other controls', async () => {
        globalThis.storageReadJson = (_key, fallback, normalize) => normalize({ enabled: true, bands: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0], preamp: -1.5 });
        globalThis.STORAGE_KEYS = { EQUALIZER_SETTINGS: 'equalizerSettings' };
        globalThis.desktopApi = { supports: () => true, files: { mediaProtocolAvailable: () => true } };
        const { buildEqualizerSection } = await load('src', 'js', 'ui', '08e1-equalizer-settings.js');
        const html = buildEqualizerSection();
        assert.equal((html.match(/data-eq-band="/g) || []).length, 10);
        assert.match(html, /data-eq-db="0">\+6 dB</);
        assert.match(html, /aria-label="32 Hz"/);
        assert.match(html, /aria-label="16 kHz"/);
        assert.match(html, /<option value="bass" selected>Bass boost<\/option>/);
        assert.match(html, /data-eq="enabled" checked/);
        assert.match(html, /<input[^>]*value="-1.5"[^>]*data-eq="preamp"/);
        assert.match(html, /data-action="equalizerReset"/);
        assert.match(html, /data-available="true"/);
        for (const action of ['equalizerEnabledChanged', 'equalizerPresetChanged', 'equalizerBandInput', 'equalizerPreampInput', 'equalizerClippingChanged']) assert.ok(html.includes(action), action);
    });
});
