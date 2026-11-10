// The volume curve (src/js/playback/volume-curve.js): slider position to audio gain. Pure Node, no browser.
// Run: node --test tools/tests/volume-curve.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'js', 'playback', 'volume-curve.js')).href);
const db = (gain) => 20 * Math.log10(gain);

test('0 is exact silence and 100 is exactly unity gain', async () => {
    const { positionToGain } = await load();
    assert.strictEqual(positionToGain(0), 0);
    assert.strictEqual(positionToGain(1), 1);
    assert.ok(Object.is(positionToGain(0), 0) && !Object.is(positionToGain(0), -0), 'a plain +0, not -0');
});

test('every position gives a gain from 0 to 1: never negative, never above unity, never NaN or Infinity', async () => {
    const { positionToGain } = await load();
    for (let i = 0; i <= 10000; i++) {
        const g = positionToGain(i / 10000);
        assert.ok(Number.isFinite(g) && g >= 0 && g <= 1, `position ${i / 10000} gave ${g}`);
    }
});

test('the curve rises with the slider: strictly, with no flat part and no step', async () => {
    const { positionToGain } = await load();
    let previous = positionToGain(0);
    for (let i = 1; i <= 10000; i++) {
        const g = positionToGain(i / 10000);
        assert.ok(g > previous, `position ${i / 10000}: ${g} is not above ${previous}`);
        previous = g;
    }
    // no jump anywhere: the biggest step between neighbours at 0.01 % resolution is small in dB wherever the signal is audible
    for (let i = 600; i < 10000; i++) assert.ok(db(positionToGain((i + 1) / 10000)) - db(positionToGain(i / 10000)) < 0.01);
});

