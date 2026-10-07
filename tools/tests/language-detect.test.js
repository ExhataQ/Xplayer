// Tests for src/js/21-language-detect.js (offline script and stop-word language detection).
// Pure logic: runs in Node, no browser needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

// 21-language-detect.js is an ES module: imported directly, no fake globals.
const detectModule = import(pathToFileURL(path.join(__dirname, '../../src/js/21-language-detect.js')).href);
const language = (result) => result.language;

test('empty or symbol-only text is undetected', async () => {
    const { detectLanguageFromText } = await detectModule;
    for (const text of ['', '   ', null, undefined, '12345 !!! ???']) {
        assert.deepEqual(detectLanguageFromText(text), { language: 'undetected', confidence: 0, source: 'none' }, String(text));
    }
});

test('non-Latin scripts are recognized by their letters alone', async () => {
    const { detectLanguageFromText } = await detectModule;
    const cases = {
        ko: '안녕하세요 사랑해요 너무 좋아',
        ja: 'こんにちは ありがとう さようなら',
        zh: '我爱你 你好吗 谢谢',
        ru: 'привет как дела я тебя люблю',
        ar: 'مرحبا كيف حالك أحبك',
        he: 'שלום מה שלומך אני אוהב אותך',
        el: "γεια σου τι κάνεις σ' αγαπώ",
        th: 'สวัสดีครับ ผมรักคุณ',
        hi: 'मैं तुमसे प्यार करता हूँ'
    };
    for (const [code, text] of Object.entries(cases)) {
        const result = detectLanguageFromText(text);
        assert.equal(result.language, code, text);
        assert.equal(result.source, 'script');
        assert.equal(result.confidence, 1);
    }
});

test('Persian is told apart from Arabic', async () => {
    const { detectLanguageFromText } = await detectModule;
    assert.equal(language(detectLanguageFromText('سلام چطوری دوستت دارم که این را برای تو')), 'fa');
    assert.equal(language(detectLanguageFromText('مرحبا كيف حالك أحبك')), 'ar');
});

test('Latin-script text is decided by stop words, and English wins a close call', async () => {
    const { detectLanguageFromText } = await detectModule;
    const english = detectLanguageFromText('hello world this is the love of you and me');
    assert.equal(english.language, 'en');
    assert.equal(english.source, 'stopwords');
    assert.equal(language(detectLanguageFromText('te quiero mucho y no puedo vivir sin ti en la vida')), 'es');
    assert.equal(language(detectLanguageFromText('a i o y')), 'en', 'short words shared by many languages count for English');
});

test('a Latin language must beat English by a clear margin; a close call goes to English', async () => {
    const { detectLanguageFromText } = await detectModule;
    assert.equal(language(detectLanguageFromText('the and de la que el y en los')), 'en', 'more Spanish than English words, but not by enough');
    assert.equal(language(detectLanguageFromText('we love de la que el y en los las por')), 'es', 'a clear Spanish majority wins');
});

test('a non-Latin script that is too small a part of the text does not decide it', async () => {
    const { detectLanguageFromText } = await detectModule;
    assert.equal(language(detectLanguageFromText('Hello 안녕하세요 안녕하세요 안녕하세요 hello')), 'ko');
    const mostlyEnglish = detectLanguageFromText('the love of you and me and the way that we are in the world 안녕');
    assert.equal(mostlyEnglish.language, 'en');
});

test('only the first 4000 characters are looked at', async () => {
    const { detectLanguageFromText } = await detectModule;
    const text = 'hello the love of you and me '.repeat(200) + '안녕하세요 '.repeat(2000);
    assert.equal(language(detectLanguageFromText(text)), 'en');
});

test('a song flagged instrumental needs no lyrics; other songs use synced, then plain, then song.lyrics', async (t) => {
    const { detectSongLanguage } = await detectModule;
    t.after(() => {
        delete globalThis.getSyncedLyricsForSong;
        delete globalThis.getLyricsForSong;
    });
    assert.deepEqual(detectSongLanguage({ instrumental: true, lyrics: 'hello' }), { language: 'instrumental', confidence: 1, source: 'flag' });
    assert.equal(language(detectSongLanguage(null)), 'undetected');
    assert.equal(language(detectSongLanguage({})), 'undetected');
    assert.equal(language(detectSongLanguage({ lyrics: '안녕하세요 사랑해요' })), 'ko', 'falls back to song.lyrics when the app has no stores');
    globalThis.getLyricsForSong = (song) => song.plainText;
    globalThis.getSyncedLyricsForSong = (song) => song.syncedText;
    assert.equal(language(detectSongLanguage({ plainText: 'hello the love of you and me' })), 'en');
    assert.equal(
        language(detectSongLanguage({ syncedText: '[00:01.00]привет как дела\n[00:02.00]я тебя люблю', plainText: 'hello the love of you' })),
        'ru',
        'synced lyrics come first, and their timestamps are not counted'
    );
});

test('analyzeAllSongsLanguages labels every song, builds the tally and rounds confidence to two digits', async () => {
    const { analyzeAllSongsLanguages } = await detectModule;
    const songs = [
        { id: 1, title: 'A', artist: 'X', lyrics: 'hello world this is the love of you and me' },
        { id: 2, title: 'B', lyrics: '안녕하세요 사랑해요' },
        { id: 3, instrumental: true },
        { id: 4, title: 'D', lyrics: '' }
    ];
    const { rows, tally } = analyzeAllSongsLanguages(songs);
    assert.deepEqual(rows, [
        { id: 1, title: 'A', artist: 'X', language: 'en', confidence: 0.4, source: 'stopwords' },
        { id: 2, title: 'B', artist: '', language: 'ko', confidence: 1, source: 'script' },
        { id: 3, title: '', artist: '', language: 'instrumental', confidence: 1, source: 'flag' },
        { id: 4, title: 'D', artist: '', language: 'undetected', confidence: 0, source: 'none' }
    ]);
    assert.deepEqual(tally, { en: 1, ko: 1, instrumental: 1, undetected: 1 });
    assert.equal(songs[0]._detectedLanguage, 'en');
    assert.equal(songs[1]._detectedLanguageSource, 'script');
});

test('ensureShuffleLanguages only classifies songs that have no language yet and logs the count', async (t) => {
    const { ensureShuffleLanguages } = await detectModule;
    const logged = [];
    t.mock.method(console, 'log', (...args) => logged.push(args.join(' ')));
    const songs = [{ id: 1, lyrics: '안녕하세요 사랑해요' }, { id: 2, _detectedLanguage: 'fr', lyrics: 'hello the love of you and me' }, null];
    ensureShuffleLanguages(songs);
    assert.equal(songs[0]._detectedLanguage, 'ko');
    assert.equal(songs[1]._detectedLanguage, 'fr', 'an existing label is kept');
    assert.deepEqual(logged, ['[smart-shuffle] classified 1 song']);
    logged.length = 0;
    ensureShuffleLanguages(songs);
    ensureShuffleLanguages([]);
    ensureShuffleLanguages('not a list');
    assert.deepEqual(logged, [], 'nothing new to classify, nothing logged');
});

test('importing the module in Node does not need a window', async () => {
    assert.equal(typeof globalThis.window, 'undefined');
    const { ensureShuffleLanguages } = await detectModule;
    assert.equal(typeof ensureShuffleLanguages, 'function');
});
