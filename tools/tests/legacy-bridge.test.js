'use strict';

// Tests for core/legacy.js, the bridge that lets inline on...= handlers keep working while files
// become modules, and runs data-action elements through one delegated listener.
//
//   - static checks (no browser): every data-action name written in the source is registered
//   - browser checks (Playwright, skipped if it is missing): real clicks in the real app page

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const JS_DIR = path.join(ROOT, 'src', 'js');

function listJs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? listJs(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);
}

describe('data-action names written in the source are all registered', () => {
    const acorn = require('acorn');
    const walk = require('acorn-walk');
    const files = listJs(JS_DIR).filter((f) => path.basename(f) !== 'legacy.js');
    const registered = new Set();
    const used = []; // { file, name }
    const dynamic = [];

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        // 99-player.js is a template with {{placeholders}}; make it parseable.
        const ast = acorn.parse(require('../lib/strip-exports').stripExports(source).replace(/\{\{[A-Z_]+\}\}/g, 'null'), { ecmaVersion: 'latest', sourceType: 'script' });
        walk.simple(ast, {
            CallExpression(node) {
                if (node.callee.type !== 'Identifier') return;
                if (node.callee.name === 'registerActions' && node.arguments[0] && node.arguments[0].type === 'ObjectExpression') {
                    for (const p of node.arguments[0].properties) {
                        if (p.type === 'Property') registered.add(p.key.name || p.key.value);
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
    const html = fs.readFileSync(path.join(ROOT, 'build', 'music_player.html'), 'utf8');
    for (const m of html.matchAll(/data-action(?:-[a-z]+)?="([^"]*)"/g)) used.push({ file: 'build/music_player.html', name: m[1] });

    test('action names are literal, so this check can verify them', () => {
        assert.deepEqual(dynamic, [], 'use a fixed name in data-action; put the variable part in data-args');
    });

    test('every data-action name has a registerActions entry', () => {
        const missing = used.filter((u) => !registered.has(u.name)).map((u) => `${path.relative(ROOT, u.file)}: ${u.name}`);
        assert.deepEqual(missing, []);
    });
});

describe('legacy bridge in the real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;
    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(20);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    async function openPage() {
        const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
        const errors = [];
        const consoleErrors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(700);
        return { page, errors, consoleErrors };
    }

    // Runs `body` in the page with a fresh container element `box` and a log array `log`.
    async function inPage(page, body) {
        return page.evaluate(`(async () => {
            window.__log = [];
            const box = document.createElement('div');
            box.id = 'bridge-box';
            document.body.appendChild(box);
            ${body}
        })()`);
    }

    test('the page loads with the bridge and its API is on window', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const types = await page.evaluate(() => [typeof registerLegacyGlobals, typeof registerActions, typeof actionAttrs, typeof legacyGlobalNames, typeof registeredActionNames]);
        assert.deepEqual(types, ['function', 'function', 'function', 'function', 'function']);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a data-action click calls the registered action with its args, this and window.event', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await inPage(page, `
            registerActions({ probeClick(a, b) { __log.push({ a, b, thisId: this.id, ev: window.event && window.event.type }); } });
            box.innerHTML = '<button id="b1" data-action="probeClick" data-args=\\'["x", 7]\\'>go</button>';
            document.getElementById('b1').click();
            return __log;
        `);
        assert.deepEqual(result, [{ a: 'x', b: 7, thisId: 'b1', ev: 'click' }]);
        await page.close();
    });

    test('$this, $event, $value and $checked arguments are filled in at click time', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await inPage(page, `
            registerActions({ probeTokens(el, ev, v, c) { __log.push([el.id, ev.type, v, c]); } });
            box.innerHTML = '<input id="i1" type="checkbox" value="V" checked data-action-change="probeTokens" data-args-change=\\'["$this","$event","$value","$checked"]\\'>';
            const input = document.getElementById('i1');
            input.checked = false;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return __log;
        `);
        assert.deepEqual(result, [['i1', 'change', 'V', false]]);
        await page.close();
    });

    test('bubbling order: child, then parent; data-stop stops delegated parents; a failing handler does not stop them', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors } = await openPage();
        const result = await inPage(page, `
            registerActions({
                outer() { __log.push('outer'); },
                inner() { __log.push('inner'); },
                boom() { __log.push('boom'); throw new Error('handler failed'); }
            });
            box.innerHTML =
                '<div data-action="outer"><button id="a" data-action="inner">a</button></div>' +
                '<div data-action="outer"><button id="b" data-action="inner" data-stop>b</button></div>' +
                '<div data-action="outer"><button id="c" data-action="boom">c</button></div>';
            for (const id of ['a', 'b', 'c']) { __log.push('--' + id); document.getElementById(id).click(); }
            return __log;
        `);
        assert.deepEqual(result, ['--a', 'inner', 'outer', '--b', 'inner', '--c', 'boom', 'outer']);
        // the thrown error is reported, once, and nothing else broke
        assert.equal(errors.filter((e) => e.includes('handler failed')).length, 1);
        await page.close();
    });

    test('data-stop alone stops delegated parents, like an inline event.stopPropagation()', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await inPage(page, `
            registerActions({ outer2() { __log.push('outer2'); } });
            box.innerHTML = '<div data-action="outer2"><span id="s" data-stop>s</span></div>';
            document.getElementById('s').click();
            return __log;
        `);
        assert.deepEqual(result, []);
        await page.close();
    });

    test('data-stop also keeps the click from other listeners on document and window; without it they run', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await inPage(page, `
            const seen = [];
            document.addEventListener('click', () => seen.push('document'));
            window.addEventListener('click', () => seen.push('window'));
            box.innerHTML = '<span id="stopped" data-stop>a</span><span id="plain">b</span>';
            document.getElementById('stopped').click();
            const afterStopped = seen.slice();
            document.getElementById('plain').click();
            return [afterStopped, seen];
        `);
        assert.deepEqual(result, [[], ['document', 'window']]);
        await page.close();
    });

    test('a handler that returns false cancels the default action', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await inPage(page, `
            registerActions({ cancelIt() { return false; }, allowIt() {} });
            box.innerHTML = '<a id="l1" href="#cancelled" data-action="cancelIt">1</a><a id="l2" href="#allowed" data-action="allowIt">2</a>';
            document.getElementById('l1').click();
            const afterCancel = location.hash;
            document.getElementById('l2').click();
            return [afterCancel, location.hash];
        `);
        assert.deepEqual(result, ['', '#allowed']);
        await page.close();
    });

    test('other event types: change, input, contextmenu, dblclick, mousedown, keydown, blur', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await inPage(page, `
            registerActions({ seen(type) { __log.push(type); } });
            const types = { change: 'change', input: 'input', contextmenu: 'contextmenu', dblclick: 'dblclick', mousedown: 'mousedown', keydown: 'keydown', blur: 'blur' };
            box.innerHTML = '<input id="t" ' + Object.values(types).map((e) => 'data-action-' + e + '="seen" data-args-' + e + '=\\'["' + e + '"]\\'').join(' ') + '>';
            const el = document.getElementById('t');
            for (const e of ['change', 'input', 'contextmenu', 'dblclick', 'mousedown', 'keydown']) el.dispatchEvent(new Event(e, { bubbles: true, cancelable: true }));
            el.focus(); el.blur();
            return __log;
        `);
        assert.deepEqual(result, ['change', 'input', 'contextmenu', 'dblclick', 'mousedown', 'keydown', 'blur']);
        await page.close();
    });

    test('a failed image load reaches data-action-error (error does not bubble)', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await inPage(page, `
            registerActions({ imgFailed() { __log.push(this.id); }, parentErr() { __log.push('parent'); } });
            box.innerHTML = '<div data-action-error="parentErr"><img id="broken" data-action-error="imgFailed" src="file:///definitely/missing.png"></div>';
            await new Promise((r) => setTimeout(r, 400));
            return __log;
        `);
        assert.deepEqual(result, ['broken']);
        await page.close();
    });

    test('an unknown action name is reported in the console and nothing throws', async (t) => {
        if (skip) return void t.skip(skip);
        const { page, errors, consoleErrors } = await openPage();
        await inPage(page, `
            box.innerHTML = '<button id="u" data-action="noSuchAction">u</button>';
            document.getElementById('u').click();
        `);
        assert.deepEqual(errors, []);
        assert.ok(consoleErrors.some((m) => m.includes('noSuchAction')), consoleErrors.join(' | '));
        await page.close();
    });

    test('actionAttrs builds attributes that survive quotes, angle brackets and unicode', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const tricky = ['He said "hi" & \'bye\' <b>', 'Beyonc\u00e9 \u2013 \u65e5\u672c\u8a9e', 'a\\\\b'];
        const result = await page.evaluate(async (tricky) => {
            const log = [];
            registerActions({ probeAttrs(...args) { log.push(args); } });
            const box = document.createElement('div');
            box.innerHTML = `<button id="at" ${actionAttrs('probeAttrs', [...tricky, 3], { stop: true })}>x</button>` +
                `<input id="at2" ${actionAttrs('probeAttrs', ['$value'], { event: 'input' })} value="typed">`;
            document.body.appendChild(box);
            document.getElementById('at').click();
            document.getElementById('at2').dispatchEvent(new Event('input', { bubbles: true }));
            return { log, html: box.firstChild.outerHTML };
        }, tricky);
        assert.deepEqual(result.log, [[...tricky, 3], ['typed']]);
        assert.ok(result.html.includes('data-stop'));
        await page.close();
    });

    test('a bridged inline handler: a module registers a name and onclick="name()" calls it', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await inPage(page, `
            const code = 'const calls = []; function bridgedFromModule(n) { window.__log.push("module got " + n); } registerLegacyGlobals({ bridgedFromModule }); registerActions({ actionInModule() { window.__log.push("action, module-private"); } });';
            const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
            await import(url);
            box.innerHTML = '<button id="m1" onclick="bridgedFromModule(7)">m</button><button id="m2" data-action="actionInModule">n</button>';
            document.getElementById('m1').click();
            document.getElementById('m2').click();
            return { log: __log, onWindow: typeof window.bridgedFromModule, moduleNameLeaked: typeof window.actionInModule, listed: legacyGlobalNames().includes('bridgedFromModule') };
        `);
        assert.deepEqual(result, { log: ['module got 7', 'action, module-private'], onWindow: 'function', moduleNameLeaked: 'undefined', listed: true });
        await page.close();
    });

    test('registerLegacyGlobals and registerActions refuse a second, different definition of a name', async (t) => {
        if (skip) return void t.skip(skip);
        const { page } = await openPage();
        const result = await page.evaluate(() => {
            const out = {};
            const fn = () => 1;
            registerLegacyGlobals({ dupGlobal: fn });
            registerLegacyGlobals({ dupGlobal: fn }); // same value again: allowed
            try { registerLegacyGlobals({ dupGlobal: () => 2 }); out.global = 'accepted'; } catch (e) { out.global = 'refused'; }
            try { registerLegacyGlobals({ switchView: () => 0 }); out.classic = 'accepted'; } catch (e) { out.classic = 'refused'; }
            registerActions({ dupAction: fn });
            try { registerActions({ dupAction: () => 2 }); out.action = 'accepted'; } catch (e) { out.action = 'refused'; }
            try { registerActions({ notAFunction: 5 }); out.notFn = 'accepted'; } catch (e) { out.notFn = 'refused'; }
            try { registerLegacyGlobals({ 'bad name': fn }); out.badName = 'accepted'; } catch (e) { out.badName = 'refused'; }
            return out;
        });
        assert.deepEqual(result, { global: 'refused', classic: 'refused', action: 'refused', notFn: 'refused', badName: 'refused' });
        await page.close();
    });
});
