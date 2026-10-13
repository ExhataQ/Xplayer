'use strict';

// The window contract: the names that classic code, the page template and the Electron main process reach by bare
// name have to be on window, because the renderer files are ES modules and publish them with registerLegacyGlobals /
// registerLegacyState (core/legacy.js). This is the one place that checks it. The lists are read from the sources,
// not written here, so adding a function to a module needs no change in this file.
//
//   - static checks (acorn, no browser): every data-action name is registered; a module registers only what it
//     declares; every exported name another file, the page template, 99-player.js or electron/ uses is registered by
//     the file that exports it; the shared constants and state objects are registered; every function an inline
//     on...= handler calls is registered
//   - one page load (Playwright, skipped if it is missing): no page error while loading, and the names the page
//     registered are exactly the names the sources register, each one on window with the right kind of value

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const { ROOT, loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');
const { readManifest } = require('../lib/manifest');
const { stripExports } = require('../lib/strip-exports');
const { WINDOW_PUBLISHED_GLOBALS } = require('../lint-globals');

const JS_DIR = path.join(ROOT, 'src', 'js');
const modules = readManifest(ROOT).modules;
const read = (file) => fs.readFileSync(path.join(JS_DIR, ...file.split('/')), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'build', 'music_player.html'), 'utf8');

// Constants and state objects that other files read by bare name. They are not exported, so the sources cannot say
// which of them other files use; they are listed here with the file that has to register each.
const REQUIRED_SHARED = {
    '05a-lazy-load-main-list.js': ['DEFAULT_VIRTUAL_SCROLL_THRESHOLD', 'MIN_VIRTUAL_SCROLL_THRESHOLD', 'MAX_VIRTUAL_SCROLL_THRESHOLD', 'ITEM_HEIGHT', 'virtualScrollState', 'VIRTUAL_SCROLL_SETTLE_MS'],
    '05b-lazy-load-left-panel.js': ['LEFT_ITEM_HEIGHT', 'LEFT_OVERSCAN_COUNT', 'leftPanelVirtualState'],
    '05c-lazy-load-smart-lyrics.js': ['SMART_LYRICS_ITEM_HEIGHT', 'smartLyricsVirtualState'],
    '07-views.js': ['VIEWS', 'listProviders'],
    '04a-ui-render-core.js': ['selectedSongIds']
};

// Values the classic code reads from window and relies on.
const REGISTERED_CONSTANTS = {
    MAX_RECENT_SONGS: 50,
    MAX_HISTORY_ENTRIES: 500,
    MAX_SEARCH_HISTORY: 20,
    CONTEXT_MENU_TYPE_LABELS: { playlist: 'Playlist', folder: 'Folder', album: 'Album', artist: 'Artist', special: 'Item' }
};

function listJs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? listJs(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);
}

// What each module declares at the top level and registers on window, read from its syntax tree.
const info = {};
for (const file of modules) {
    const ast = acorn.parse(read(file), { ecmaVersion: 'latest', sourceType: 'module' });
    const exportedFunctions = [];
    const exportedValues = [];
    const topLevelValues = [];
    const registered = [];
    for (const node of ast.body) {
        const d = node.type === 'ExportNamedDeclaration' ? node.declaration : null;
        if (d && d.type === 'FunctionDeclaration') exportedFunctions.push(d.id.name);
        else if (d && d.type === 'VariableDeclaration') exportedValues.push(...d.declarations.map((x) => x.id.name));
        else if (d && d.type === 'ClassDeclaration') exportedValues.push(d.id.name);
        else if (node.type === 'VariableDeclaration') topLevelValues.push(...node.declarations.map((x) => x.id.name));
        else if (node.type === 'ClassDeclaration') topLevelValues.push(node.id.name);
    }
    walk.simple(ast, {
        CallExpression(node) {
            if (node.callee.type !== 'Identifier' || !/^registerLegacy(Globals|State)$/.test(node.callee.name)) return;
            if (!node.arguments[0] || node.arguments[0].type !== 'ObjectExpression') return;
            for (const p of node.arguments[0].properties) if (p.type === 'Property') registered.push(p.key.name || p.key.value);
        }
    });
    info[file] = { exportedFunctions, exportedValues, topLevelValues, registered };
}
const allRegistered = new Set(modules.flatMap((f) => info[f].registered));

