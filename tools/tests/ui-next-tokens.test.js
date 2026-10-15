'use strict';

// Guards the ui-next design tokens (src/ui-next/tokens.css): every theme defines the same names, components only
// use tokens that exist, no component stylesheet uses a raw color, and text and accent colors meet the contrast floor.
//
// Run: node --test tools/tests/ui-next-tokens.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'src', 'ui-next');
const tokens = fs.readFileSync(path.join(DIR, 'tokens.css'), 'utf8');

function blocks(css) {
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css.replace(/\/\*[\s\S]*?\*\//g, '')))) out.push({ selector: m[1].trim(), body: m[2] });
    return out;
}

function declarations(body) {
    const map = {};
    for (const part of body.split(';')) {
        const i = part.indexOf(':');
        if (i > 0) map[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    return map;
}

const allBlocks = blocks(tokens);
const THEMES = ['warm-graphite', 'deep-forest', 'espresso-copper'];
const ACCENTS = ['green', 'pink', 'purple', 'yellow', 'white'];

function themeVars(name) {
    // The default theme is also the :root block; its [data-theme] selector is in the same selector list.
    const block = allBlocks.find((b) => b.selector.includes(`[data-theme='${name}']`));
    assert.ok(block, `no block for theme ${name}`);
    return declarations(block.body);
}

function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe('themes', () => {
    const reference = Object.keys(themeVars('warm-graphite')).sort();

    test('the first theme defines the full primitive set', () => {
        assert.ok(reference.length >= 12);
        assert.ok(reference.every((n) => n.startsWith('--c-')));
    });

    for (const name of THEMES) {
        test(`${name} defines exactly the same names`, () => {
            assert.deepEqual(Object.keys(themeVars(name)).sort(), reference);
        });

        test(`${name}: every color is a 6-digit hex (or an rgb triple)`, () => {
            for (const [k, v] of Object.entries(themeVars(name))) {
                if (k === '--c-accent-rgb') assert.match(v, /^\d{1,3} \d{1,3} \d{1,3}$/, k);
                else assert.match(v, /^#[0-9a-f]{6}$/, `${k}: ${v}`);
            }
        });

        test(`${name}: accent rgb matches the accent hex`, () => {
            const v = themeVars(name);
            const hex = v['--c-accent'];
            const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
            assert.equal(v['--c-accent-rgb'], rgb);
        });

        test(`${name}: text and accent meet 4.5:1 on every surface they sit on`, () => {
            const v = themeVars(name);
            const surfaces = ['--c-ground', '--c-surface', '--c-raised', '--c-selected'];
            for (const text of ['--c-ink', '--c-ink-dim', '--c-ink-faint', '--c-accent', '--c-danger']) {
                for (const s of surfaces) {
                    const ratio = contrast(v[text], v[s]);
                    assert.ok(ratio >= 4.5, `${text} on ${s} is ${ratio.toFixed(2)}:1`);
                }
            }
            const onAccent = contrast(v['--c-on-accent'], v['--c-accent']);
            assert.ok(onAccent >= 4.5, `text on accent is ${onAccent.toFixed(2)}:1`);
        });
    }
});

describe('accent choices', () => {
    for (const name of ACCENTS) {
        test(`${name}: keeps 4.5:1 on the dark surfaces of every theme`, () => {
            const block = allBlocks.find((b) => b.selector === `:root[data-accent='${name}']`);
            assert.ok(block, `no block for accent ${name}`);
            const v = declarations(block.body);
            assert.deepEqual(Object.keys(v).sort(), ['--c-accent', '--c-accent-hover', '--c-accent-rgb', '--c-on-accent']);
            for (const theme of THEMES) {
                const t = themeVars(theme);
                for (const s of ['--c-surface', '--c-selected']) {
                    const ratio = contrast(v['--c-accent'], t[s]);
                    assert.ok(ratio >= 4.5, `${name} on ${theme} ${s} is ${ratio.toFixed(2)}:1`);
                }
                assert.ok(contrast(v['--c-on-accent'], v['--c-accent']) >= 4.5, `${name}: text on accent`);
            }
        });
    }
});

describe('layers', () => {
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

    test('every var() in ui-next stylesheets refers to a defined token', () => {
        const files = ['tokens.css', 'base.css'];
        const missing = [];
        for (const f of files) {
            const css = fs.readFileSync(path.join(DIR, f), 'utf8');
            for (const m of css.matchAll(/var\((--[a-z0-9-]+)/g)) if (!defined.has(m[1])) missing.push(`${f}: ${m[1]}`);
        }
        assert.deepEqual(missing, []);
    });

    test('base.css uses no raw colors and no primitive --c-* names', () => {
        const css = fs.readFileSync(path.join(DIR, 'base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
        assert.doesNotMatch(css.replace(/var\(--c-accent-rgb\)/g, ''), /--c-[a-z]/);
    });

    test('semantic and component layers only reference earlier layers', () => {
        const semanticStart = tokens.indexOf('2. semantic layer');
        assert.ok(semanticStart > 0);
        const rest = tokens.slice(semanticStart);
        assert.doesNotMatch(rest, /#[0-9a-fA-F]{6}\b/, 'raw hex after the primitive layer');
    });
});

describe('fonts and icons', () => {
    test('every font file named in base.css exists, and each family has a license file', () => {
        const css = fs.readFileSync(path.join(DIR, 'base.css'), 'utf8');
        const files = [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
        assert.ok(files.length >= 6);
        for (const f of files) assert.ok(fs.existsSync(path.join(DIR, f)), `${f} is missing`);
        assert.ok(fs.existsSync(path.join(DIR, 'fonts', 'LICENSE-IBM-Plex-Sans-OFL.txt')));
        assert.ok(fs.existsSync(path.join(DIR, 'fonts', 'LICENSE-Newsreader-OFL.txt')));
    });

    test('icons.js ships with its license and every icon is a plain set of shapes', async () => {
        assert.ok(fs.existsSync(path.join(DIR, 'icons', 'LICENSE-Lucide-ISC.txt')));
        const iconsPath = pathToFileURL(path.join(DIR, 'icons', 'icons.js')).href;
        const { ICONS, icon } = await import(iconsPath);
        const names = Object.keys(ICONS);
        assert.ok(names.length >= 30);
        for (const name of names) assert.doesNotMatch(ICONS[name], /<script|on\w+=|<style/i, name);
        assert.match(icon('play', { filled: true }), /fill="currentColor"/);
        assert.match(icon('bell', { label: 'Notifications' }), /role="img" aria-label="Notifications"/);
        assert.match(icon('bell'), /aria-hidden="true"/);
        assert.throws(() => icon('not-an-icon'), /Unknown icon/);
    });
});
