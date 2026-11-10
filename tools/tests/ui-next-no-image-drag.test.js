// Polish A8: pictures (covers) are never dragged by the browser; the new screen's base.css switches it off for every img and svg.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'base.css'), 'utf8');

test('base.css turns off the browser drag for every img and svg', () => {
    assert.match(css, /(^|\n)img,\s*svg\s*\{[^}]*-webkit-user-drag:\s*none/);
});
