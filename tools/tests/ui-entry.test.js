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

    test('the new entry is a forward-slash path to a file that exists in src/', () => {
        assert.ok(!NEXT_ENTRY.includes('\\') && !NEXT_ENTRY.startsWith('/'));
        const inSource = path.join(ROOT, 'src', ...NEXT_ENTRY.split('/'));
        assert.ok(fs.existsSync(inSource), `${inSource} is missing`);
    });
});

describe('build', () => {
    const build = fs.readFileSync(path.join(ROOT, 'build', 'music_player.py'), 'utf8');

    test('copies ui-entry.js and the src/ui-next folder into the app', () => {
        assert.match(build, /"ui-entry\.js"/);
        assert.match(build, /"src", "ui-next"/);
        assert.match(build, /copytree\(ui_next_src, ui_next_dst\)/);
    });

    test('window-manager loads the page through resolveUiEntry', () => {
        const src = fs.readFileSync(path.join(ROOT, 'electron', 'window-manager.js'), 'utf8');
        assert.match(src, /require\('\.\/ui-entry'\)/);
        assert.match(src, /resolveUiEntry\(/);
    });
});
