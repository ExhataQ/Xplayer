// Lists keep their place (src/ui-next/scrollbar.css, "Lists keep their place"): the bar's room is always reserved, so a list does not move when its
// thumb comes and goes, and the room is the same on both sides, so a list is centered. Static rules only; the lyrics are measured in a browser in
// ui-next-right-panel-content.test.js.
//
// Run:   node --test tools/tests/ui-next-scroll-gutter.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const UI = path.join(__dirname, '..', '..', 'src', 'ui-next');
const read = (...parts) => fs.readFileSync(path.join(UI, ...parts), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('scrollbar-gutter is set in one place only: scrollbar.css', () => {
    for (const file of walk(UI).filter((f) => f.endsWith('.css'))) {
        if (path.basename(file) === 'scrollbar.css') continue;
        assert.doesNotMatch(strip(fs.readFileSync(file, 'utf8')), /scrollbar-gutter/, `${path.relative(UI, file)} must not set scrollbar-gutter`);
    }
});

test('the centered lists reserve the room on both sides, the full-bleed lists on the bar side, and the cat turns it off', () => {
    const css = strip(read('scrollbar.css'));
    const rule = (needle) => css.split('}').find((block) => block.includes(needle)) || '';
    for (const selector of ['.left-panel-main-list-content', '.plist-results', '.rp-now__lyrics', '.queue-panel__body', "[data-engine='settings'] .content"]) assert.match(rule(selector), /scrollbar-gutter:\s*stable both-edges/, `${selector} is centered`);
    // Settings' scroller is the .content inside the view host. The room reserved on the host itself would push that bar off the wall.
    assert.doesNotMatch(css.replace(/\[data-engine='settings'\] \.content/g, ''), /view-host\[data-view=/, 'no gutter on the view host');
    for (const selector of [":not([data-engine='settings']) .content", '.home', '.song-page']) assert.match(rule(selector), /scrollbar-gutter:\s*stable\s*;/, `${selector} keeps its place`);
    assert.match(css, /\[data-scrollbar-cat='on'\] :is\([^)]*queue-panel__body[^)]*\)\s*{\s*scrollbar-gutter:\s*auto/);
    assert.match(css, /--scroll-gutter:\s*var\(--scrollbar-size\)/);
    assert.match(css, /\[data-scrollbar-cat='on'\]\s*{\s*--scroll-gutter:\s*0px/);
});

test('the padding of the lists is an inset less the bar: what shows is the same on both sides, with any bar', () => {
    const formula = /max\(0px,\s*calc\(var\(--[a-z0-9-]+\)\s*-\s*var\(--scroll-gutter\)\)\)/;
    assert.match(read('views', 'library', 'library-panel.css'), new RegExp(`--panel-list-pad-x:\\s*${formula.source}`));
    const player = read('views', 'playback', 'player-bar.css');
    assert.match(player, new RegExp(`--lyrics-pad-x:\\s*${formula.source}`));
    assert.match(player, new RegExp(`\\.queue-panel__body\\s*{[^}]*padding:[^;]*${formula.source}`));
});
