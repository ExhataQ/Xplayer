// "Find lyrics online" (right panel header): findLyricsForSong in the engine, and the wiring of the button. The engine function is taken out of
// the source file and run with stubs, so no page and no network are needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
const engine = read('src', 'js', 'lyrics', '19-online-lyrics.js');

function extract(name, async = false) {
    const start = engine.indexOf(`export ${async ? 'async ' : ''}function ${name}(`);
    assert.ok(start >= 0, `${name} is in 19-online-lyrics.js`);
    const end = engine.indexOf('\n}\n', start);
    return engine.slice(start, end + 3).replace(/^export /, '');
}

const LRC = '[00:01.00]one\n[00:05.00]two';
const code = ['parseSongDurationSeconds', 'getOnlineLyricsText'].map((n) => extract(n)).join('\n') + '\n' + extract('findLyricsForSong', true);

// answers: what the search returns for the song; options: { synced: text the song already has, songs }
function makeRun(answer, { synced = '', songs } = {}) {
    const log = { searches: [], applied: [], instrumental: [], emitted: [] };
    const context = {
        SONGS_DATA: songs || [{ id: 7, title: 'Hello', artist: 'Adele', album: '25', duration: '4:55' }],
        desktopApi: {
            lyrics: {
                searchOnlineLyrics: async (params) => {
                    log.searches.push(JSON.parse(JSON.stringify(params))); // plain objects of this realm, so deepEqual can compare them
                    if (answer instanceof Error) throw answer;
                    return typeof answer === 'function' ? answer(params) : answer;
                }
            }
        },
        getSyncedLyricsForSong: () => synced,
        markSongInstrumental: (id) => log.instrumental.push(id),
        applyOnlineLyricsToSong: (id, text, type, instrumental) => {
            log.applied.push({ id, text, type, instrumental });
            return true;
        },
        emit: (...args) => log.emitted.push(args)
    };
    vm.createContext(context);
    vm.runInContext(code + '\nthis.findLyricsForSong = findLyricsForSong;', context);
    return { log, find: async (id = 7) => JSON.parse(JSON.stringify(await context.findLyricsForSong(id))) };
}
const hit = (extra) => ({ id: 1, trackName: 'Hello', artistName: 'Adele', duration: 295, syncedLyrics: LRC, plainLyrics: 'one two', ...extra });

test('synced lyrics are found and saved as LRC, and the search is asked with the song as the library has it', async () => {
    const run = makeRun({ success: true, results: [hit()] });
    assert.deepEqual(await run.find(), { status: 'saved', type: 'lrc' });
    assert.deepEqual(run.log.applied, [{ id: 7, text: LRC, type: 'lrc', instrumental: false }]);
    assert.deepEqual(run.log.searches, [{ artist: 'Adele', title: 'Hello', album: '25', duration: 295 }]);
});

test('it never emits lyrics:changed (the engine answers that by redrawing its own Lyrics page, wrong on any other page)', async () => {
    const run = makeRun({ success: true, results: [hit()] });
    await run.find();
    assert.deepEqual(run.log.emitted, []);
});

test('of several synced answers the one within 3 seconds of the song wins; with none close, the first is used', async () => {
    const off = hit({ id: 2, duration: 310, syncedLyrics: '[00:01.00]long version' });
    const close = hit({ id: 3, duration: 296, syncedLyrics: '[00:01.00]right one' });
    let run = makeRun({ success: true, results: [off, close] });
    await run.find();
    assert.equal(run.log.applied[0].text, '[00:01.00]right one');
    run = makeRun({ success: true, results: [off, hit({ id: 4, duration: 400, syncedLyrics: '[00:01.00]other' })] });
    await run.find();
    assert.equal(run.log.applied[0].text, '[00:01.00]long version');
});

test('only plain text online: it is saved as plain lyrics, unless the song already has synced lyrics', async () => {
    const plainOnly = { success: true, results: [hit({ syncedLyrics: null })] };
    let run = makeRun(plainOnly);
    assert.deepEqual(await run.find(), { status: 'saved', type: 'lyrics' });
    assert.deepEqual(run.log.applied, [{ id: 7, text: 'one two', type: 'lyrics', instrumental: false }]);
    run = makeRun(plainOnly, { synced: LRC });
    assert.deepEqual(await run.find(), { status: 'kept', type: 'lyrics' });
    assert.deepEqual(run.log.applied, [], 'synced lyrics are never replaced by plain text');
});

