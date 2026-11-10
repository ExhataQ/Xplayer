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

test('queueZoneHeight: grows with the queue, with a minimum and a maximum', async () => {
    const { queueZoneHeight, QUEUE_ZONE_MIN, QUEUE_ZONE_MAX } = await import(MODULE);
    assert.equal(queueZoneHeight(0), QUEUE_ZONE_MIN, 'an empty queue');
    assert.equal(queueZoneHeight(undefined), QUEUE_ZONE_MIN, 'unknown size');
    assert.equal(queueZoneHeight(NaN), QUEUE_ZONE_MIN);
    assert.equal(queueZoneHeight(1), QUEUE_ZONE_MIN, 'a short queue stays at the minimum');
    assert.ok(queueZoneHeight(6) > QUEUE_ZONE_MIN && queueZoneHeight(6) < QUEUE_ZONE_MAX, 'a middle queue is in between');
    assert.ok(queueZoneHeight(6) > queueZoneHeight(4), 'more rows, a taller zone');
    assert.equal(queueZoneHeight(50), QUEUE_ZONE_MAX, 'a long queue stops at the maximum');
});

test('queueOpenZone and isInZone: the zone sits on the right, above the button', async () => {
    const { queueOpenZone, isInZone, queueZoneHeight, QUEUE_ZONE_WIDTH } = await import(MODULE);
    const zone = queueOpenZone(BUTTON, 6, 1400);
    assert.deepEqual(zone, { left: 1400 - QUEUE_ZONE_WIDTH, right: 1400, top: BUTTON.top - queueZoneHeight(6), bottom: BUTTON.bottom });
    assert.equal(isInZone({ clientX: 1100, clientY: BUTTON.top - 100 }, zone), true, 'above the button, 100 px up');
    assert.equal(isInZone({ clientX: 1100, clientY: BUTTON.top - queueZoneHeight(6) - 1 }, zone), false, 'one pixel above the zone');
    assert.equal(isInZone({ clientX: 400, clientY: BUTTON.top - 100 }, zone), false, 'the middle of the list');
    assert.equal(queueOpenZone(BUTTON, 50, 1400).top < zone.top, true, 'a longer queue reaches higher');
    assert.equal(queueOpenZone({ left: 0, right: 0, top: 10, bottom: 10, width: 0, height: 0 }, 3, 1400), null, 'a hidden button');
    assert.equal(queueOpenZone(BUTTON, 3, 0), null, 'no window width');
    assert.equal(queueOpenZone({ ...BUTTON, top: 20, bottom: 52 }, 50, 1400).top, 0, 'never above the window');
    assert.equal(isInZone(null, zone), false);
    assert.equal(isInZone({ clientX: 1, clientY: 1 }, null), false);
});
