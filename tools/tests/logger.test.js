'use strict';

// electron/logger.js and electron/app-info.js: the main process log, and the diagnostics text Settings > About copies.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const { createLogger, hookProcess, redact } = require(path.join(ROOT, 'electron', 'logger.js'));
const { buildDiagnostics, getInfo } = require(path.join(ROOT, 'electron', 'app-info.js'));

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'logger-'));

describe('createLogger', () => {
    test('writes dated lines, keeps multi-line errors together, and returns the last lines', () => {
        const dir = tempDir();
        const log = createLogger({ dir: path.join(dir, 'logs'), now: () => new Date('2026-11-01T10:00:00Z') });
        log.info('hello');
        log.error('bad', new Error('boom'));
        const text = fs.readFileSync(path.join(dir, 'logs', 'main.log'), 'utf8');
        assert.match(text, /^2026-11-01T10:00:00.000Z INFO hello\n/);
        assert.match(text, /ERROR bad Error: boom\n\s+at /);
        assert.equal(log.tail(1).length, 1);
        assert.ok(log.tail(50).length >= 3);
    });

    test('rotates at the size limit and keeps three files', () => {
        const dir = tempDir();
        const log = createLogger({ dir, maxBytes: 200 });
        for (let i = 0; i < 40; i++) log.info('line number ' + i + ' ' + 'x'.repeat(30));
        const names = fs.readdirSync(dir).sort();
        assert.deepEqual(names, ['main.1.log', 'main.2.log', 'main.log']);
        for (const name of names) assert.ok(fs.statSync(path.join(dir, name)).size <= 400, name);
        assert.match(fs.readFileSync(path.join(dir, 'main.log'), 'utf8'), /line number 39/);
    });

    test('an unwritable folder never throws', () => {
        const dir = tempDir();
        const blocker = path.join(dir, 'file');
        fs.writeFileSync(blocker, 'x');
        const log = createLogger({ dir: path.join(blocker, 'logs') });
        assert.doesNotThrow(() => log.error('still fine'));
        assert.deepEqual(log.tail(), []);
    });
});

describe('hookProcess', () => {
    test('console.warn and console.error still print and are also logged; a crash and a gone process are logged', () => {
        const seen = [];
        const target = { warn: (...a) => seen.push(['warn', ...a]), error: (...a) => seen.push(['error', ...a]) };
        const handlers = {};
        const proc = { on: (name, fn) => { handlers[name] = fn; } };
        const appHandlers = {};
        const app = { on: (name, fn) => { appHandlers[name] = fn; } };
        const logged = [];
        const logger = { warn: (...a) => logged.push(['warn', ...a]), error: (...a) => logged.push(['error', ...a]) };
        hookProcess(logger, { target, proc, app });
        target.warn('careful');
        target.error('failed', 1);
        handlers.uncaughtExceptionMonitor(new Error('crash'));
        appHandlers['render-process-gone']({}, {}, { reason: 'crashed' });
        appHandlers['child-process-gone']({}, { type: 'GPU', reason: 'killed' });
        assert.deepEqual(seen, [['warn', 'careful'], ['error', 'failed', 1]]);
        assert.equal(logged.length, 5);
        assert.equal(logged[3][1], 'renderer process gone:');
        assert.equal(Object.keys(handlers).join(), 'uncaughtExceptionMonitor', 'only the monitor: Electron keeps its own crash handling');
    });
});

describe('redact and the diagnostics text', () => {
    test('drive paths, other absolute paths, file URLs and the user folder are removed', () => {
        const home = 'C:\\Users\\Someone';
        const cases = [
            ['cover failed for E:\\Music\\Band\\Song.mp3 (x)', 'cover failed for <path> (x)'],
            ['reading C:/Users/Someone/Music/a.flac now', 'reading <path> now'],
            ['url file:///E:/Music/a%20b.mp3 bad', 'url <file-url> bad'],
            ['at /home/someone/Music/Band/a.mp3:12', 'at <path>'],
            ['\\\\nas\\share\\a.mp3 gone', '<path> gone'],
            ['plain text, no path', 'plain text, no path']
        ];
        for (const [input, expected] of cases) assert.equal(redact(input, { home }).replace(/:\d+$/, ''), expected, input);
    });

    test('the text has the versions and the redacted log, and nothing else personal', () => {
        const info = { version: '1.0.0', electron: '44.10.1', mode: 'portable', dataDir: 'D:\\Apps\\Xplayer\\Xplayer-Data' };
        const text = buildDiagnostics({ info, tail: ['2026 ERROR scan failed E:\\Music\\x.mp3', '2026 INFO fine'], home: 'C:\\Users\\Someone', platform: 'win32', arch: 'x64', chrome: '1', node: '2' });
        assert.match(text, /^Xplayer 1\.0\.0\nElectron 44\.10\.1 \(Chrome 1, Node 2\)\nwin32 x64\nMode: portable/);
        assert.match(text, /scan failed <path>/);
        assert.doesNotMatch(text, /Music|x\.mp3/);
        assert.doesNotMatch(buildDiagnostics({ info, tail: [], chrome: "1" }), /undefined/);
    });

    test('getInfo reads the version from the app and the folder from app-paths', () => {
        const info = getInfo({ app: { getVersion: () => '9.9.9' }, appPaths: { getMode: () => 'dev', getDataDir: () => '/d' } });
        assert.deepEqual({ ...info, electron: '' }, { version: '9.9.9', electron: '', mode: 'dev', dataDir: '/d' });
    });
});