test('synced lyrics found for a song that has synced lyrics replace them (the button asks the person first)', async () => {
    const run = makeRun({ success: true, results: [hit()] }, { synced: '[00:00.00]old' });
    assert.equal((await run.find()).status, 'saved');
});

test('nothing found: status none and nothing is saved; an empty answer is not an error', async () => {
    for (const answer of [{ success: true, results: [] }, { success: true }, { success: true, results: [hit({ syncedLyrics: '', plainLyrics: ' ' })] }]) {
        const run = makeRun(answer);
        assert.deepEqual(await run.find(), { status: 'none' });
        assert.deepEqual(run.log.applied, []);
    }
});

test('LRCLIB says the song is instrumental: the song is marked, nothing is saved', async () => {
    const run = makeRun({ success: true, results: [hit({ syncedLyrics: '', plainLyrics: '', instrumental: true })] });
    assert.deepEqual(await run.find(), { status: 'instrumental' });
    assert.deepEqual(run.log.instrumental, [7]);
    assert.deepEqual(run.log.applied, []);
});

test('a failed search is an error with its reason, whether it throws or answers success:false', async () => {
    let run = makeRun(new Error('getaddrinfo ENOTFOUND lrclib.net'));
    assert.deepEqual(await run.find(), { status: 'error', error: 'getaddrinfo ENOTFOUND lrclib.net' });
    run = makeRun({ success: false, error: 'LRCLIB returned HTTP 503' });
    assert.deepEqual(await run.find(), { status: 'error', error: 'LRCLIB returned HTTP 503' });
    run = makeRun(null);
    assert.equal((await run.find()).status, 'error');
});

test('a song that is not in the library is an error, and asking again searches again (no cache)', async () => {
    const run = makeRun({ success: true, results: [] });
    assert.equal((await run.find(99)).status, 'error');
    assert.equal(run.log.searches.length, 0);
    await run.find();
    await run.find();
    assert.equal(run.log.searches.length, 2);
});

test('the engine registers findLyricsForSong, so the right panel can call it by name', () => {
    const block = engine.slice(engine.indexOf('registerLegacyGlobals({'));
    assert.match(block, /\n {8}findLyricsForSong,/);
});

test('the right panel header has the button with the lyrics buttons (not beside the size buttons), off with nothing playing or with synced lyrics, with its own icon', () => {
    const panel = read('src', 'ui-next', 'views', 'playback', 'right-panel-content.js');
    assert.match(panel, /iconButton\(\{ icon: 'text-search', label: 'Find lyrics online'/);
    assert.match(panel, /rp-now__lyric-tools' \}, aiTools, find\)/);
    assert.match(panel, /rp-now__tools' \}, lyricTools, fill, lyricsOnly\)/);
    assert.match(panel, /find\.disabled = !song \|\| hasLrc/);
    assert.match(panel, /hasLrc = Boolean\(song && song\.synced && song\.synced\.length\)/);
    assert.match(read('src', 'ui-next', 'icons', 'custom-icons.js'), /"text-search":/);
});

test('the button never replaces synced lyrics, shows a busy state, redraws the panel itself, and tells every outcome that is not a save', () => {
    const panel = read('src', 'ui-next', 'views', 'playback', 'right-panel-content.js');
    assert.match(panel, /if \(song\.hasSynced\) return;/);
    assert.doesNotMatch(panel, /engineConfirm/);
    assert.match(panel, /setLoading\(button, true\)[\s\S]*setLoading\(button, false\)/);
    assert.match(panel, /status === 'saved' \|\| status === 'instrumental'\) redraw\(\)/);
    for (const title of ['No lyrics found', 'Marked as instrumental', 'Synced lyrics kept', 'Could not search for lyrics']) assert.ok(panel.includes(`title: '${title}'`), title);
});
