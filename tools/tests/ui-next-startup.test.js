'use strict';

// Guards the ui-next startup view (src/ui-next/startup/): the saved choice resolves to a real background, every
// background builds, the id list matches the one Settings offers, and the stylesheet follows the token rules.
//
// Run: node --test tools/tests/ui-next-startup.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'src', 'ui-next', 'startup');
const load = (name) => import(pathToFileURL(path.join(DIR, name)).href);

function settingsIds() {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'js', 'library', '03f-favorites-settings.js'), 'utf8');
    const block = src.match(/export const STARTUP_BACKGROUNDS = \[([\s\S]*?)\];/);
    assert.ok(block, 'STARTUP_BACKGROUNDS not found in 03f-favorites-settings.js');
    return [...block[1].matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]);
}

describe('startup view', () => {
    test('Settings offers every background plus Random, and nothing else', async () => {
        const { STARTUP_VARIANTS, DEFAULT_STARTUP_VARIANT } = await load('startup.js');
        assert.deepEqual(settingsIds(), [...STARTUP_VARIANTS, 'random']);
        const src = fs.readFileSync(path.join(ROOT, 'src', 'js', 'library', '03f-favorites-settings.js'), 'utf8');
        assert.match(src, new RegExp(`DEFAULT_STARTUP_BACKGROUND = '${DEFAULT_STARTUP_VARIANT}'`));
    });

    test('the saved choice resolves to a known background', async () => {
        const { resolveStartupVariant, STARTUP_VARIANTS, DEFAULT_STARTUP_VARIANT } = await load('startup.js');
        for (const id of STARTUP_VARIANTS) assert.equal(resolveStartupVariant(id), id);
        for (const bad of [undefined, null, '', 'nope', 42, '__proto__']) {
            assert.equal(resolveStartupVariant(bad), DEFAULT_STARTUP_VARIANT, String(bad));
        }
    });

    test('random picks an animated background and never the plain one', async () => {
        const { resolveStartupVariant, STARTUP_VARIANTS } = await load('startup.js');
        const animated = STARTUP_VARIANTS.filter((id) => id !== 'plain');
        const seen = new Set();
        for (let i = 0; i <= 100; i++) seen.add(resolveStartupVariant('random', () => i / 100));
        assert.deepEqual([...seen].sort(), [...animated].sort());
        assert.equal(resolveStartupVariant('random', () => 1), animated[animated.length - 1], 'a random value of 1 stays in range');
    });

    test('every background builds, identically each time, and an unknown one is refused', async () => {
        const { backgroundMarkup, STARTUP_VARIANTS } = await load('startup.js');
        for (const id of STARTUP_VARIANTS) {
            const markup = backgroundMarkup(id);
            assert.equal(markup, backgroundMarkup(id), `${id} must not use random numbers`);
            if (id === 'plain') assert.equal(markup, '');
            else assert.match(markup, new RegExp(`su-bg-${id}`));
        }
        assert.throws(() => backgroundMarkup('nope'));
    });

    test('the logo is the X mark, colored by tokens', async () => {
        const { logo, LOGO_NAMES } = await load('logo.js');
        assert.deepEqual(LOGO_NAMES, ['x']);
        const svg = logo('x', { size: 24 });
        assert.match(svg, /width="24"/);
        assert.match(svg, /var\(--accent\)/);
        assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,6}\b/);
        assert.match(logo('x', { label: 'Xplayer' }), /role="img" aria-label="Xplayer"/);
        assert.throws(() => logo('nope'));
    });

    test('startup.css uses only tokens, has a rule for every background, and animates only transform and opacity', () => {
        const css = fs.readFileSync(path.join(DIR, 'startup.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, 'raw hex color');
        assert.doesNotMatch(css, /--c-[a-z-]+/, 'primitive color name');
        assert.doesNotMatch(css, /\b(rgb|rgba|hsl|hsla)\(/, 'raw color function');
        const selectors = { playhead: '.su-lit', vinyl: '.su-sheen', equalizer: '.su-eq', light: '.su-leak', constellation: '.su-bg-constellation' };
        for (const [id, selector] of Object.entries(selectors)) assert.ok(css.includes(selector), `${id}: no rule for ${selector}`);
        const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
        assert.ok(keyframes.length >= 8, 'keyframes were found');
        for (const [, name, body] of keyframes) {
            const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
            for (const prop of props) assert.ok(['transform', 'opacity'].includes(prop), `@keyframes ${name} animates ${prop}`);
        }
    });
});
