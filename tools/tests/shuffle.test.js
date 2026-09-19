const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const playbackSource = fs.readFileSync(
    path.join(__dirname, '../../src/js/10-playback.js'),
    'utf8'
);

function loadShuffleFunctions() {
    const context = {
        deletedSongIds: new Set(),
        currentView: 'shuffle-test',
        currentQueueIndex: -1,
        playbackQueue: [],
        SONGS_DATA: [],
        getFavorites: () => [],
        getRecentlyPlayed: () => [],
        getSmartShuffleSettings: () => ({
            journeySize: 50,
            groupSize: 5,
            genreFlow: 'gentle',
            artistSeparation: 'normal',
            recentLimit: 50,
            favoriteWeight: 'neutral',
            discoveryWeight: 'neutral',
            durationVariety: true
        }),
        getSongsForList: () => []
    };

    vm.createContext(context);
    vm.runInContext(playbackSource, context);
    return context;
}

test('shuffle order contains every item exactly once', () => {
    const { createShuffleOrder } = loadShuffleFunctions();
    const songs = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    const order = createShuffleOrder(songs);

    assert.equal(order.length, songs.length);
    assert.equal(new Set(order).size, songs.length);
    assert.deepEqual([...order].sort((a, b) => a - b), songs.map((song) => song.id));
});

test('shuffle order can exclude the current song when other songs exist', () => {
    const { createShuffleOrder } = loadShuffleFunctions();
    const songs = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    const order = createShuffleOrder(songs, 7);

    assert.equal(order.length, 19);
    assert.equal(order.includes(7), false);
    assert.equal(new Set(order).size, 19);
});

test('single-song shuffle still has a playable item', () => {
    const { createShuffleOrder } = loadShuffleFunctions();
    const order = createShuffleOrder([{ id: 1 }], 1);

    assert.deepEqual(Array.from(order), [1]);
});

test('repeated shuffle generations preserve the full item set', () => {
    const { createShuffleOrder } = loadShuffleFunctions();
    const songs = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 }));
    const expected = songs.map((song) => song.id).sort((a, b) => a - b);

    for (let run = 0; run < 100; run++) {
        const order = createShuffleOrder(songs);
        assert.equal(order.length, songs.length);
        assert.equal(new Set(order).size, songs.length);
        assert.deepEqual([...order].sort((a, b) => a - b), expected);
    }
});

test('Smart Shuffle creates a unique 50-song journey for eligible lists', () => {
    const { generateSmartShuffleJourney } = loadShuffleFunctions();
    const songs = Array.from({ length: 80 }, (_, i) => ({
        id: i + 1,
        artist: `Artist ${i % 12}`,
        genre: i % 2 === 0 ? 'Indie; Alternative' : 'Electronic; Ambient',
        duration: `3:${String(i % 60).padStart(2, '0')}`
    }));
    const journey = generateSmartShuffleJourney(songs, null, 'shuffle-test');

    assert.equal(journey.length, 50);
    assert.equal(new Set(journey).size, 50);
    assert.equal(journey.every((id) => id >= 1 && id <= 80), true);
});
