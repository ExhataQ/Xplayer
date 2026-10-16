'use strict';

// Static guards for the ui-next component set (src/ui-next/components, task A-05): token discipline, every state
// has a style, components stay behind the architecture boundary, and the index exports each component.
// Behavior in a real page is in ui-next-components-behavior.test.js.
//
// Run: node --test tools/tests/ui-next-components.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'src', 'ui-next');
const COMPONENTS = path.join(DIR, 'components');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const components = strip(fs.readFileSync(path.join(COMPONENTS, 'components.css'), 'utf8'));
const tokens = fs.readFileSync(path.join(DIR, 'tokens.css'), 'utf8');
const base = fs.readFileSync(path.join(DIR, 'base.css'), 'utf8');
const jsFiles = fs.readdirSync(COMPONENTS).filter((f) => f.endsWith('.js'));

describe('components.css uses tokens only', () => {
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

    // set per instance by a component's own script, not a design token (progress.set in status.js)
    const instanceVariables = new Set(['--progress-value']);

    test('every var() refers to a defined token', () => {
        const missing = [...components.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !defined.has(n) && !instanceVariables.has(n));
        assert.deepEqual([...new Set(missing)], []);
    });

    test('no raw colors and no primitive --c-* names', () => {
        assert.doesNotMatch(components, /#[0-9a-fA-F]{3,8}\b/);
        assert.doesNotMatch(components, /\brgba?\(|\bhsla?\(|\boklch\(/);
        assert.doesNotMatch(components, /--c-[a-z]/);
    });

    test('only the keywords transparent, currentColor and inherit stand in for a color token', () => {
        const colorProps = [...components.matchAll(/(?:^|[;{\s])(?:color|background|background-color|border-color|outline-color)\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
        for (const value of colorProps) assert.match(value, /var\(--|^(transparent|currentColor|inherit)$/, value);
    });

    test('the layers, sizes and shadows components rely on exist in tokens.css', () => {
        for (const name of ['--layer-toast', '--layer-menu', '--layer-tooltip', '--shadow-raised', '--control-hover-bg', '--control-disabled-opacity']) assert.ok(defined.has(name), name);
    });
});

describe('every state has a style', () => {
    const has = (fragment) => assert.ok(components.includes(fragment), `components.css never mentions ${fragment}`);
    const table = {
        button: ['.btn--primary', '.btn--outline', '.btn--danger', ':hover', ':active', '.btn:disabled', "[aria-busy='true']", "[aria-pressed='true']"],
        'icon button': ['.icon-btn:disabled', ".icon-btn[aria-pressed='true']", '.icon-btn--solid', ".icon-btn[aria-busy='true']"],
        chip: ["[aria-pressed='true']", '.chip:disabled'],
        field: [':focus-within', "[data-state='error']", "[data-state='success']", "[data-disabled='true']", "[data-readonly='true']", '::placeholder'],
        tabs: ["[aria-selected='true']", '.tab:disabled'],
        segmented: ["[aria-checked='true']", '.segmented__item:disabled'],
        tooltip: ['.tooltip[hidden]'],
        toast: ["[data-kind='success']", "[data-kind='error']", '@keyframes toast-in'],
        status: ["[data-state='running']", "[data-state='success']", "[data-state='error']"],
        progress: ["[data-indeterminate='true']", "[data-state='error']"],
        dialog: ['.dialog::backdrop', '.dialog__error'],
        menu: ["[aria-disabled='true']", "[data-danger='true']", ".menu__item[aria-checked='true']", ':focus-visible'],
        'empty state': ["[data-state='error']", "[data-state='loading']"]
    };
    for (const [name, fragments] of Object.entries(table)) {
        test(name, () => fragments.forEach(has));
    }

    test('forced gallery states exist for hover, active and focus', () => {
        for (const cls of ['.is-hover', '.is-active', '.is-focus']) assert.ok(components.includes(cls), cls);
    });

    test('keyboard focus: base.css has the global ring and components do not remove it', () => {
        assert.match(base, /:focus-visible\s*\{[^}]*outline:/);
        // outline: 0 is allowed only where another visible focus style replaces it (menu item has its own :focus-visible, the input sits in .field__control)
        for (const m of components.matchAll(/([^{}]+)\{[^}]*outline:\s*0\s*;[^}]*\}/g)) {
            const selector = m[1].trim();
            assert.ok(/\.menu__item:focus$|\.field__input$/.test(selector), `${selector} removes the outline`);
        }
    });

    test('animations are all covered by the reduced-motion rule in base.css', () => {
        assert.match(base, /prefers-reduced-motion: reduce[\s\S]*animation-duration[\s\S]*transition-duration/);
        assert.ok(!/animation:[^;]*\binfinite\b/.test(components) || /spinner|progress/.test(components));
    });
});

describe('architecture boundary', () => {
    test('components import only each other and the icon module', () => {
        for (const file of jsFiles) {
            const src = fs.readFileSync(path.join(COMPONENTS, file), 'utf8');
            for (const m of src.matchAll(/(?:import|export)[^'"]*from\s+'([^']+)'/g)) {
                assert.match(m[1], /^\.\/[a-z-]+\.js$|^\.\.\/icons\/icons\.js$/, `${file} imports ${m[1]}`);
            }
        }
    });

    test('components never touch the engine, the bridge or storage', () => {
        for (const file of jsFiles) {
            const src = fs.readFileSync(path.join(COMPONENTS, file), 'utf8');
            assert.doesNotMatch(src, /desktopApi|electronAPI|require\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest|eval\(|new Function/, file);
        }
    });

    test('no component writes user text with innerHTML (only our own icon markup)', () => {
        for (const file of jsFiles) {
            const src = fs.readFileSync(path.join(COMPONENTS, file), 'utf8');
            const uses = src.split('\n').filter((l) => /innerHTML|insertAdjacentHTML|outerHTML/.test(l));
            assert.ok(file === 'dom.js' ? uses.length === 1 : uses.length === 0, `${file}: ${uses.join(' | ')}`);
        }
    });
});

describe('index.js', () => {
    test('exports the public API and every component file is reachable from it', async () => {
        const index = await import(pathToFileURL(path.join(COMPONENTS, 'index.js')).href);
        for (const name of ['button', 'iconButton', 'chip', 'chipGroup', 'setLoading', 'textField', 'tabs', 'segmented', 'attachTooltip', 'hideTooltip', 'createToaster', 'statusIndicator', 'progress', 'openDialog', 'confirmDialog', 'openMenu', 'emptyState', 'el', 'iconEl']) {
            assert.equal(typeof index[name], 'function', name);
        }
        const src = fs.readFileSync(path.join(COMPONENTS, 'index.js'), 'utf8');
        for (const file of jsFiles.filter((f) => f !== 'index.js')) assert.ok(src.includes(`./${file}`), `${file} is not exported from index.js`);
    });

    test('importing the module does not need a DOM', async () => {
        assert.equal(typeof document, 'undefined');
        await import(pathToFileURL(path.join(COMPONENTS, 'index.js')).href);
    });
});

describe('build', () => {
    test('the build copies the whole ui-next folder, so components/ ships', () => {
        const py = fs.readFileSync(path.join(ROOT, 'build', 'music_player.py'), 'utf8');
        assert.match(py, /ui-next/);
        assert.match(py, /copytree|shutil\.copy/);
    });
});
