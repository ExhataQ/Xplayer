// Static checks for the AI screens (tasks PE-09, PE-10): the stylesheet uses tokens only, index.html links it, the views never reach
// into the page or the engine themselves (everything goes through adapter/ai-bridge.js), nothing is kept in browser storage, and the
// bridge stays inside the adapter budget approved for this plan (300 code lines in new adapter files, decision DP9). Pure Node.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const NEXT = path.resolve(__dirname, '..', '..', 'src', 'ui-next');
const read = (...p) => fs.readFileSync(path.join(NEXT, ...p), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const viewFiles = fs.readdirSync(path.join(NEXT, 'views', 'ai')).filter((f) => f.endsWith('.js'));

test('ai.css: every var() is a token, no raw colors, no --c-*', () => {
    const css = strip(read('views', 'ai', 'ai.css'));
    const defined = new Set([...read('tokens.css').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const missing = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n));
    assert.deepEqual([...new Set(missing)], []);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    assert.doesNotMatch(css, /--c-[a-z]/);
});

test('index.html links ai.css after metadata.css', () => {
    const html = read('index.html');
    assert.ok(html.indexOf('href="views/ai/ai.css"') > html.indexOf('href="views/tools/metadata.css"') && html.includes('views/ai/ai.css'));
});

test('views/ai never touches window, document, storage or engine globals; the engine is reached through adapter/ai-bridge.js', () => {
    assert.ok(viewFiles.length >= 8, viewFiles.join());
    for (const file of viewFiles) {
        const source = strip(read('views', 'ai', file).replace(/(^|\s)\/\/.*$/gm, '$1'));
        assert.doesNotMatch(source, /\bwindow\b|\bdocument\b|localStorage|sessionStorage|getElementById/, `${file} reaches into the page`);
        for (const match of source.matchAll(/from\s+'([^']+)'/g)) assert.doesNotMatch(match[1], /(?:^|\/)js(?:\/|$)/, `${file} imports engine module ${match[1]}`);
    }
});

test('the AI key and on/off state are never written by the page', () => {
    for (const file of viewFiles) assert.doesNotMatch(read('views', 'ai', file), /localStorage|sessionStorage|indexedDB|document\.cookie/);
});

// DP14 (2026-10-30): the owner allowed the growth (the assistant reads the queue, playlists and folders; the chat can run in a window of
// its own). The approved total is now 320.
test('the new adapter files (ai-bridge.js and ai-lyrics.js) stay within the 320 code lines approved together (DP9, DP14)', () => {
    const count = (file) => read('adapter', file).split(/\r?\n/).filter((line) => line.trim() && !/^\s*(?:\/\/|\/\*|\*|\*\/)/.test(line)).length;
    const total = count('ai-bridge.js') + count('ai-lyrics.js');
    assert.ok(total <= 320, `the AI adapter files use ${total} code lines (maximum 320)`);
});

test('the ready-made messages row has no scroll bar, so it moves with the wheel and by dragging (and a drag is not a click)', () => {
    const row = read('views', 'ai', 'sideways-scroll.js');
    assert.match(row, /addEventListener\(\s*'wheel'/);
    assert.match(row, /passive: false/, 'the wheel handler must be able to stop the vertical scroll');
    assert.match(row, /pointerdown/);
    assert.match(row, /setPointerCapture/);
    assert.match(row, /if \(!dragged\) return;[\s\S]*stopPropagation/, 'the click after a drag is swallowed');
    assert.match(read('views', 'ai', 'ai-chat.js'), /sidewaysScroll\(strip\.row, \{ wheel: false \}\)/, 'the chip strip around the row does the wheel, so the drag helper must not do it twice');
    assert.match(read('views', 'ai', 'ai-chat.js'), /chipStrip\(prompts,/, 'the arrows are the left panel\'s chip strip, not a second copy');
});
