// Gapless playback, the early start (task: gapless): the next track is started a little before the current one ends, so play()'s start-up time
// falls inside the old track instead of after it. The timing maths is pure and the scheduler is driven here with fake elements and fake timers.
// No browser: whether the join is truly silent-free needs ears, or the two-tone test file, in a real player.
//
// Run:   node --test tools/tests/gapless-lead.test.js

const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const load = (...p) => import(pathToFileURL(path.join(ROOT, ...p)).href);

// The module registers its functions with the app's registries when it loads; here there is no app, so those two calls go nowhere.
globalThis.registerActions = () => {};
globalThis.registerLegacyGlobals = () => {};
// The real assignAudioSource (15h-equalizer.js) reads the saved equalizer settings; with nothing saved it plays the plain url.
globalThis.storageReadJson = (key, fallback) => fallback;
globalThis.storageWriteJson = () => {};
globalThis.STORAGE_KEYS = { EQUALIZER_SETTINGS: 'equalizer' };

describe('gapless timing maths', () => {
    test('the wait is the time left minus the lead, scaled by the playback rate', async () => {
        const q = await load('src', 'js', 'playback', '10c-playback-queue.js');
        assert.equal(q.gaplessWaitMs(10, 1, 31), 9969);
        assert.equal(q.gaplessWaitMs(10, 2, 31), 4969);
        assert.equal(q.gaplessWaitMs(0.02, 1, 31) < 0, true, 'already inside the lead: start now');
        assert.equal(q.gaplessWaitMs(10, 0, 31), 9969, 'a bad rate counts as 1');
    });

    test('the lead is the median of the recent measurements, nonsense is ignored, and it stays in range', async () => {
        const q = await load('src', 'js', 'playback', '10c-playback-queue.js');
        assert.equal(q.gaplessLeadFromSamples([21]), 21, 'the first measurement is used as it is');
        assert.equal(q.gaplessLeadFromSamples([70, 21, 20]), 21, 'one slow start does not move it');
        assert.equal(q.gaplessLeadFromSamples([70, 21]), 45.5);
        assert.equal(q.gaplessLeadFromSamples([0, 5000, NaN, 30]), 30);
        assert.equal(q.gaplessLeadFromSamples([]), null);
        assert.equal(q.gaplessLeadFromSamples(undefined), null);
        assert.equal(q.gaplessLeadFromSamples([6]), 8);
        assert.equal(q.gaplessLeadFromSamples([500, 590, 600]), 300);
    });
});

describe('gapless per format', () => {
    test('the format comes from the end of the url, ignoring case and a query', async () => {
        const q = await load('src', 'js', 'playback', '10c-playback-queue.js');
        assert.equal(q.gaplessFormatOf({ url: 'file:///C:/Music/a b.FLAC' }), 'flac');
        assert.equal(q.gaplessFormatOf({ url: 'file:///x/y.mp3?v=2' }), 'mp3');
        assert.equal(q.gaplessFormatOf({ url: 'file:///x/noext' }), '');
        assert.equal(q.gaplessFormatOf(null), '');
    });
});

describe('silent edges of a track', () => {
    const RATE = 10000; // 10 frames per ms

    test('measures the silence at both ends of a track', async () => {
        const e = await load('src', 'js', 'playback', '10e-gapless-edges.js');
        const track = new Float32Array(1050);
        for (let i = 250; i < 750; i++) track[i] = 0.5;
        const edges = e.silenceAtEdges([track], RATE);
        assert.equal(edges.headMs, 25);
        assert.equal(edges.tailMs, 30);
        assert.equal(edges.measured, true);
    });

    test('a sound in any channel ends the silence, and a very quiet sample does not', async () => {
        const e = await load('src', 'js', 'playback', '10e-gapless-edges.js');
        const left = new Float32Array(1000);
        const right = new Float32Array(1000);
        left[300] = 0.0005; // under the level: still silence
        right[50] = 0.2;
        left[900] = 0.2;
        const edges = e.silenceAtEdges([left, right], RATE);
        assert.equal(edges.headMs, 5);
        assert.equal(edges.tailMs, 9.9);
    });

    test('never counts more than the cap, so a silence put there on purpose stays', async () => {
        const e = await load('src', 'js', 'playback', '10e-gapless-edges.js');
        const track = new Float32Array(5000);
        for (let i = 2000; i < 3000; i++) track[i] = 0.5;
        const edges = e.silenceAtEdges([track], RATE);
        assert.equal(edges.headMs, e.EDGE_MAX_MS);
        assert.equal(edges.tailMs, e.EDGE_MAX_MS);
    });

    test('a track that is silent all the way, or empty, says nothing about its edges', async () => {
        const e = await load('src', 'js', 'playback', '10e-gapless-edges.js');
        assert.deepEqual(e.silenceAtEdges([new Float32Array(500)], RATE), { headMs: 0, tailMs: 0, measured: false });
        assert.deepEqual(e.silenceAtEdges([], RATE), { headMs: 0, tailMs: 0, measured: false });
    });
});

