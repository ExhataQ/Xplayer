// Task PA-19: the side panels' widths and which one shows, as the window narrows (shell/panel-layout.js, the pure arithmetic).
//   1. both panels shrink to their minimum first; 2. then the view shrinks to its minimum; 3. then the panel opened first steps aside.
//   Opening a panel in a narrow window disables the other one.
//
// Run:   node --test tools/tests/ui-next-panel-layout-rules.test.js   (no browser needed)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const file = pathToFileURL(path.join(__dirname, '..', '..', 'src', 'ui-next', 'shell', 'panel-layout.js')).href;

test('PA-19 layout rules', async () => {
    const { arrange, LEFT, RIGHT, VIEW_MIN, VIEW_COMFORT } = await import(file);
    const L = { wanted: true, saved: 340 }, R = { wanted: true, saved: 320 }, off = (x) => ({ ...x, wanted: false });
    const both = (available) => arrange({ available, left: L, right: R });
    const view = (a, available) => available - (a.left.shown ? a.left.width : 0) - (a.right.shown ? a.right.width : 0);

    // Wide: both at their saved widths, the view takes the rest.
    assert.deepEqual(both(1332), { left: { shown: true, width: 340 }, right: { shown: true, width: 320 } });

    // 1. Shrinking: the panels give up room first and the view keeps VIEW_COMFORT.
    for (let a = 1300; a >= LEFT.min + RIGHT.min + VIEW_COMFORT; a -= 7) {
        const x = both(a);
        if (a >= 340 + 320 + VIEW_COMFORT) assert.equal(view(x, a), a - 660, `saved widths at ${a}`);
        else assert.equal(view(x, a), VIEW_COMFORT, `the view holds its comfortable width at ${a} while the panels shrink`);
    }
    // 2. The panels are at their minimum: now the view shrinks, down to its minimum.
    const mins = both(LEFT.min + RIGHT.min + VIEW_COMFORT - 30);
    assert.equal(mins.left.width, LEFT.min);
    assert.equal(mins.right.width, RIGHT.min);
    assert.equal(view(mins, LEFT.min + RIGHT.min + VIEW_COMFORT - 30), VIEW_COMFORT - 30);
    assert.equal(view(both(LEFT.min + RIGHT.min + VIEW_MIN), LEFT.min + RIGHT.min + VIEW_MIN), VIEW_MIN);
    // Growing is the same steps backwards: from the view's minimum the view grows first (panels stay at their minimum) ...
    for (let a = LEFT.min + RIGHT.min + VIEW_MIN; a <= LEFT.min + RIGHT.min + VIEW_COMFORT; a += 5) {
        const x = both(a);
        assert.equal(x.left.width + x.right.width, LEFT.min + RIGHT.min, `panels stay at their minimum while the view grows (${a})`);
    }
    // ... and only then the panels grow, with the view holding its comfortable width.
    assert.ok(both(LEFT.min + RIGHT.min + VIEW_COMFORT + 50).left.width > LEFT.min);
    // No jumps while both show: one pixel never moves a width by more than a pixel or two.
    for (let a = 1400; a > LEFT.min + RIGHT.min + VIEW_MIN; a--) {
        const x = both(a), y = both(a - 1);
        assert.ok(Math.abs(x.left.width - y.left.width) <= 2 && Math.abs(x.right.width - y.right.width) <= 2, `smooth at ${a}`);
    }

    // 3. Not even both minimums fit beside the view's minimum: the right panel stays open and the left steps aside, whoever was opened last.
    const narrow = both(LEFT.min + RIGHT.min + VIEW_MIN - 1);
    assert.equal(narrow.left.shown, false);
    assert.equal(narrow.right.shown, true);
    assert.equal(narrow.right.width, LEFT.min + RIGHT.min + VIEW_MIN - 1 - VIEW_COMFORT, 'alone, the right panel follows the same order: it shrinks while the view holds its comfortable width');
    // The person opened the left panel last: it takes the right panel's place.
    const swapped = arrange({ available: 800, left: L, right: R, lastOpened: 'left' });
    assert.equal(swapped.left.shown, true);
    assert.equal(swapped.right.shown, false);
    // When both fit, lastOpened makes no difference.
    assert.deepEqual(arrange({ available: 1332, left: L, right: R, lastOpened: 'left' }), both(1332));
    const atWindowMin = both(732); // an 800 px window
    assert.equal(atWindowMin.right.shown, true);
    assert.equal(atWindowMin.left.shown, false);
    assert.equal(view(atWindowMin, 732), 732 - RIGHT.min);

    // One panel: the same order. It shrinks first (the view keeps VIEW_COMFORT), then sits at its minimum while the view shrinks.
    assert.equal(arrange({ available: 1200, left: L, right: off(R) }).left.width, 340);
    assert.equal(arrange({ available: 900, left: L, right: off(R) }).left.width, 900 - VIEW_COMFORT);
    assert.equal(arrange({ available: 732, left: L, right: off(R) }).left.width, LEFT.min);
    assert.equal(arrange({ available: 732, left: off(L), right: R }).right.width, RIGHT.min);
    assert.equal(arrange({ available: 1200, left: off(L), right: R }).right.width, 320);

    // Nothing wanted: nothing shown.
    const none = arrange({ available: 900, left: off(L), right: off(R) });
    assert.equal(none.left.shown, false);
    assert.equal(none.right.shown, false);
});
