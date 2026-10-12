'use strict';

// Guards the renderer's load order: src/manifest.json (stylesheets and the one script entry) and src/js/main.js
// (the entry; its imports are every renderer file, in load order).
//
// If one of these fails you almost certainly added, renamed, moved or deleted a file in
// src/js or src/css without updating main.js or src/manifest.json (or hand-edited script/link tags
// back into build/music_player.html). Fix the manifest or main.js, not the test.
//
// Run: node --test tools/tests/manifest.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'manifest.json'), 'utf8'));
const manifest = require('../lib/manifest').readManifest(ROOT);
const entrySource = fs.readFileSync(path.join(ROOT, 'src', 'js', manifest.entry), 'utf8');

// src/js/99-player.js is the player.js template (build data is injected at build time): the only classic
// script, loaded by a tag in the page template, not imported. main.js is the entry itself.
const NOT_IMPORTED = new Set(['99-player.js', manifest.entry]);

function filesOnDisk(kind, ext, sub = '') {
    const dir = path.join(ROOT, 'src', kind, sub);
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = sub ? `${sub}/${entry.name}` : entry.name;
        if (entry.isDirectory()) found.push(...filesOnDisk(kind, ext, rel));
        else if (entry.name.endsWith(ext)) found.push(rel);
    }
    return found;
}

describe('src/manifest.json', () => {
    test('names the stylesheets and one script entry, and keeps no second list of scripts', () => {
        assert.deepEqual(Object.keys(raw).sort(), ['css', 'entry']);
        assert.equal(raw.entry, 'main.js');
    });

    test('css: is a non-empty list without duplicates', () => {
        assert.ok(Array.isArray(raw.css) && raw.css.length > 0, '"css" must be a non-empty list');
        const dupes = [...new Set(raw.css.filter((n, i) => raw.css.indexOf(n) !== i))];
        assert.deepEqual(dupes, [], 'duplicate css entries');
    });

    test('css: entries are plain forward-slash paths relative to src/css/, they exist, and every css file is listed', () => {
        for (const name of raw.css) {
            assert.ok(name.endsWith('.css'), `${name} should end with .css`);
            assert.ok(!name.includes('\\') && !name.startsWith('/') && !name.startsWith('./') && !name.includes('..'), `${name} must be a relative path with forward slashes`);
        }
        const missing = raw.css.filter((name) => !fs.existsSync(path.join(ROOT, 'src', 'css', ...name.split('/'))));
        assert.deepEqual(missing, [], 'listed in src/manifest.json but missing from src/css/');
        const listed = new Set(raw.css);
        assert.deepEqual(filesOnDisk('css', '.css').filter((f) => !listed.has(f)), [], 'in src/css/ but not in src/manifest.json');
    });
});

describe('src/js/main.js (the module entry)', () => {
    const imports = manifest.modules;

    test('is only comments and import lines, so the order of the imports is the load order', () => {
        const other = entrySource
            .split(/\r?\n/)
            .filter((line) => line.trim() && !line.trim().startsWith('//') && !/^import\s+'\.\/[^']+';$/.test(line.trim()));
        assert.deepEqual(other, []);
    });

    test('imports each file once, as a plain forward-slash path, and every file exists', () => {
        assert.ok(imports.length > 100);
        const dupes = [...new Set(imports.filter((n, i) => imports.indexOf(n) !== i))];
        assert.deepEqual(dupes, [], 'duplicate imports');
        for (const name of imports) {
            assert.ok(name.endsWith('.js'), `${name} should end with .js`);
            assert.ok(!name.includes('\\') && !name.startsWith('/') && !name.includes('..'), `${name} must be a relative path with forward slashes`);
        }
        const missing = imports.filter((name) => !fs.existsSync(path.join(ROOT, 'src', 'js', ...name.split('/'))));
        assert.deepEqual(missing, [], 'imported by main.js but missing from src/js/');
    });

    test('every .js file in src/js is imported (the page would never load it otherwise)', () => {
        const listed = new Set(imports);
        const unlisted = filesOnDisk('js', '.js').filter((f) => !listed.has(f) && !NOT_IMPORTED.has(f));
        assert.deepEqual(unlisted, [], 'in src/js/ but not imported by src/js/main.js');
    });

    test('every imported file is a module with an export', () => {
        for (const name of imports) {
            const source = fs.readFileSync(path.join(ROOT, 'src', 'js', ...name.split('/')), 'utf8');
            assert.ok(/^export\s/m.test(source), `${name} is imported by main.js but has no export`);
        }
    });

    test('core/legacy.js is first: every other file registers its names with it while it loads', () => {
        assert.equal(imports[0], 'core/legacy.js');
    });
});

describe('99-player.js (the player.js build-data template)', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'js', '99-player.js'), 'utf8');

    test('is not imported by main.js', () => {
        assert.ok(!manifest.modules.includes('99-player.js'));
    });

    test('is a classic script that only stores the two build placeholders for core/build-data.js', () => {
        assert.ok(!/^\s*(import|export)\s/m.test(source), 'a classic script cannot use import or export');
        assert.equal(source.split('{{SONGS_DATA}}').length - 1, 1);
        assert.equal(source.split('{{PLACEHOLDER_IMAGE}}').length - 1, 1);
        const code = source.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('//'));
        assert.ok(code.every((line) => !/\b(document|desktopApi|electronAPI|localStorage)\b/.test(line)), 'it must not use anything from another file or the page');
    });
});

describe('build/music_player.html template', () => {
    const html = fs.readFileSync(path.join(ROOT, 'build', 'music_player.html'), 'utf8');

    test('has each manifest placeholder exactly once', () => {
        for (const placeholder of ['{{CSS_LINKS}}', '{{JS_SCRIPTS}}']) {
            assert.equal(html.split(placeholder).length - 1, 1, `${placeholder} must appear exactly once`);
        }
    });

    test('has no hand-written renderer script/stylesheet tags (they come from the manifest)', () => {
        assert.ok(!/<script[^>]*\ssrc="js\//.test(html), 'found a hardcoded <script src="js/..."> - import the file in src/js/main.js instead');
        assert.ok(!/<link[^>]*href="css\//.test(html), 'found a hardcoded <link href="css/..."> - add the file to src/manifest.json instead');
    });

    test('the rendered page has the player.js tag and exactly one other script: the module entry', () => {
        const { renderTemplate } = require('./helpers/render-template');
        const page = renderTemplate(html, ROOT);
        const tags = [...page.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => m[0]);
        const moduleTags = tags.filter((t) => /type="module"/.test(t));
        assert.equal(moduleTags.length, 1);
        assert.match(moduleTags[0], /src="js\/main\.js"/);
        assert.ok(tags.filter((t) => !/type="module"/.test(t)).every((t) => /src="player\.js"/.test(t)), 'the only classic script is player.js');
    });
});
