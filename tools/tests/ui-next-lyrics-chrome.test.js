// Owner round 2026-10-28: no lyrics button in the player, a header in the right panel's lyrics, the right panel icon without the accent,
// and the Lyrics tool with Find, Many songs, Write and Sync only. Pure Node: reads the sources. The look needs a real browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UI = path.resolve(__dirname, '..', '..', 'src', 'ui-next');
const read = (...parts) => fs.readFileSync(path.join(UI, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the player lyrics button is hidden and has no tooltip entry; the queue button still has its anchor', () => {
    assert.match(read('shell', 'shell.css'), /\.player-host \.lyrics-toggle-btn \{\s*display: none;/);
    assert.ok(!/\['lyrics', \(\) =>/.test(read('views', 'playback', 'transport.js')));
    assert.match(read('views', 'playback', 'queue-panel.js'), /playerPart\('lyrics'\)/);
});

test('the right panel lyrics has a header with the two buttons, fill the app first, and no floating box', () => {
    const js = read('views', 'playback', 'right-panel-content.js');
    assert.match(js, /rp-now__header[\s\S]*?rp-now__tools' \}, aiTools, fill, lyricsOnly\)/);
    assert.ok(!js.includes('rp-now__box'));
    // standard icons: two diagonal arrows for fill the app, two vertical arrows for lyrics only
    assert.match(js, /ICON_FILL = \{ out: 'maximize-2', in: 'minimize-2' \}/);
    assert.match(js, /ICON_ONLY = \{ out: 'unfold-vertical', in: 'fold-vertical' \}/);
    assert.match(js, /icon: ICON_FILL\.out[\s\S]*?icon: ICON_ONLY\.out/);
    const css = read('shell', 'shell.css');
    assert.ok(!/position: absolute;[^}]*\n\}\n\.rp-now__box/.test(css) && !css.includes('.rp-now__box'));
});

test('the two lyrics icons (one of the choices in Settings) are the same lyrics lines with arrows out and in; the right panel icon has a filled right window', async () => {
    const { icon } = await import(require('node:url').pathToFileURL(path.join(UI, 'icons', 'icons.js')).href);
    const out = icon('lyrics-expand');
    const inn = icon('lyrics-shrink');
    assert.notEqual(out, inn);
    for (const svg of [out, inn]) {
        assert.ok(svg.includes('M8 9.5h8'), 'the lyrics lines');
        assert.equal((svg.match(/<path d="[^"]*[hv]-?\d+[hv]?[^"]*"\/>/g) || []).length >= 3, true);
    }
    assert.match(icon('panel-right-filled'), /fill="currentColor"/);
    assert.ok(!icon('panel-right').includes('fill="currentColor"'));
});

test('the right panel button shows the filled icon while open and keeps the text color, not the accent', () => {
    assert.match(read('shell', 'right-panel.js'), /show \? 'panel-right-filled' : 'panel-right'/);
    assert.match(read('shell', 'shell.css'), /\.icon-btn\.right-panel-btn\[aria-pressed='true'\] \{\s*color: var\(--text-primary\)/);
});

test('the Lyrics tool has Find, Batch, Write and Sync, and no View', () => {
    const js = read('views', 'tools', 'lyrics.js');
    const items = js.match(/items: \[(\{ id: 'find'[^\]]*)\]/);
    assert.ok(items, 'the tab list');
    assert.deepEqual([...items[1].matchAll(/label: '([^']+)'/g)].map((m) => m[1]), ['Find', 'Batch', 'Write', 'Sync']);
    assert.ok(!js.includes("id: 'view'") && !js.includes('view: () =>'));
});
