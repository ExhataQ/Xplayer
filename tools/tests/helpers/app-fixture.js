// Builds a throwaway copy of the real app (html/css/js from src/) with fake songs and a stubbed
// window.electronAPI, so UI logic can be tested in a headless browser. Shared by browser tests.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { renderTemplate } = require('./render-template');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..', '..');
const BROWSER_LAUNCH_TIMEOUT_MS = 2500;
const PH =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23555'/></svg>";

function loadPlaywright() {
    for (const c of ['playwright', path.join(ROOT, 'electron', 'node_modules', 'playwright'), path.join(ROOT, 'node_modules', 'playwright')]) {
        try {
            return require(c);
        } catch (_) {
            /* next */
        }
    }
    return null;
}

const BROWSER_OPTIONS = [{}, { channel: 'msedge' }, { channel: 'chrome' }];

// Every browser test file is its own process, so each one used to repeat the whole fallback (a failed
// launch can take several seconds). tools/tests/run.js sets XPLAYER_TEST_RUN_ID for one run; the files of
// that run share what the first one found. Without the variable (a single file started by hand) nothing is cached.
function launchCacheFile() {
    const id = process.env.XPLAYER_TEST_RUN_ID;
    return id ? path.join(os.tmpdir(), `xplayer-browser-${id}.json`) : null;
}

function readLaunchCache() {
    const file = launchCacheFile();
    if (!file) return null;
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) {
        return null;
    }
}

function writeLaunchCache(value) {
    const file = launchCacheFile();
    if (!file) return;
    try {
        fs.writeFileSync(file, JSON.stringify(value));
    } catch (_) {
        /* the cache only saves time */
    }
}

async function launch(pw) {
    if (!pw) return null;
    const cached = readLaunchCache();
    const order = BROWSER_OPTIONS.map((_, i) => i);
    if (cached && Number.isInteger(cached.index)) order.sort((a, b) => (a === cached.index ? -1 : b === cached.index ? 1 : a - b));
    for (const i of order) {
        try {
            const browser = await pw.chromium.launch({
                args: ['--allow-file-access-from-files'],
                timeout: BROWSER_LAUNCH_TIMEOUT_MS,
                ...BROWSER_OPTIONS[i]
            });
            writeLaunchCache({ available: true, index: i });
            return browser;
        } catch (_) {
            /* next */
        }
    }
    // A total failure is deliberately NOT cached: a one-off failure must not skip every later browser file.
    return null;
}

// Counts the app's own pending setTimeout calls that are shorter than 900 ms (cleared ones do not count).
// Runs inside the page before any app script. The 900 ms limit is the longest fixed wait the tests used
// to rely on: a timer longer than that was never waited for.
function trackStartupTimers() {
    const pending = new Map();
    const byHandle = new Map();
    let nextId = 0;
    const realSet = window.setTimeout.bind(window);
    const realClear = window.clearTimeout.bind(window);
    window.setTimeout = (fn, ms, ...args) => {
        if (typeof fn !== 'function') return realSet(fn, ms, ...args);
        const id = ++nextId;
        pending.set(id, Number(ms) || 0);
        const handle = realSet(
            (...a) => {
                pending.delete(id);
                byHandle.delete(handle);
                return fn(...a);
            },
            ms,
            ...args
        );
        byHandle.set(handle, id);
        return handle;
    };
    window.clearTimeout = (handle) => {
        if (byHandle.has(handle)) {
            pending.delete(byHandle.get(handle));
            byHandle.delete(handle);
        }
        return realClear(handle);
    };
    window.__pendingStartupTimers = () => [...pending.values()].filter((ms) => ms < 900).length;
}

// Resolves when the page has finished loading, fonts are ready and no short app timer is pending for two
// frames in a row. maxMs keeps the old behaviour as a ceiling: after that it simply continues.
async function waitForAppSettled(page, maxMs = 3000) {
    await page.evaluate(async (limit) => {
        const start = performance.now();
        if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', r, { once: true }));
        await document.fonts.ready;
        let quietFrames = 0;
        while (quietFrames < 2 && performance.now() - start < limit) {
            await new Promise((r) => requestAnimationFrame(r));
            const pending = typeof window.__pendingStartupTimers === 'function' ? window.__pendingStartupTimers() : 0;
            quietFrames = pending === 0 ? quietFrames + 1 : 0;
        }
    }, maxMs);
}

// Opens the built fixture app and waits until its start-up has settled (replaces goto + waitForTimeout(N)).
async function gotoApp(page, dir, { maxMs } = {}) {
    await page.addInitScript(trackStartupTimers);
    await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
    await waitForAppSettled(page, maxMs);
}

function buildApp(songCount = 50) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), `apptest-${songCount}-`));
    fs.cpSync(path.join(ROOT, 'src', 'css'), path.join(out, 'css'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'src', 'js'), path.join(out, 'js'), { recursive: true });
    const fonts = path.join(ROOT, 'src', 'assets', 'fonts');
    if (fs.existsSync(fonts)) fs.cpSync(fonts, path.join(out, 'fonts'), { recursive: true });
    const songs = Array.from({ length: songCount }, (_, i) => ({
        id: i + 1, title: `Song title number ${i + 1}`, artist: `Artist ${i % 97}`, album: `Album ${i % 211}`,
        duration: 180 + (i % 120), path: `C:/m/${i}.mp3`, url: `file:///music/${i + 1}.mp3`, cover: PH, largeCover: PH, year: 2000 + (i % 25), genre: 'Pop', trackNumber: (i % 12) + 1
    }));
    const tpl = fs.readFileSync(path.join(ROOT, 'src', 'js', '99-player.js'), 'utf8');
    fs.writeFileSync(path.join(out, 'player.js'), tpl.replace('{{SONGS_DATA}}', () => JSON.stringify(songs)).replace('{{PLACEHOLDER_IMAGE}}', () => PH.replace(/'/g, "\\'")));
    let html = fs.readFileSync(path.join(ROOT, 'build', 'music_player.html'), 'utf8');
    html = renderTemplate(html, ROOT);
    html = html.replace('{{SONGS_COUNT}}', String(songCount)).split('{{PLACEHOLDER_IMAGE}}').join(PH);
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    html = html.replace('<script src="js/00-state.js">', stub + '<script src="js/00-state.js">');
    fs.writeFileSync(path.join(out, 'index.html'), html);
    return out;
}

module.exports = { ROOT, loadPlaywright, launch, buildApp, gotoApp, waitForAppSettled, launchCacheFile };