// Every word in a source, so "does another file use this name" is a lookup and not a scan.
const words = (text) => new Set(text.match(/[\w$]+/g));
const moduleWords = Object.fromEntries(modules.map((f) => [f, words(read(f))]));
const outsideWords = [html, read('99-player.js')];
for (const entry of fs.readdirSync(path.join(ROOT, 'electron'))) {
    if (entry.endsWith('.js')) outsideWords.push(fs.readFileSync(path.join(ROOT, 'electron', entry), 'utf8'));
}
const outsideSets = outsideWords.map(words);
const usedOutside = (file, name) => modules.some((m) => m !== file && moduleWords[m].has(name)) || outsideSets.some((set) => set.has(name));

describe('window contract: the sources', () => {
    const files = listJs(JS_DIR).filter((f) => path.basename(f) !== 'legacy.js');
    const registeredActions = new Set();
    const used = []; // { file, name }
    const dynamic = [];

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        // 99-player.js is a template with {{placeholders}}; make it parseable.
        const ast = acorn.parse(stripExports(source).replace(/\{\{[A-Z_]+\}\}/g, 'null'), { ecmaVersion: 'latest', sourceType: 'script' });
        walk.simple(ast, {
            CallExpression(node) {
                if (node.callee.type !== 'Identifier') return;
                if (node.callee.name === 'registerActions' && node.arguments[0] && node.arguments[0].type === 'ObjectExpression') {
                    for (const p of node.arguments[0].properties) {
                        if (p.type === 'Property') registeredActions.add(p.key.name || p.key.value);
                    }
                }
                if (node.callee.name === 'actionAttrs' && node.arguments[0]) {
                    if (node.arguments[0].type === 'Literal') used.push({ file, name: node.arguments[0].value });
                    else dynamic.push({ file, what: 'actionAttrs with a computed name' });
                }
            }
        });
        for (const m of source.matchAll(/data-action(?:-[a-z]+)?=\\?["']([^"'\\]*)/g)) {
            if (m[1].includes('${')) dynamic.push({ file, what: `data-action="${m[1]}"` });
            else used.push({ file, name: m[1] });
        }
    }
    for (const m of html.matchAll(/data-action(?:-[a-z]+)?="([^"]*)"/g)) used.push({ file: path.join(ROOT, 'build', 'music_player.html'), name: m[1] });

    test('action names are literal, so this check can verify them', () => {
        assert.deepEqual(dynamic, [], 'use a fixed name in data-action; put the variable part in data-args');
    });

    test('every data-action name has a registerActions entry', () => {
        const missing = used.filter((u) => !registeredActions.has(u.name)).map((u) => `${path.relative(ROOT, u.file)}: ${u.name}`);
        assert.deepEqual(missing, []);
    });

    test('a module registers only names it declares: an exported function or a top-level variable', () => {
        const problems = [];
        for (const file of modules) {
            const i = info[file];
            for (const name of i.registered) {
                if (!i.exportedFunctions.includes(name) && !i.exportedValues.includes(name) && !i.topLevelValues.includes(name)) problems.push(`${file}: ${name}`);
            }
        }
        assert.ok(allRegistered.size > 100, `expected well over 100 registered names, found ${allRegistered.size}`);
        assert.deepEqual(problems, [], 'registered, but not an exported function or a top-level variable of that file');
    });

    test('every exported name another file, the page template, 99-player.js or electron/ uses by bare name is registered by the file that exports it', () => {
        const missing = [];
        for (const file of modules) {
            for (const name of [...info[file].exportedFunctions, ...info[file].exportedValues]) {
                if (usedOutside(file, name) && !info[file].registered.includes(name)) missing.push(`${file}: ${name}`);
            }
        }
        assert.deepEqual(missing, [], 'used outside its file but not registered with registerLegacyGlobals');
    });

    test('the constants and state objects other files read by bare name are registered by their files', () => {
        const missing = [];
        for (const [file, names] of Object.entries(REQUIRED_SHARED)) {
            assert.ok(info[file], `${file} is listed in REQUIRED_SHARED but is not a module imported by src/js/main.js; update the list`);
            for (const name of names) if (!info[file].registered.includes(name)) missing.push(`${file}: ${name}`);
        }
        assert.deepEqual(missing, []);
    });

    test('every function an inline on...= handler calls is registered', () => {
        // Inline handlers are being converted to data-action; this finds the ones that are still written.
        const topLevel = new Set(modules.flatMap((f) => [...info[f].exportedFunctions, ...(read(f).match(/^(?:async\s+)?function (\w+)/gm) || []).map((s) => s.replace(/^(?:async\s+)?function /, ''))]));
        const called = new Set();
        for (const code of [html, ...modules.map(read)]) {
            for (const attr of code.matchAll(/\bon(?:click|dblclick|change|input|keydown|keyup|mousedown|mouseup|contextmenu|blur|focus|error|submit)=\\?["']([^"']*)["']/g)) {
                for (const call of attr[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) if (topLevel.has(call[1])) called.add(call[1]);
            }
        }
        assert.deepEqual([...called].filter((n) => !allRegistered.has(n)), []);
    });
});

describe('window contract: the real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, page, skip;
    const errors = [];
    let snapshot;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(5);
        page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        snapshot = await page.evaluate(({ names, published, constants }) => ({
            registered: legacyGlobalNames(),
            types: Object.fromEntries(names.map((n) => [n, typeof window[n]])),
            published: Object.fromEntries(published.map((n) => [n, typeof window[n]])),
            constants: Object.fromEntries(Object.keys(constants).map((n) => [n, window[n]]))
        }), { names: [...allRegistered], published: Object.keys(WINDOW_PUBLISHED_GLOBALS), constants: REGISTERED_CONSTANTS });
    });
    after(async () => {
        if (page) await page.close();
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    test('the page loads without a page error', async (t) => {
        if (skip) return void t.skip(skip);
        assert.deepEqual(errors, []);
    });

    test('the names the page registered are exactly the names the sources register', async (t) => {
        if (skip) return void t.skip(skip);
        const fromSources = [...allRegistered].sort();
        assert.deepEqual(snapshot.registered.filter((n) => !allRegistered.has(n)), [], 'registered in the page but not found in the sources');
        assert.deepEqual(fromSources.filter((n) => !snapshot.registered.includes(n)), [], 'registered in the sources but not in the page');
    });

    test('every exported function is a function on window, and every other registered name has a value', async (t) => {
        if (skip) return void t.skip(skip);
        const exported = new Set(modules.flatMap((f) => info[f].exportedFunctions));
        const wrong = Object.entries(snapshot.types)
            .filter(([name, type]) => (exported.has(name) ? type !== 'function' : type === 'undefined'))
            .map(([name, type]) => `${name} is ${type}`);
        assert.deepEqual(wrong, []);
    });

    test('names a file publishes by assigning window.<name> are functions on window', async (t) => {
        if (skip) return void t.skip(skip);
        assert.deepEqual(snapshot.published, Object.fromEntries(Object.keys(WINDOW_PUBLISHED_GLOBALS).map((n) => [n, 'function'])));
    });

    test('the registered constants keep the values the classic code relies on', async (t) => {
        if (skip) return void t.skip(skip);
        assert.deepEqual(snapshot.constants, REGISTERED_CONSTANTS);
    });
});
