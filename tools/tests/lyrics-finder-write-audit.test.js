// PC-08 and PC-12 (2026-10-28): the finders' state, the blank album, pasted LRC in the Write editor, and the audit fixes.
// Pure Node: the engine files share one global scope and need a page, so these read the sources.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const read = (...parts) => fs.readFileSync(path.join(SRC, ...parts), 'utf8').replace(/\r\n/g, '\n');
const online = read('js', 'lyrics', '19-online-lyrics.js');
const editor = read('js', 'lyrics', '18-lyrics-editor.js');

test('the Find page starts with a blank album and is named for what it does', () => {
    const open = online.slice(online.indexOf('export function openOnlineLyricsSearchView'));
    assert.match(open, /album: '', \/\/ blank on purpose/);
    assert.doesNotMatch(open.slice(0, open.indexOf('switchView(VIEWS.ONLINE_LYRICS);\n    if (autoSearch)')), /album: song\?\.album/);
    assert.ok(online.includes('<h2>Search lyrics online</h2>'));
    assert.ok(!online.includes('Find lyrics &amp; LRC') && !online.includes('Find multi song'));
});

test('both finders keep their state when the page is opened again', () => {
    assert.match(online, /function smartLyricsFinderHasState\(\)/);
    const smart = online.slice(online.indexOf('export function openSmartLyricsFinder'), online.indexOf('export function getSmartLyricsFinderSongs'));
    assert.match(smart, /if \(!smartLyricsFinderHasState\(\)\) smartLyricsFinderState = createSmartLyricsFinderState\(\);/);
    const single = online.slice(online.indexOf('export function openOnlineLyricsSearchView'));
    assert.match(single, /if \(onlineLyricsFinderHasState\(song\)\) \{\s*switchView\(VIEWS\.ONLINE_LYRICS\);\s*return;/);
});

test('the Write editor saves pasted LRC as synced lyrics from both of its entry points, and says so', () => {
    assert.match(editor, /function saveLyricsEditorText\(songId, text\) \{\s*if \(typeof looksLikeLrc === 'function' && looksLikeLrc\(text\)\) \{\s*setSyncedLyricsForSong/);
    assert.equal((editor.match(/saveLyricsEditorText\(/g) || []).length, 3, 'the function and its two callers');
    assert.equal((editor.match(/watchLyricsEditorPaste\(\);/g) || []).length, 2, 'the hint is wired in both editors');
    assert.equal((editor.match(/lyricsEditorHintHTML\(\)/g) || []).length, 3, 'the function and both editors draw the hint');
});

test('PC-12 fixes: instrumental lines, the search spinner and the artist comma', () => {
    const panel = read('ui-next', 'views', 'playback', 'right-panel-content.js');
    assert.match(panel, /rp-line--instrumental/);
    assert.match(panel, /\\u266A/);
    const find = read('ui-next', 'views', 'tools', 'lyrics-find.css');
    assert.match(find, /\.online-lyrics-spinner \{\s*animation: onlineLyricsSpin/);
    assert.match(find, /@keyframes onlineLyricsSpin/);
    assert.match(read('ui-next', 'views', 'playback', 'player-bar.css'), /#player-artist \.player-artist-sep/);
});
