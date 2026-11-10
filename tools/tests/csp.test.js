'use strict';

// The Content-Security-Policy of the pages (task 6.2 of .agent/archive/dev-plan/DEV-PLAN.md), checked without a browser: the same policy is in both pages,
// it says what the plan says, and the pages hold nothing it would block (no inline script, no inline handler, no eval).
// tools/tests/csp-browser.test.js checks the same in a real browser.
//
// Run:   node --test tools/tests/csp.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

// Why each part: the renderer makes no web requests of its own (lyrics, metadata and downloads run in the main process), so connect-src is
// 'self' and nothing else. Pages and dialogs use inline style attributes, so styles allow 'unsafe-inline' and scripts never do. Covers and
// the audio files are file: URLs, covers can also be data: or blob:. "Play from URL" streams from the web, hence https: for media only.
const POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: file:; media-src 'self' blob: file: https: xplayer-media:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'none'; form-action 'none'";

function parse(policy) {
    const out = {};
    for (const part of policy.split(';').map((p) => p.trim()).filter(Boolean)) {
        const [name, ...values] = part.split(/\s+/);
        out[name] = values;
    }
    return out;
}

function metaPolicies(html) {
    return [...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/g)].map((m) => m[1]);
}

const PAGES = { 'src/ui-next/index.html': read('src', 'ui-next', 'index.html'), 'src/old-ui/music_player.template.html': read('src', 'old-ui', 'music_player.template.html') };

describe('the policy in the pages', () => {
    for (const [name, html] of Object.entries(PAGES)) {
        test(`${name} has the policy once, as the first thing after the charset`, () => {
            assert.deepEqual(metaPolicies(html), [POLICY]);
            const at = html.indexOf('Content-Security-Policy');
            for (const before of ['<script', '<link', '<style', '<title']) assert.ok(html.indexOf(before) === -1 || html.indexOf(before) > at, `${before} comes before the policy`);
        });
    }

    test('the page the old interface is made into has it too (tools/dev/gen-web.js copies the template)', () => {
        const { generated } = require('../dev/gen-web');
        const page = generated().find(([file]) => file.endsWith('music_player.html'));
        assert.deepEqual(metaPolicies(String(page[1])), [POLICY]);
    });

    test('the loading window (a data: page of the main process) has a policy of its own that allows no script and no network', () => {
        const { loadingPageHtml } = require('../../electron/loading-page');
        for (const next of [false, true]) {
            const html = loadingPageHtml(next);
            const [policy] = metaPolicies(html);
            assert.deepEqual(parse(policy), { 'default-src': ["'none'"], 'style-src': ["'unsafe-inline'"], 'img-src': ['data:'] });
            assert.doesNotMatch(html, /<script|<link|<img[^>]*src="http|url\(\s*["']?http/);
        }
    });
});

describe('what the policy says', () => {
    const p = parse(POLICY);

    test('scripts come from files of the page only: no inline, no eval, nothing from the web', () => {
        assert.deepEqual(p['script-src'], ["'self'"]);
        assert.ok(!POLICY.includes("'unsafe-eval'") && !POLICY.includes('wasm-unsafe-eval'));
        assert.ok(!/(^|[\s;])\*([\s;]|$)/.test(POLICY), 'no wildcard');
    });

    test('nothing is fetched from the page: connect-src is the page itself', () => {
        assert.deepEqual(p['connect-src'], ["'self'"]);
    });

    test('plugins, frames, forms and a changed base are shut', () => {
        assert.deepEqual(p['object-src'], ["'none'"]);
        assert.deepEqual(p['frame-src'], ["'none'"]);
        assert.deepEqual(p['form-action'], ["'none'"]);
        assert.deepEqual(p['base-uri'], ["'self'"]);
    });

    test('the web is allowed for media only (Play from URL), never for images, fonts, styles or scripts', () => {
        for (const name of Object.keys(p)) {
            const web = p[name].some((v) => v === 'https:' || v === 'http:' || /^https?:\/\//.test(v));
            assert.equal(web, name === 'media-src', `${name}`);
        }
    });

    test("'unsafe-inline' is for styles only", () => {
        const withInline = Object.keys(p).filter((n) => p[n].includes("'unsafe-inline'"));
        assert.deepEqual(withInline, ['style-src']);
    });
});

describe('the pages hold nothing the policy blocks', () => {
    test('every script is a file of the page: no inline body, no address on the web', () => {
        for (const [name, html] of Object.entries(PAGES)) {
            for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
                const src = /\bsrc="([^"]*)"/.exec(m[1]);
                assert.ok(src, `${name}: an inline <script> (${m[2].trim().slice(0, 50)}...)`);
                assert.equal(m[2].trim(), '', `${name}: <script src="${src[1]}"> also has a body`);
                assert.doesNotMatch(src[1], /^(https?:)?\/\//, `${name}: ${src[1]} is on the web`);
            }
        }
    });

    test('no inline handler attribute in the pages (src/js is checked by ui-handlers.test.js)', () => {
        for (const [name, html] of Object.entries(PAGES)) assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, name);
    });

    test('the new page mounts the engine elements from a file, not from an inline module', () => {
        assert.match(PAGES['src/ui-next/index.html'], /<script type="module" src="ui-next\/startup\/mount-legacy-dom\.js"><\/script>/);
        assert.match(read('src', 'ui-next', 'startup', 'mount-legacy-dom.js'), /mountLegacyDom\(\);/);
    });

    test('no page code calls eval, new Function, a string setTimeout/setInterval or a javascript: address', () => {
        const offenders = [];
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                const rel = path.relative(ROOT, full).split(path.sep).join('/');
                if (entry.isDirectory()) { if (!['fonts', 'icons', 'dev'].includes(entry.name) && rel !== 'src/ui-next/dev') walk(full); continue; }
                if (!/\.(js|html)$/.test(entry.name) || entry.name === 'player.js' || entry.name === 'music_player.html') continue;
                const code = fs.readFileSync(full, 'utf8').split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
                if (/(^|[^\w.$])eval\s*\(|new\s+Function\s*\(|set(Timeout|Interval)\(\s*["'`]|javascript:/.test(code)) offenders.push(rel);
            }
        };
        walk(path.join(ROOT, 'src'));
        assert.deepEqual(offenders, []);
    });

    test('the window code does not loosen the policy: no webSecurity off, no insecure content, no CSP header rewrite', () => {
        const code = fs.readdirSync(path.join(ROOT, 'electron')).filter((f) => f.endsWith('.js')).map((f) => read('electron', f)).join('\n');
        assert.doesNotMatch(code, /webSecurity\s*:\s*false|allowRunningInsecureContent\s*:\s*true|nodeIntegration\s*:\s*true/);
        assert.doesNotMatch(code, /onHeadersReceived[\s\S]{0,200}Content-Security-Policy/i);
    });
});
