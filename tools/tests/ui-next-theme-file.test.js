// Task C9: theme files (shell/theme-file.js). A loaded file is untrusted input: only well-formed values are kept, the rest is dropped or
// the whole file refused, and no value can become CSS or script except through the whitelist of shell/theme-design.js.
// Pure Node: no browser.
//
// Run:   node --test tools/tests/ui-next-theme-file.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const UI = path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'shell');
const load = (name) => import(pathToFileURL(path.join(UI, name)).href);

const GOOD = { app: 'xplayer-theme', version: 1, name: 'Midnight rose', colors: { ground: '#101018', surface: '#181824', ink: '#f0e8f0', accent: '#f08cb6' }, exact: false, panels: {}, style: {} };
const text = (patch = {}) => JSON.stringify({ ...GOOD, ...patch });

test('a theme goes to a file and comes back the same', async () => {
    const { themeFileText, parseThemeFile } = await load('theme-file.js');
    const theme = { name: 'Rose', colors: GOOD.colors, exact: true, panels: { rail: { fill: 'solid', bg: '#222233', ink: '#ffffff' } }, style: { lineStrength: 70, lineColor: '#445566' } };
    const result = parseThemeFile(themeFileText(theme));
    assert.equal(result.ok, true);
    assert.deepEqual(result.theme, theme);
    const file = JSON.parse(themeFileText(theme));
    assert.equal(file.app, 'xplayer-theme');
    assert.equal(file.version, 1);
});

test('a file that is not a theme is refused with a message, and nothing throws', async () => {
    const { parseThemeFile, MAX_THEME_FILE_BYTES } = await load('theme-file.js');
    const refused = (input, pattern) => {
        const result = parseThemeFile(input);
        assert.equal(result.ok, false, String(input).slice(0, 60));
        assert.match(result.message, pattern);
        assert.equal(result.theme, undefined);
    };
    refused(undefined, /could not be read/);
    refused(null, /could not be read/);
    refused('', /not valid JSON/);
    refused('{not json', /not valid JSON/);
    refused('null', /not an Xplayer theme/);
    refused('42', /not an Xplayer theme/);
    refused('"theme"', /not an Xplayer theme/);
    refused('[]', /not an Xplayer theme/);
    refused(text({ app: 'something-else' }), /not an Xplayer theme/);
    refused(text({ app: undefined }), /not an Xplayer theme/);
    refused(text({ version: undefined }), /no valid version/);
    refused(text({ version: 0 }), /no valid version/);
    refused(text({ version: '1' }), /no valid version/);
    refused(text({ version: 1.5 }), /no valid version/);
    refused(text({ version: 2 }), /newer version/);
    refused(text({ colors: undefined }), /four colors/);
    refused(text({ colors: [] }), /four colors/);
    refused(text({ colors: { ground: '#101018', surface: '#181824', ink: '#f0e8f0' } }), /four colors/);
    refused('x'.repeat(MAX_THEME_FILE_BYTES + 1), /too big/);
});

test('a color that is not exactly a hex code refuses the file: no CSS can ride in on a color', async () => {
    const { parseThemeFile } = await load('theme-file.js');
    for (const bad of ['red', '#fff', '#12345', '#1234567', '#gggggg', 'rgb(0,0,0)', 'url(x)', '#ff0000; } body { display: none', '#ff0000\n', ' #ff0000', 7, null, {}, ['#ff0000']]) {
        for (const key of ['ground', 'surface', 'ink', 'accent']) {
            const result = parseThemeFile(text({ colors: { ...GOOD.colors, [key]: bad } }));
            assert.equal(result.ok, false, `${key}: ${JSON.stringify(bad)}`);
        }
    }
});

