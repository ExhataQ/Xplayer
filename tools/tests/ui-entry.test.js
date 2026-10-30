'use strict';

// Which page the main window loads (electron/ui-entry.js) and that the build ships the new interface folder.
//
// Run: node --test tools/tests/ui-entry.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const { resolveUiEntry, CURRENT_ENTRY, NEXT_ENTRY } = require(path.join(ROOT, 'electron', 'ui-entry.js'));

describe('resolveUiEntry', () => {
    test('loads the current interface by default', () => {
        assert.equal(resolveUiEntry({ argv: ['electron.exe', '.'], env: {} }), 'music_player.html');
        assert.equal(resolveUiEntry(), CURRENT_ENTRY);
    });

    test('loads the new interface with --ui=next', () => {
        assert.equal(resolveUiEntry({ argv: ['electron.exe', '.', '--ui=next'], env: {} }), 'ui-next/index.html');
    });

    test('loads the new interface with XPLAYER_UI=next', () => {
        assert.equal(resolveUiEntry({ argv: [], env: { XPLAYER_UI: 'next' } }), NEXT_ENTRY);
    });

    test('ignores other values', () => {
        assert.equal(resolveUiEntry({ argv: ['--ui=old', '--ui'], env: { XPLAYER_UI: 'current' } }), CURRENT_ENTRY);
    });

    test('--ui=current forces the current interface over a saved choice', () => {
        assert.equal(resolveUiEntry({ argv: ['--ui=current'], env: {}, saved: 'next' }), CURRENT_ENTRY);
        assert.equal(resolveUiEntry({ argv: [], env: { XPLAYER_UI: 'current' }, saved: 'next' }), CURRENT_ENTRY);
    });

    test('a saved choice decides when no flag is given, and a flag beats it', () => {
        assert.equal(resolveUiEntry({ argv: [], env: {}, saved: 'next' }), NEXT_ENTRY);
        assert.equal(resolveUiEntry({ argv: [], env: {}, saved: 'current' }), CURRENT_ENTRY);
        assert.equal(resolveUiEntry({ argv: ['--ui=next'], env: {}, saved: 'current' }), NEXT_ENTRY);
        assert.equal(resolveUiEntry({ argv: [], env: {}, saved: 'nonsense' }), CURRENT_ENTRY);
    });

    test('the new entry is a forward-slash path to a file that exists in src/', () => {
        assert.ok(!NEXT_ENTRY.includes('\\') && !NEXT_ENTRY.startsWith('/'));
        const inSource = path.join(ROOT, 'src', ...NEXT_ENTRY.split('/'));
        assert.ok(fs.existsSync(inSource), `${inSource} is missing`);
    });
});

describe('saved choice', () => {
    test('is written to the settings folder, read back, and rejects unknown values', () => {
        const os = require('os');
        const storage = require(path.join(ROOT, 'electron', 'storage-paths.js'));
        const entry = require(path.join(ROOT, 'electron', 'ui-entry.js'));
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-choice-'));
        storage.setConfigDir(dir, dir);
        try {
            assert.equal(entry.readSavedChoice(), undefined);
            assert.equal(entry.writeSavedChoice('next'), true);
            assert.equal(entry.readSavedChoice(), 'next');
            assert.equal(entry.writeSavedChoice('purple'), false);
            assert.equal(entry.readSavedChoice(), 'next');
            fs.writeFileSync(path.join(dir, 'ui-choice.json'), '{broken');
            assert.equal(entry.readSavedChoice(), undefined);
        } finally {
            storage.setConfigDir(null);
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('build', () => {
    const build = fs.readFileSync(path.join(ROOT, 'build', 'music_player.py'), 'utf8');

    test('copies ui-entry.js and the src/ui-next folder into the app', () => {
        // Every .js file in electron/ is copied (os.listdir + endswith), so ui-entry.js only has to exist there.
        assert.match(build, /os\.listdir\(electron_dir\)/);
        assert.match(build, /name\.endswith\("\.js"\)/);
        assert.ok(fs.existsSync(path.join(ROOT, 'electron', 'ui-entry.js')));
        assert.match(build, /"src", "ui-next"/);
        assert.match(build, /copytree\(ui_next_src, ui_next_dst\)/);
    });

    test('window-manager loads the page through the active choice and can switch it', () => {
        const src = fs.readFileSync(path.join(ROOT, 'electron', 'window-manager.js'), 'utf8');
        assert.match(src, /require\('\.\/ui-entry'\)/);
        assert.match(src, /activeEntry\(\)/);
        assert.match(src, /switchUi/);
    });
});

describe('the in-app switch is wired end to end', () => {
    const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

    test('main, preload and the desktop API agree on the two calls', () => {
        assert.match(read('electron', 'main.js'), /handle\('get-ui-choice'/);
        assert.match(read('electron', 'main.js'), /handle\('set-ui-choice'/);
        assert.match(read('electron', 'preload.js'), /invoke\('set-ui-choice'/);
        assert.match(read('src', 'js', 'api', 'desktop-api.js'), /setUiChoice: 'invoke'/);
    });

    test('the current Settings page and the new one both offer the switch', () => {
        assert.match(read('src', 'js', 'ui', '08e-panel-settings.js'), /data-action="switchInterface"/);
        assert.match(read('src', 'ui-next', 'shell', 'appearance-settings.js'), /setUiChoice\('current'\)/);
    });
});
