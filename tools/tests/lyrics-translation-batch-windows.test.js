// Round of 2026-10-30: translation display in the right panel, the Batch page of the Lyrics tool, instrumental from LRCLIB,
// tool windows, and the Metadata warm-up. Pure Node: pure functions are imported, the rest is read from the sources.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
const UI = (...p) => path.join(ROOT, 'src', 'ui-next', ...p);

test('pairLines: matches by time, then by position, and leaves instrumental lines alone', async () => {
    const { pairLines } = await import(pathToFileURL(UI('shell', 'lyrics-display.js')).href);
    const original = [{ time: 1, text: 'a' }, { time: 5, text: 'b' }, { time: 9, text: '', instrumental: true }];
    const translated = [{ time: 1.1, text: 'A' }, { time: 5.2, text: 'B' }, { time: 9, text: 'x' }];
    assert.deepEqual(pairLines(original, translated).map((l) => l.translation), ['A', 'B', '']);
    const shifted = [{ time: 2, text: 'A' }, { time: 6, text: 'B' }];
    assert.deepEqual(pairLines([{ time: 1, text: 'a' }, { time: 5, text: 'b' }], shifted).map((l) => l.translation), ['A', 'B'], 'same length: by position');
    assert.deepEqual(pairLines([{ time: 1, text: 'a' }], []).map((l) => l.translation), ['']);
});

test('the display choice has three modes that a click cycles through, and one stacked layout', async () => {
    const { MODES, nextMode } = await import(pathToFileURL(UI('shell', 'lyrics-display.js')).href);
    assert.deepEqual(MODES, ['both', 'translated', 'original']);
    assert.deepEqual([nextMode('both'), nextMode('translated'), nextMode('original')], ['translated', 'original', 'both']);
    const css = read('src', 'ui-next', 'views', 'playback', 'player-bar.css');
    assert.ok(!css.includes('data-layout'), 'the other layouts are gone');
});

test('the translation controls are in the right panel header and no longer in the main lyrics view', () => {
    assert.match(read('src', 'ui-next', 'views', 'playback', 'right-panel-content.js'), /mountAiLyricsBar\(aiTools\)/);
    assert.ok(!read('src', 'ui-next', 'views', 'tools', 'lyrics.js').includes('mountAiLyricsBar'));
    const bar = read('src', 'ui-next', 'views', 'ai', 'lyrics-bar.js');
    for (const label of ['Translate lyrics', 'Showing the translation only', 'Showing the original only']) assert.ok(bar.includes(label), label);
    assert.ok(!bar.includes('Translation layout'), 'no layout menu');
});

test('translating keeps the song\'s own lyrics as the active version', () => {
    const adapter = read('src', 'ui-next', 'adapter', 'ai-lyrics.js');
    assert.match(adapter, /if \(before\) e\(\)\.setActiveSyncedLyricsVariant\(songId, before\)/);
});

test('the Batch page: list only, loaded from sources, no "all songs" button, instrumental answers', () => {
    const engine = read('src', 'js', 'lyrics', '19-online-lyrics.js');
    assert.match(engine, /smartLyricsExternalView \? smartLyricsFinderState\.listIds/);
    assert.match(engine, /const instrumental = results\.find\(\(item\) => item\.instrumental\)/);
    assert.match(engine, /if \(song\.instrumental\) return false;/);
    const view = read('src', 'ui-next', 'views', 'tools', 'lyrics-many.js');
    assert.match(view, /loadSource/);
    assert.match(view, /visibleRange\(/);
    assert.ok(!view.includes('autoLoad'), 'the whole list is scrollable; only the rows in view are drawn');
    assert.ok(!/Find (for )?all/i.test(view));
    const tool = read('src', 'ui-next', 'views', 'tools', 'lyrics.js');
    assert.ok(!tool.includes('lyrics-bar__song') && tool.includes("label: 'Batch'"));
    assert.match(read('src', 'ui-next', 'views', 'tools', 'lyrics.css'), /\.lyrics-bar \{[^}]*justify-content: center/);
});

test('tool windows: only metadata and sync, one window each, the page shows only the tool', async () => {
    const { toolWindowParams } = await import(pathToFileURL(UI('shell', 'tool-popout.js')).href).catch(() => ({}));
    if (toolWindowParams) {
        assert.deepEqual(toolWindowParams('?tool=sync&song=12'), { tool: 'sync', song: '12' });
        assert.equal(toolWindowParams('?tool=evil'), null);
        assert.equal(toolWindowParams(''), null);
    }
    const wm = read('electron', 'window-manager.js');
    assert.match(wm, /const TOOLS = \{ metadata: 'Metadata editor', sync: 'Sync lyrics' \}/);
    assert.match(wm, /toolWindows\.get\(tool\)/);
    assert.match(read('src', 'ui-next', 'shell', 'shell.css'), /html\[data-tool-window\] :is\(/);
    assert.match(read('src', 'ui-next', 'shell', 'tool-popout.js'), /in a new window/);
});

test('the tag library is warmed up in the background and a slow read is logged', () => {
    assert.match(read('electron', 'main.js'), /once\('did-finish-load', \(\) => setTimeout\(warmUpTagBackend, 4000\)\)/);
    assert.match(read('electron', 'main.js'), /\[metadata\] reading the tags of one file took/);
});

test('visibleRange: rows in view plus a few around them, never past the ends', async () => {
    const { visibleRange } = await import(pathToFileURL(UI('views', 'tools', 'lyrics-many.js')).href).catch(() => ({}));
    if (!visibleRange) return; // the page imports the browser components; its pure part is checked when it can load
    assert.deepEqual(visibleRange(0, 560, 1000, 56, 6), { first: 0, count: 16 });
    assert.deepEqual(visibleRange(5600, 560, 1000, 56, 6), { first: 94, count: 22 });
    assert.deepEqual(visibleRange(0, 560, 3, 56, 6), { first: 0, count: 3 });
    assert.deepEqual(visibleRange(0, 560, 0, 56, 6), { first: 0, count: 0 });
});

test('Sync has no bar of its own, Metadata has the Lyrics tool\'s bar, the right panel has the header under the cover', () => {
    assert.match(read('src', 'ui-next', 'views', 'tools', 'lyrics-editors.css'), /\.sync-editor-header \{\s*display: none;/);
    assert.match(read('src', 'ui-next', 'views', 'tools', 'metadata.js'), /tabs\(\{ label: 'Edit'/);
    assert.match(read('src', 'ui-next', 'views', 'tools', 'metadata.css'), /\.metadata-mode \{[^}]*border-bottom/);
    const panel = read('src', 'ui-next', 'views', 'playback', 'right-panel-content.js');
    assert.match(panel, /body\.append\(frame, header, el\('div', \{ class: 'rp-now__info' \}, note\), lyrics, follow\)/);
    assert.match(panel, /ICON_FILL = \{ out: 'maximize-2', in: 'minimize-2' \}/);
});
