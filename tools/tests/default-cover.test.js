// Tests for the default covers (src/assets/default-cover-*.svg, src/ui-next/adapter/default-cover.js, adapter/default-covers.css).
// Pure Node: the kind -> file map, that every file exists, and that every placeholder SVG the engine draws is tagged so the CSS can repaint it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const MODULE = pathToFileURL(path.join(SRC, 'ui-next', 'adapter', 'default-cover.js')).href;
const KINDS = ['song', 'all-songs', 'favorites', 'playlist', 'folder', 'album', 'artist'];

test('defaultCover: every kind maps to a file that exists; unknown kinds get the song cover', async () => {
    const { defaultCover } = await import(MODULE);
    for (const kind of KINDS) {
        const file = fileURLToPath(defaultCover(kind)); // an absolute URL built from the module's own place, so the page's <base> cannot move it
        assert.ok(fs.existsSync(file), `${kind}: ${file}`);
    }
    assert.equal(defaultCover('song'), pathToFileURL(path.join(SRC, 'assets', 'default-cover.svg')).href, 'a song uses default-cover.svg');
    assert.ok(!fs.existsSync(path.join(SRC, 'assets', 'default-cover-song.svg')), 'default-cover-song.svg is gone');
    assert.equal(defaultCover('favorites'), pathToFileURL(path.join(SRC, 'assets', 'default-cover-liked.svg')).href);
    assert.equal(defaultCover('nothing'), defaultCover('song'));
});

test('default-covers.css paints every cover the engine placeholders can ask for', () => {
    const css = fs.readFileSync(path.join(SRC, 'ui-next', 'adapter', 'default-covers.css'), 'utf8');
    for (const name of ['song', 'all-songs', 'liked', 'playlist', 'folder', 'album', 'artist']) {
        assert.ok(css.includes(`.cover-ph--${name} `) || css.includes(`.cover-ph--${name}{`), name);
        assert.ok(css.includes(name === 'song' ? 'default-cover.svg' : `default-cover-${name}.svg`), name);
    }
});

test('every placeholder SVG in the engine carries a cover-ph--<kind> class', () => {
    const files = [];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.js')) files.push(full);
        }
    })(path.join(SRC, 'js'));
    let found = 0;
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        for (const match of text.matchAll(/<svg class="main-item-cover-svg[^"]*"/g)) {
            found++;
            assert.match(match[0], /cover-ph cover-ph--[a-z-]+/, `${path.relative(SRC, file)}: ${match[0]}`);
        }
    }
    assert.ok(found >= 18, `found ${found} placeholders`);
});

test('the build copies every default cover into <output>/assets, where ui-next reaches them', () => {
    const script = fs.readFileSync(path.resolve(SRC, '..', 'build', 'music_player.py'), 'utf8');
    assert.match(script, /startswith\("default-cover"\)/);
    assert.match(script, /os\.path\.join\(output_dir, "assets"\)/);
});
