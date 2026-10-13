// 06f-drag-drop-songs.js and 06g-drag-drop-left-panel.js are ES modules.
// What they do when dragging is covered by drag-drop.test.js (which passes unchanged on both versions). This file
// checks the wiring: manifest placement, and that each file has only its one exported function (no listeners or
// state at load time, so load order cannot matter). That the two names are registered on window for 99-player.js
// is checked in window-contract.test.js.
// Needs: acorn (devDependency). No browser.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const manifest = require('../lib/manifest').readManifest(path.resolve(SRC, '..'));
const FILES = { '06f-drag-drop-songs.js': 'initSongDragToLeftPanel', '06g-drag-drop-left-panel.js': 'initLeftPanelDragAndDrop' };

describe('D-09c: manifest', () => {
    test('both files are modules and no longer classic scripts', () => {
        for (const file of Object.keys(FILES)) {
            assert.ok(manifest.modules.includes(file), `${file} should be in modules`);
        }
    });

    test('they sit between 06e and 06h, in their old order', () => {
        const m = manifest.modules;
        const at = (f) => m.indexOf(f);
        assert.ok(at('06e-tooltip-titles.js') < at('06f-drag-drop-songs.js'));
        assert.ok(at('06f-drag-drop-songs.js') < at('06g-drag-drop-left-panel.js'));
        assert.ok(at('06g-drag-drop-left-panel.js') < at('06h-fullscreen-viewer.js'));
    });
});

describe('D-09c: module shape', () => {
    for (const [file, name] of Object.entries(FILES)) {
        test(`${file} only exports ${name}; nothing runs at load time except the registration`, () => {
            const ast = acorn.parse(fs.readFileSync(path.join(SRC, 'js', file), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
            const kinds = ast.body.map((n) => n.type + (n.declaration ? ':' + n.declaration.type + ':' + n.declaration.id.name : ''));
            assert.deepEqual(kinds, [`ExportNamedDeclaration:FunctionDeclaration:${name}`, 'IfStatement']);
        });
    }
});
