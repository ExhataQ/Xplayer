// Tests for src/js/lyrics/lrc-parser.js (parsing the text of an .lrc file into timed lines).
// Pure logic: runs in Node, no browser needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

// lyrics/lrc-parser.js is an ES module: imported directly, no fake globals.
const parserModule = import(pathToFileURL(path.join(__dirname, '../../src/js/lyrics/lrc-parser.js')).href);

test('a timestamp gives seconds; one, two or three fraction digits and a colon fraction all work', async () => {
    const { parseLrcLine } = await parserModule;
    const times = (line) => parseLrcLine(line).times;
    assert.deepEqual(times('[01:02]hi'), [62]);
    assert.deepEqual(times('[01:02.5]hi'), [62.5]);
    assert.deepEqual(times('[01:02.50]hi'), [62.5]);
    assert.deepEqual(times('[01:02.500]hi'), [62.5]);
    assert.deepEqual(times('[01:02:25]hi'), [62.25]);
    assert.deepEqual(times('[00:00.05]hi'), [0.05]);
    assert.deepEqual(times('[99:59.999]hi'), [99 * 60 + 59.999]);
});

test('a line can carry several timestamps and keeps one text', async () => {
    const { parseLrcLine } = await parserModule;
    assert.deepEqual(parseLrcLine('[00:05.00][01:10.50]chorus'), { times: [5, 70.5], text: 'chorus', instrumental: false });
    assert.equal(parseLrcLine('   [00:02.00]  padded  ').text, 'padded');
});

test('[instrumental] marks an instrumental line with empty text, in any case', async () => {
    const { parseLrcLine } = await parserModule;
    assert.deepEqual(parseLrcLine('[00:10.00][Instrumental]'), { times: [10], text: '', instrumental: true });
    assert.equal(parseLrcLine('[00:10.00] [INSTRUMENTAL] ').instrumental, true);
    assert.equal(parseLrcLine('[00:10.00]instrumental break').instrumental, false);
});

test('tag lines, blank lines and lines without a timestamp are not lyrics', async () => {
    const { parseLrcLine } = await parserModule;
    for (const line of ['', '   ', 'plain words', '[ar:Someone]', '[ti:Title]', '[al:Album]', '[by:me]', '[re:tool]', '[ve:1]', '[length:3:00]', '[offset:100]', '[AR:Upper]']) {
        assert.equal(parseLrcLine(line), null, JSON.stringify(line));
    }
    assert.deepEqual(parseLrcLine('[00:01.00]'), { times: [1], text: '', instrumental: false });
});

test('parseLRC sorts by time, expands multi-timestamp lines and reads any line ending', async () => {
    const { parseLRC } = await parserModule;
    const text = '[ar:A]\r\n[00:03.00]b\r[00:01.00]a\n[00:05.00][00:02.00]c';
    assert.deepEqual(parseLRC(text), [
        { time: 1, text: 'a', instrumental: false },
        { time: 2, text: 'c', instrumental: false },
        { time: 3, text: 'b', instrumental: false },
        { time: 5, text: 'c', instrumental: false }
    ]);
});

test('parseLRC returns null when there is nothing to show', async () => {
    const { parseLRC } = await parserModule;
    for (const input of ['', null, undefined, 'no timestamps here', '[ar:A]\n[ti:T]', '\n\n']) {
        assert.equal(parseLRC(input), null, String(input));
    }
});

test('parseLRC accepts a non-string value and keeps equal times in file order', async () => {
    const { parseLRC } = await parserModule;
    assert.equal(parseLRC(12345), null);
    const same = parseLRC('[00:01.00]first\n[00:01.00]second');
    assert.deepEqual(same.map((e) => e.text), ['first', 'second']);
});
