// PC-11: the queue drawer opens when a song is dragged near the queue button (views/playback/queue-drag-open.js).
// Pure Node: the geometry only. The wiring in queue-panel.js needs a real browser and a real drag (see the PC-11 report).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE = pathToFileURL(path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'views', 'playback', 'queue-drag-open.js')).href;
const BUTTON = { left: 1000, right: 1040, top: 700, bottom: 732, width: 40, height: 32 };

test('isNearRect: inside, inside the margin, and outside the margin', async () => {
    const { isNearRect, QUEUE_NEAR_DISTANCE } = await import(MODULE);
    assert.equal(isNearRect({ clientX: 1020, clientY: 716 }, BUTTON), true, 'on the button');
    assert.equal(isNearRect({ clientX: 1000 - QUEUE_NEAR_DISTANCE, clientY: 716 }, BUTTON), true, 'exactly at the margin');
    assert.equal(isNearRect({ clientX: 1000 - QUEUE_NEAR_DISTANCE - 1, clientY: 716 }, BUTTON), false, 'one pixel past it');
    assert.equal(isNearRect({ clientX: 1020, clientY: 700 - QUEUE_NEAR_DISTANCE - 1 }, BUTTON), false, 'too far above');
    assert.equal(isNearRect({ clientX: 200, clientY: 100 }, BUTTON), false, 'the song list');
});

test('isNearRect: a custom margin, and missing or empty input', async () => {
    const { isNearRect } = await import(MODULE);
    assert.equal(isNearRect({ clientX: 960, clientY: 716 }, BUTTON, 40), true);
    assert.equal(isNearRect({ clientX: 959, clientY: 716 }, BUTTON, 40), false);
    assert.equal(isNearRect(null, BUTTON), false);
    assert.equal(isNearRect({ clientX: 1, clientY: 1 }, null), false);
    assert.equal(isNearRect({ clientX: 0, clientY: 0 }, { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }), false, 'a hidden button has no rectangle');
});
