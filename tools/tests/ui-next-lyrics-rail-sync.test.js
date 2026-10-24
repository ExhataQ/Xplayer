// Lyrics in the rail opens the Sync tool (task PC-07, brief 4.1). The wiring is checked here without a browser; the behavior is
// tested in ui-next-lyrics.test.js. Run: node --test tools/tests/ui-next-lyrics-rail-sync.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'ui-next', ...p), 'utf8');

test('a rail or menu choice tells the view it was chosen; the engine opening its own page does not', () => {
    const shell = read('shell', 'shell.js');
    assert.match(shell, /const engineViewShown = showView\(id, \{ chosen: true \}\)/);
    assert.match(shell, /showView\('lyrics', \{ fromEngine: true \}\)/, 'the engine opening an editor never asks for Sync');
    assert.doesNotMatch(shell, /showView\('lyrics'\)\s*;?\s*\n[^\n]*chosen/);
});

test('the Lyrics page opens Sync only for a chosen visit, with a song playing and no editor already open', () => {
    const js = read('views', 'tools', 'lyrics.js');
    assert.match(js, /export function mountLyricsModes\(host, options = \{\}\)/);
    assert.match(js, /if \(options\.chosen && nowPlaying\(\) && !lyricsEditors\(\)\.sync && !lyricsEditors\(\)\.write\) go\('sync'\);/);
});

test('the rail tooltip describes what the item now does', () => {
    assert.match(read('shell', 'shell.js'), /id: 'lyrics', label: 'Lyrics', icon: 'waveform', note: 'Make or edit synced lyrics \(LRC\) for the song that is playing\.'/);
});
