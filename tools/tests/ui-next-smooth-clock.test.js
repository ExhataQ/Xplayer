// Polish: the seek bar and the waveform move every frame (views/playback/smooth-clock.js), not at each time event.

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { ROOT } = require('./helpers/app-fixture');

describe('createSmoothClock', () => {
    let createSmoothClock;
    before(async () => {
        ({ createSmoothClock } = await import(pathToFileURL(path.join(ROOT, 'src', 'ui-next', 'views', 'playback', 'smooth-clock.js')).href));
    });

    const playing = (currentTime, duration = 100) => ({ currentTime, duration, playing: true });

    test('it runs on between reports while the song plays', () => {
        const c = createSmoothClock();
        c.sample(playing(10), 0);
        c.fraction(0);
        const a = c.fraction(16);
        const b = c.fraction(32);
        assert.ok(b > a && a > 0.1, `${a} then ${b}`);
        assert.ok(b < 0.1002);
    });

    test('a paused song is shown exactly where it is', () => {
        const c = createSmoothClock();
        c.sample({ currentTime: 25, duration: 100, playing: false }, 0);
        assert.equal(c.fraction(5000), 0.25);
    });

    test('a seek or a new song is shown at once', () => {
        const c = createSmoothClock();
        c.sample(playing(10), 0);
        c.fraction(0);
        c.sample(playing(60), 100);
        assert.equal(c.fraction(100), 0.6);
    });

    test('a report a little behind never moves the bar backwards, and a report ahead is eased in', () => {
        const c = createSmoothClock();
        c.sample(playing(10), 0);
        c.fraction(0);
        const before = c.fraction(250); // 10.25 s
        c.sample(playing(10.2), 250); // the element reported a bit less than the clock had run
        assert.ok(c.fraction(251) >= before);
        c.fraction(400);
        c.sample(playing(10.9), 400);
        const x = c.fraction(416); // the report is 0.65 s ahead: not shown at once, moved a part of the way
        assert.ok(x > before && x < 0.109, `${x}`);
    });

    test('with less animation on, the position is exactly the last report', () => {
        let reduced = true;
        const c = createSmoothClock({ reduced: () => reduced });
        c.sample(playing(10), 0);
        assert.equal(c.fraction(0), 0.1);
        assert.equal(c.fraction(2000), 0.1);
        reduced = false;
        c.sample(playing(10), 2000);
        c.fraction(2000);
        assert.ok(c.fraction(2500) > 0.1);
    });

    test('no duration: zero', () => {
        const c = createSmoothClock();
        c.sample({ currentTime: 5, duration: 0, playing: true }, 0);
        assert.equal(c.fraction(100), 0);
    });
});
