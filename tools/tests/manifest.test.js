'use strict';

// Guards src/manifest.json, the single source of truth for renderer load order.
//
// If one of these fails you almost certainly added, renamed, moved or deleted a file in
// src/js or src/css without updating src/manifest.json (or hand-edited script/link tags
// back into build/music_player.html). Fix the manifest, not the test.
//
// Run: node --test tools/tests/manifest.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'manifest.json'), 'utf8'));

// src/js/99-player.js is the player.js template (song data is injected at build time),
// not a script the page loads directly, so it is deliberately not in the manifest.
const NOT_LISTED = { js: new Set(['99-player.js']), css: new Set() };

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
    for (const [kind, ext] of [['js', '.js'], ['css', '.css']]) {
        const entries = manifest[kind];

        test(`${kind}: is a non-empty list without duplicates`, () => {
            assert.ok(Array.isArray(entries) && entries.length > 0, `"${kind}" must be a non-empty list`);
            const dupes = [...new Set(entries.filter((n, i) => entries.indexOf(n) !== i))];
            assert.deepEqual(dupes, [], `duplicate ${kind} entries`);
        });

        test(`${kind}: entries are plain forward-slash paths relative to src/${kind}/`, () => {
            for (const name of entries) {
                assert.ok(name.endsWith(ext), `${name} should end with ${ext}`);
                assert.ok(!name.includes('\\') && !name.startsWith('/') && !name.startsWith('./') && !name.includes('..'), `${name} must be a relative path with forward slashes`);
            }
        });

        test(`${kind}: every listed file exists`, () => {
            const missing = entries.filter((name) => !fs.existsSync(path.join(ROOT, 'src', kind, ...name.split('/'))));
            assert.deepEqual(missing, [], `listed in src/manifest.json but missing from src/${kind}/`);
        });

        test(`${kind}: every ${ext} file in src/${kind} is listed`, () => {
            const listed = new Set(entries);
            const unlisted = filesOnDisk(kind, ext).filter((f) => !listed.has(f) && !NOT_LISTED[kind].has(f));
            assert.deepEqual(unlisted, [], `in src/${kind}/ but not in src/manifest.json (the page would never load them)`);
        });
    }

    test('99-player.js (the player.js template) is not listed as a script', () => {
        assert.ok(!manifest.js.includes('99-player.js'));
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
        assert.ok(!/<script[^>]*\ssrc="js\//.test(html), 'found a hardcoded <script src="js/..."> - add the file to src/manifest.json instead');
        assert.ok(!/<link[^>]*href="css\//.test(html), 'found a hardcoded <link href="css/..."> - add the file to src/manifest.json instead');
    });
});
