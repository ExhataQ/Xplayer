// The UI event subscribers (04h to 04v) are ES modules imported by src/js/main.js right after the start-up module.
// They subscribe with top-level on(...) calls, so they have to be registered after the classic scripts and
// before the page starts (and before anything can emit). This records, in a real page, which file subscribed
// to which event and when events were emitted, and checks:
//   - every on('name', ...) written in those files is registered, once, by that file, in manifest order;
//   - nothing emitted one of these events before its subscriber existed;
//   - the page has no errors.
// The page is loaded once; every test reads the same recording. That the page loads one module entry and no
// classic renderer script is checked in manifest.test.js.
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const manifest = require('../lib/manifest').readManifest(ROOT);
const SUBSCRIBER_FILES = [
    '04h-recents-history-events.js',
    '04i-library-rebuild-events.js',
    '04j-pinned-items-events.js',
    '04k-playlists-events.js',
    '04l-search-history-events.js',
    '04m-playback-settings-events.js',
    '04n-import-export-events.js',
    '04o-folders-events.js',
    '04p-playback-events.js',
    '04t-lyrics-events.js',
    '04u-search-events.js',
    '04v-right-panel-events.js'
];

// [ [file, eventName], ... ] in source order, read from the files themselves.
function writtenSubscriptions() {
    const out = [];
    for (const file of SUBSCRIBER_FILES) {
        const source = fs.readFileSync(path.join(ROOT, 'src', 'js', file), 'utf8');
        for (const m of source.matchAll(/^on\('([^']+)'/gm)) out.push([file, m[1]]);
    }
    return out;
}

describe('UI event subscribers as ES modules', () => {
    test('are imported by main.js in this order, right after core/startup.js and before every other renderer module', () => {
        const start = manifest.modules.indexOf('core/startup.js') + 1;
        assert.ok(start > 0);
        assert.deepEqual(manifest.modules.slice(start, start + SUBSCRIBER_FILES.length), SUBSCRIBER_FILES);
    });

    test('each file subscribes at the top level and has no function or variable others could need', () => {
        for (const file of SUBSCRIBER_FILES) {
            const source = fs.readFileSync(path.join(ROOT, 'src', 'js', file), 'utf8');
            assert.ok(/^on\('/m.test(source), `${file} has no top-level on(...)`);
            assert.ok(/^export \{\};\s*$/m.test(source), `${file} should end with an empty export`);
            assert.ok(!/^(async\s+)?function\s|^(let|const|var|class)\s/m.test(source), `${file} declares a top-level name; it would have to be registered for classic code`);
        }
    });

    test('the 36 subscriptions the sources write are the ones the report lists', () => {
        assert.equal(writtenSubscriptions().length, 36);
    });
});

describe('UI event subscribers in the real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(5);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    // Every addEventListener / dispatchEvent whose type looks like a bus event (`subject:verb`), in order.
    async function load() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript(() => {
            window.__bus = [];
            const fileOf = (stack) => {
                const files = (stack || '')
                    .split('\n')
                    .map((line) => (line.match(/\/js\/([\w\-./]+\.js)/) || [])[1])
                    .filter(Boolean);
                return files.find((f) => f !== '00b-events.js') || '(other)';
            };
            const add = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function (type, listener, options) {
                if (typeof type === 'string' && /^[a-zA-Z]+:[a-zA-Z]/.test(type)) window.__bus.push(['on', type, fileOf(new Error().stack)]);
                return add.call(this, type, listener, options);
            };
            const dispatch = EventTarget.prototype.dispatchEvent;
            EventTarget.prototype.dispatchEvent = function (event) {
                if (event && typeof event.type === 'string' && /^[a-zA-Z]+:[a-zA-Z]/.test(event.type)) window.__bus.push(['emit', event.type, fileOf(new Error().stack)]);
                return dispatch.call(this, event);
            };
        });
        await gotoApp(page, dir);
        const log = await page.evaluate(() => window.__bus);
        await page.close();
        assert.deepEqual(errors, []);
        return { log };
    }
    let recording;
    const record = () => (recording ||= load());

    test('every written on(...) is registered once by its own file, in file order and source order', async (t) => {
        if (skip) return void t.skip(skip);
        const { log } = await record();
        const written = writtenSubscriptions();
        const names = new Set(written.map(([, name]) => name));
        const registered = log.filter(([kind, type]) => kind === 'on' && names.has(type)).map(([, type, file]) => [file, type]);
        assert.deepEqual(registered, written);
    });

    test('no bus event is emitted before its subscriber exists', async (t) => {
        if (skip) return void t.skip(skip);
        const { log } = await record();
        const names = new Set(writtenSubscriptions().map(([, name]) => name));
        const subscribed = new Set();
        for (const [kind, type] of log) {
            if (kind === 'on') subscribed.add(type);
            else if (names.has(type)) assert.ok(subscribed.has(type), `${type} was emitted before its subscriber was registered`);
        }
    });

    test('the recording sees the bus (so the checks above cannot pass on an empty list)', async (t) => {
        if (skip) return void t.skip(skip);
        const { log } = await record();
        assert.ok(log.some(([kind, type, file]) => kind === 'on' && type === 'lyrics:changed' && file === '04t-lyrics-events.js'));
    });
});