describe('gapless early start', () => {
    let q;
    let played;
    let active;
    let spare;
    let edges;

    afterEach(() => mock.timers.reset());

    beforeEach(async () => {
        mock.timers.enable({ apis: ['setTimeout'] });
        played = [];
        active = { paused: false, ended: false, duration: 10, currentTime: 0, playbackRate: 1, src: 'a' };
        spare = { readyState: 4, pause() {}, removeAttribute() {}, load() {}, addEventListener() {}, removeEventListener() {}, src: '' };
        Object.assign(globalThis, {
            playbackQueue: [{ song: { id: 1, url: 'file:///a.mp3' } }, { song: { id: 2, url: 'file:///b.mp3' } }],
            currentQueueIndex: 0,
            repeatMode: 0,
            repeatFunctionalityActive: false,
            audioElement: active,
            gaplessAudioElement: spare,
            getAudioPlaybackSettings: () => ({ gaplessEnabled: true }),
            emit: () => {},
            playSongFromQueue: (index) => played.push(index),
            setAudioElement: () => {},
            setGaplessAudioElement: () => {},
            setGaplessActiveElement: () => {},
            getTargetTrackVolume: () => 1
        });
        q = await load('src', 'js', 'playback', '10c-playback-queue.js');
        edges = await load('src', 'js', 'playback', '10e-gapless-edges.js');
        edges.clearTrackEdges();
        q.prepareGaplessNextTrack(); // preloads track 2 into the spare element
    });

    // Time passes for the fake timers and for the fake element together, 5 ms at a time, as it does for a playing element.
    const advance = (ms) => {
        for (let spent = 0; spent < ms; spent += 5) {
            active.currentTime += 0.005;
            mock.timers.tick(5);
        }
    };

    test('starts the next track shortly before the end, not at the end and not early', () => {
        active.currentTime = 9;
        q.armGaplessLead(active);
        advance(800);
        assert.deepEqual(played, [], 'still too early: 200 ms of track remain');
        advance(150);
        assert.deepEqual(played, [], '50 ms remain: the start is due at about 41 ms (lead 35 + safety 6)');
        advance(30);
        assert.deepEqual(played, [1], 'about 20 ms remain: started, before the track could have ended');
        assert.ok(active.currentTime < 10, 'and before the end');
        advance(5000);
        assert.deepEqual(played, [1], 'and only once');
    });

    test('starts earlier by the silence at the end of this track and at the start of the next one', () => {
        edges.rememberTrackEdges('file:///a.mp3', { headMs: 0, tailMs: 40 });
        edges.rememberTrackEdges('file:///b.mp3', { headMs: 20, tailMs: 0 });
        active.currentTime = 9.8;
        q.armGaplessLead(active);
        advance(90);
        assert.deepEqual(played, [], '110 ms left: not yet, the start is due at about 101 ms (lead 35 + safety 6 + edges 60)');
        advance(30);
        assert.deepEqual(played, [1], 'about 80 ms left: started');
    });

    test('does nothing while the next track is not ready to play on', () => {
        spare.readyState = 2;
        active.currentTime = 9.95;
        q.armGaplessLead(active);
        mock.timers.tick(1000);
        assert.deepEqual(played, []);
    });

    test('does nothing when paused, for repeat-one, at the end of the queue, or with gapless off', () => {
        active.currentTime = 9.95;
        active.paused = true;
        q.armGaplessLead(active);
        mock.timers.tick(1000);
        active.paused = false;

        globalThis.repeatFunctionalityActive = true;
        globalThis.repeatMode = 2;
        q.armGaplessLead(active);
        mock.timers.tick(1000);
        globalThis.repeatFunctionalityActive = false;
        globalThis.repeatMode = 0;

        globalThis.currentQueueIndex = 1;
        q.armGaplessLead(active);
        mock.timers.tick(1000);
        globalThis.currentQueueIndex = 0;

        globalThis.getAudioPlaybackSettings = () => ({ gaplessEnabled: false });
        q.armGaplessLead(active);
        mock.timers.tick(1000);
        assert.deepEqual(played, []);
    });

    test('a pause or a tick from the other element cancels or leaves the timer, as it should', () => {
        active.currentTime = 9.9;
        q.armGaplessLead(active);
        q.armGaplessLead(spare); // the outgoing element ticking must not cancel the timer of the active one
        advance(300);
        assert.deepEqual(played, [1]);

        played.length = 0;
        active.currentTime = 9.9;
        q.armGaplessLead(active);
        q.cancelGaplessLead();
        advance(300);
        assert.deepEqual(played, []);
    });
});
