const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const jsDir = path.join(__dirname, '../../src/js');
const importModule = (name) => import(pathToFileURL(path.join(jsDir, name)).href);

const notDeleted = () => false;

const smartShuffleSettings = {
    journeySize: 50,
    groupSize: 5,
    genreFlow: 'gentle',
    artistSeparation: 'normal',
    recentLimit: 50,
    favoriteWeight: 'neutral',
    discoveryWeight: 'neutral',
    durationVariety: true
};

async function loadShuffleFunctions() {
    const { createShuffleOrder } = await importModule('10a-playback-shuffle.js');
    const { generateSmartShuffleJourney } = await importModule('10b-playback-smart-shuffle.js');
    return { createShuffleOrder, generateSmartShuffleJourney };
}

test('shuffle order contains every item exactly once', async () => {
    const { createShuffleOrder } = await loadShuffleFunctions();
    const songs = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    const order = createShuffleOrder(songs, null, notDeleted);

    assert.equal(order.length, songs.length);
    assert.equal(new Set(order).size, songs.length);
    assert.deepEqual([...order].sort((a, b) => a - b), songs.map((song) => song.id));
});

test('shuffle order can exclude the current song when other songs exist', async () => {
    const { createShuffleOrder } = await loadShuffleFunctions();
    const songs = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    const order = createShuffleOrder(songs, 7, notDeleted);

    assert.equal(order.length, 19);
    assert.equal(order.includes(7), false);
    assert.equal(new Set(order).size, 19);
});

test('shuffle order skips deleted songs', async () => {
    const { createShuffleOrder } = await loadShuffleFunctions();
    const songs = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
    const deleted = new Set([2, 5]);
    const order = createShuffleOrder(songs, null, (id) => deleted.has(id));

    assert.deepEqual([...order].sort((a, b) => a - b), [1, 3, 4, 6, 7, 8, 9, 10]);
});

test('single-song shuffle still has a playable item', async () => {
    const { createShuffleOrder } = await loadShuffleFunctions();
    const order = createShuffleOrder([{ id: 1 }], 1, notDeleted);

    assert.deepEqual(Array.from(order), [1]);
});

test('repeated shuffle generations preserve the full item set', async () => {
    const { createShuffleOrder } = await loadShuffleFunctions();
    const songs = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 }));
    const expected = songs.map((song) => song.id).sort((a, b) => a - b);

    for (let run = 0; run < 100; run++) {
        const order = createShuffleOrder(songs, null, notDeleted);
        assert.equal(order.length, songs.length);
        assert.equal(new Set(order).size, songs.length);
        assert.deepEqual([...order].sort((a, b) => a - b), expected);
    }
});

test('Smart Shuffle creates a unique 50-song journey for eligible lists', async (t) => {
    t.mock.method(console, 'log', () => {});
    const { generateSmartShuffleJourney } = await loadShuffleFunctions();
    const songs = Array.from({ length: 80 }, (_, i) => ({
        id: i + 1,
        artist: `Artist ${i % 12}`,
        genre: i % 2 === 0 ? 'Indie; Alternative' : 'Electronic; Ambient',
        duration: `3:${String(i % 60).padStart(2, '0')}`
    }));
    const journey = generateSmartShuffleJourney(songs, null, 'shuffle-test', {
        settings: smartShuffleSettings,
        isDeleted: notDeleted,
        setSourceId: () => {},
        setPreviousSong: () => {}
    });

    assert.equal(journey.length, 50);
    assert.equal(new Set(journey).size, 50);
    assert.equal(journey.every((id) => id >= 1 && id <= 80), true);
});