test('names are plain text of at most 40 characters; the colors are lower-cased', async () => {
    const { parseThemeFile, cleanName } = await load('theme-file.js');
    const evil = parseThemeFile(text({ name: '  <img src=x onerror=alert(1)>\n\t\u0000Line\u2028two   ' + 'x'.repeat(100), colors: { ground: '#ABCDEF', surface: '#181824', ink: '#F0E8F0', accent: '#F08CB6' } }));
    assert.equal(evil.ok, true);
    assert.ok(evil.theme.name.length <= 40);
    assert.doesNotMatch(evil.theme.name, /[\u0000-\u001f\u2028\u2029]/);
    assert.equal(evil.theme.colors.ground, '#abcdef');
    assert.equal(evil.theme.colors.ink, '#f0e8f0');
    assert.equal(cleanName(12), '');
    assert.equal(cleanName('  a \n b  '), 'a b');
    assert.equal(parseThemeFile(text({ name: '   ' })).theme.name, 'Loaded theme', 'an empty name gets a plain one');
    assert.equal(parseThemeFile(text({ name: { toString: 1 } })).theme.name, 'Loaded theme');
});

test('panels and style keep only hex colors, whole numbers and fixed words: what reaches designCss is only what the whitelist wrote', async () => {
    const { parseThemeFile } = await load('theme-file.js');
    const { normalizeCustom, designCss } = await load('theme-design.js');
    const hostile = parseThemeFile(
        text({
            panels: {
                rail: { fill: 'solid', bg: 'red;} body{display:none', ink: 'url(javascript:alert(1))', accent: '#ff0000', line: '#00ff00', lineWidth: '2px' },
                left: { fill: 'gradient', bg: '#112233', bg2: 'expression(alert(1))', angle: '90deg; x' },
                main: { fill: 'solid', bg: '#123456', lineWidth: 99 },
                player: { fill: 'solid', bg: '#102030', lineWidth: 2, line: '#aabbcc', ink: '#ffffff' },
                'rail; } body': { fill: 'solid', bg: '#000000' },
                __proto__: { fill: 'solid', bg: '#000000' },
                constructor: { fill: 'solid' }
            },
            style: { lineStrength: 'strong', lineColor: 'red; } *{display:none', extra: 'x' },
            extra: { anything: 1 }
        })
    );
    assert.equal(hostile.ok, true);
    const { panels, style } = hostile.theme;
    // left lost its gradient (the second color is not a color) and has nothing else; the odd panel names are not panels
    assert.deepEqual(Object.keys(panels).sort(), ['main', 'player', 'rail']);
    assert.deepEqual(panels.rail, { accent: '#ff0000', line: '#00ff00' });
    assert.deepEqual(panels.main, { fill: 'solid', bg: '#123456' }, 'a width out of range is dropped, the valid fill stays');
    assert.equal(panels.player.lineWidth, 2);
    assert.deepEqual(style, {});
    const css = designCss(normalizeCustom({ colors: hostile.theme.colors, exact: false, panels, style }));
    assert.doesNotMatch(css, /display\s*:\s*none|javascript|expression|url\(|<|>|alert/i);
    // every value in the generated rules is a hex color, a number with px, or a var()/rgb() the generator itself writes
    for (const value of css.matchAll(/:\s*([^;{}]+);/g)) assert.match(value[1].trim(), /^(#[0-9a-f]{6}|\d+(px)?|var\(--[a-z-]+\)|rgb\([\d ]+\)|rgb\([\d ]+ \/ [\d.]+\)|linear-gradient\([^;]*\)|[0-9a-z .%,()#\/-]+)$/i, value[1]);
});

test('uniqueName adds (2), (3)... when the name is taken, ignoring case, and stays within 40 characters', async () => {
    const { uniqueName } = await load('theme-file.js');
    assert.equal(uniqueName('Rose', []), 'Rose');
    assert.equal(uniqueName('Rose', ['rose']), 'Rose (2)');
    assert.equal(uniqueName('Rose', ['Rose', 'ROSE (2)']), 'Rose (3)');
    const long = 'x'.repeat(40);
    const next = uniqueName(long, [long]);
    assert.equal(next.length, 40);
    assert.match(next, / \(2\)$/);
    assert.equal(uniqueName('', []), 'Loaded theme');
});

test('the file name is lower-case letters, digits and dashes', async () => {
    const { themeFileName } = await load('theme-file.js');
    assert.equal(themeFileName('Midnight rose!'), 'midnight-rose.xplayer-theme.json');
    assert.equal(themeFileName('../../etc/passwd'), 'etc-passwd.xplayer-theme.json');
    assert.equal(themeFileName('***'), 'theme.xplayer-theme.json');
    assert.equal(themeFileName('C:\\Windows\\x'), 'c-windows-x.xplayer-theme.json');
});