test('above 5 % every step of the slider is the same number of decibels: 50 dB across the range, 5 dB per 10 %', async () => {
    const { positionToGain, gainToDb } = await load();
    for (const p of [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) assert.ok(Math.abs(gainToDb(positionToGain(p)) - -50 * (1 - p)) < 1e-9, `position ${p}`);
    for (let p = 10; p < 100; p += 10) assert.ok(Math.abs(gainToDb(positionToGain((p + 10) / 100)) - gainToDb(positionToGain(p / 100)) - 5) < 1e-9);
});

test('the bottom 5 % fades to nothing in a straight line, joined to the curve without a jump', async () => {
    const { positionToGain } = await load();
    const top = positionToGain(0.05);
    assert.ok(Math.abs(positionToGain(0.025) - top / 2) < 1e-12);
    assert.ok(Math.abs(positionToGain(0.0499999) - top) < 1e-6);
    assert.ok(positionToGain(0.01) > 0 && positionToGain(0.01) < positionToGain(0.02));
});

test('values outside 0 to 1 and values that are not numbers are handled: clamped, and anything unusable is silence', async () => {
    const { positionToGain, clampPosition } = await load();
    assert.strictEqual(positionToGain(-5), 0);
    assert.strictEqual(positionToGain(7), 1);
    for (const bad of [NaN, undefined, null, 'loud', {}, [], Infinity, -Infinity]) {
        const g = positionToGain(bad);
        assert.ok(Number.isFinite(g) && g >= 0 && g <= 1, `${String(bad)} gave ${g}`);
    }
    assert.strictEqual(clampPosition(NaN), 0);
    assert.strictEqual(clampPosition('0.5'), 0.5);
});

test('gainToPosition is the exact inverse of positionToGain', async () => {
    const { positionToGain, gainToPosition } = await load();
    for (let i = 0; i <= 1000; i++) assert.ok(Math.abs(gainToPosition(positionToGain(i / 1000)) - i / 1000) < 1e-9, `position ${i / 1000}`);
    assert.strictEqual(gainToPosition(0), 0);
    assert.strictEqual(gainToPosition(1), 1);
    assert.strictEqual(gainToPosition(5), 1);
    assert.strictEqual(gainToPosition(NaN), 0);
});

test('keyboard steps: 5 % at a time on whole percents, never drifting, never leaving 0 to 1', async () => {
    const { nudgePosition, VOLUME_KEY_STEP, positionToGain, gainToDb } = await load();
    assert.strictEqual(VOLUME_KEY_STEP, 0.05);
    let p = 0.5;
    for (let i = 0; i < 7; i++) p = nudgePosition(p, VOLUME_KEY_STEP);
    for (let i = 0; i < 7; i++) p = nudgePosition(p, -VOLUME_KEY_STEP);
    assert.strictEqual(p, 0.5, 'seven up and seven down come back to exactly where they started');
    assert.strictEqual(nudgePosition(0.98, 0.05), 1);
    assert.strictEqual(nudgePosition(0.02, -0.05), 0);
    assert.strictEqual(nudgePosition(0, 0.05), 0.05, 'from mute the first press is the first step');
    assert.ok(Math.abs(gainToDb(positionToGain(0.55)) - gainToDb(positionToGain(0.5)) - 2.5) < 1e-9, 'one press is 2.5 dB');
});

test('the saved volume is checked when it is read: a bad value gives null, so the caller uses the default', async () => {
    const { normalizeSavedVolume, DEFAULT_VOLUME_POSITION } = await load();
    assert.deepEqual(normalizeSavedVolume({ position: 0.6, restore: 0.6 }), { position: 0.6, restore: 0.6 });
    assert.deepEqual(normalizeSavedVolume({ position: 0, restore: 0.4 }), { position: 0, restore: 0.4 }, 'muted, with the level unmute returns to');
    assert.deepEqual(normalizeSavedVolume({ position: 0 }), { position: 0, restore: DEFAULT_VOLUME_POSITION });
    assert.deepEqual(normalizeSavedVolume({ position: 0.3, restore: 'x' }), { position: 0.3, restore: 0.3 });
    for (const bad of [null, undefined, 5, 'x', [], {}, { position: 'loud' }, { position: -0.1 }, { position: 1.5 }, { position: NaN }]) assert.strictEqual(normalizeSavedVolume(bad), null, JSON.stringify(bad));
});

test('the slider is used well: most of its travel is in the range people listen in, and little of it is silent', async () => {
    const { positionToGain, gainToDb } = await load();
    let inBand = 0;
    let inaudible = 0;
    for (let i = 1; i <= 100; i++) {
        const d = gainToDb(positionToGain(i / 100));
        if (d >= -40 && d <= -10) inBand++;
        if (d < -45) inaudible++;
    }
    assert.ok(inBand >= 55, `${inBand} % of the slider in the -40 to -10 dB band (linear amplitude gave 31 %)`);
    assert.ok(inaudible <= 10, `${inaudible} % of the slider below -45 dB (a -60 dB range would waste 24 %)`);
});

test('the level of a position (which icon, how bright the fill): mute, whisper, low, high, with exact edges', async () => {
    const { volumeLevel, VOLUME_WHISPER_BELOW, VOLUME_HIGH_FROM } = await load();
    assert.equal(volumeLevel(0), 'mute');
    assert.equal(volumeLevel(0.0001), 'whisper');
    assert.equal(volumeLevel(VOLUME_WHISPER_BELOW - 0.0001), 'whisper');
    assert.equal(volumeLevel(VOLUME_WHISPER_BELOW), 'low');
    assert.equal(volumeLevel(VOLUME_HIGH_FROM - 0.0001), 'low');
    assert.equal(volumeLevel(VOLUME_HIGH_FROM), 'high');
    assert.equal(volumeLevel(1), 'high');
    for (const bad of [NaN, undefined, -1, 'x', null]) assert.equal(volumeLevel(bad), 'mute', String(bad));
    assert.equal(volumeLevel(7), 'high');
    // the levels never go back as the slider rises
    const order = ['mute', 'whisper', 'low', 'high'];
    let at = 0;
    for (let i = 0; i <= 1000; i++) {
        const n = order.indexOf(volumeLevel(i / 1000));
        assert.ok(n >= at, `position ${i / 1000}`);
        at = n;
    }
});

test('the volume icon never moves: no pop or shake keyframes, no transform animation on the icon, in either interface', () => {
    const fs = require('node:fs');
    for (const file of ['src/css/player.css', 'src/ui-next/views/playback/player-bar.css']) {
        const css = fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
        assert.doesNotMatch(css, /volume-pop|volume-shake|vol-pop|vol-shake/, file);
        const fade = css.match(/@keyframes volume-fade \{[\s\S]*?\n\}/);
        assert.ok(fade, `${file}: the fade`);
        assert.doesNotMatch(fade[0], /transform|translate|scale|rotate/, `${file}: the icon fade only changes opacity`);
    }
});

test('every audible level has at least one curved bar in its icon, and the speaker alone is not used', () => {
    const fs = require('node:fs');
    const engine = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'js', 'playback', '15g-controls-volume-fade.js'), 'utf8');
    const table = engine.match(/const VOLUME_ICONS = \{([\s\S]*?)\};/)[1];
    assert.doesNotMatch(table, /fa-volume-off/);
    for (const level of ['whisper', 'low', 'high']) assert.match(table, new RegExp(level + ": \\{ icon: 'fa-volume-(down|up)'"));
    assert.match(table, /mute: \{ icon: 'fa-volume-mute'/);
    const icons = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'ui-next', 'adapter', 'legacy-icons.css'), 'utf8');
    for (const glyph of ['fa-volume-down', 'fa-volume-up']) {
        const block = icons.match(new RegExp('#volume-icon \\.' + glyph + ' \\{\\s*--glyph: url\\("([^"]+)"\\)'));
        assert.ok(block, glyph);
        assert.match(decodeURIComponent(block[1]), /M16 9a5 5 0 0 1 0 6/, `${glyph} has the inner curved bar`);
    }
    assert.doesNotMatch(icons, /fa-volume-off/);
});

test('the volume slider has one readout, the number above the knob: no second tooltip on the slider, and the screen reader values stay', () => {
    const fs = require('node:fs');
    const transport = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'ui-next', 'views', 'playback', 'transport.js'), 'utf8');
    assert.doesNotMatch(transport, /attachTooltip\(volume,/, 'no tooltip on the slider');
    assert.doesNotMatch(transport, /volumeTip/);
    assert.match(transport, /volume\.setAttribute\('aria-valuenow'/);
    assert.match(transport, /volume\.setAttribute\('aria-valuetext'/);
    assert.match(transport, /attachTooltip\(parts\['volume-icon'\]|\['volume-icon', \(\) => \(\{ name:/, 'the mute button keeps its own tooltip');
});
