'use strict';

// B8 (stable sizes): opens the real app in a browser, puts items into each state (hover, keyboard focus, pressed, selected, playing) and
// measures them before and after: the size of the box, the number of text lines, the place of the first text, the font. Anything that
// moves is listed. That list is the work list of B8; once it is empty the same measurement becomes the guard test.
//
//   node tools/dev/measure-states.js                run every scenario, print what moves
//   node tools/dev/measure-states.js --write        also write .agent/STATE-SIZE-MEASURED.md
//   node tools/dev/measure-states.js --only lyrics  run only the scenarios whose name contains the word
//   node tools/dev/measure-states.js --strict       exit 1 when anything moved, could not be measured or did not run (for later, as a test)
//
// Needs: npm i -D playwright (and a browser: npx playwright install chromium), the same as the other browser tests.
// A scenario that cannot run says why and the others go on, so one broken set-up never hides the rest.
// The playing line in the lyrics is put in its state the way the engine does it (ui 11a: it only adds the classes synced-active and synced-past).

const fs = require('fs');
const path = require('path');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('../tests/helpers/app-fixture');

const OUT = path.join(ROOT, '.agent', 'STATE-SIZE-MEASURED.md');
const TOLERANCE = 0.5; // px: below this a difference is rounding, not movement
const STUB = `<script>window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : (...a) => (/^on[A-Z]/.test(String(k)) ? () => {} : Promise.resolve(null))) });</script>\n`;

const LONG = 'A long line of lyrics that is written to run close to the end of the row so that any change of the text width pushes a word onto a second row';
const PLAIN = 'Verse one line a\nVerse one line b\n\nChorus line a\nChorus line b';
const LRC = [`[00:01.00]${LONG}`, '[00:05.00]Short line', `[00:09.00]${LONG} again`, '[00:13.00]Another short one', `[00:17.00]${LONG} and once more`].join('\n');

// ---------- what runs inside the page ----------

/** Measures one element: its box, and the box, text rows and font of every inner element that has text of its own. Run in the page. */
function measureInPage(el) {
    const box = el.getBoundingClientRect();
    const round = (n) => Math.round(n * 100) / 100;
    const inSubmenu = (node) => node.closest('.context-submenu') && !el.closest('.context-submenu'); // a submenu that opens on hover is another box
    const pathOf = (node) => {
        const parts = [];
        for (let n = node; n && n !== el; n = n.parentElement) {
            const index = [...n.parentElement.children].indexOf(n);
            parts.unshift(`${n.tagName.toLowerCase()}${n.classList[0] ? '.' + n.classList[0] : ''}[${index}]`);
        }
        return parts.join(' > ') || '(the item)';
    };
    const cells = {};
    for (const node of [el, ...el.querySelectorAll('*')]) {
        if (inSubmenu(node)) continue;
        const own = [...node.childNodes].filter((c) => c.nodeType === 3 && c.nodeValue.trim());
        if (!own.length) continue;
        const r = node.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // not drawn in this state: it appeared or went away, which is not movement
        const tops = new Set();
        for (const t of own) {
            const range = document.createRange();
            range.selectNodeContents(t);
            for (const q of range.getClientRects()) if (q.width > 0 && q.height > 0) tops.add(Math.round(q.top));
        }
        const cs = getComputedStyle(node);
        cells[pathOf(node)] = { x: round(r.left - box.left), y: round(r.top - box.top), w: round(r.width), h: round(r.height), lines: tops.size, font: [cs.fontSize, cs.fontWeight, cs.letterSpacing, cs.transform, cs.zoom || '1'].join(' / ') };
    }
    const cs = getComputedStyle(el);
    return { w: round(box.width), h: round(box.height), own: [cs.fontSize, cs.fontWeight, cs.transform, cs.zoom || '1'].join(' / '), cells };
}

const labelOf = (el) => (el.getAttribute('data-id') || el.id || el.textContent.replace(/\s+/g, ' ').trim().slice(0, 28) || el.className).toString();

// ---------- comparing ----------

// The one allowed swap (states-keep-size.test.js ALLOWED): the song number becomes a play mark. Its text goes to font-size 0, its box must stay.
const SWAPS = /song-number-item\[\d+\]$/;

function differences(before, after) {
    const out = [];
    const num = (name, x, y) => Math.abs(x - y) > TOLERANCE && out.push(`${name}: ${x} -> ${y}`);
    num('item width', before.w, after.w);
    num('item height', before.h, after.h);
    if (before.own !== after.own) out.push(`item font/transform: ${before.own} -> ${after.own}`);
    for (const key of Object.keys(before.cells)) {
        const x = before.cells[key];
        const y = after.cells[key];
        if (!y) continue; // not drawn after: the content was swapped (a number for a play mark), nothing around it moved
        const here = [];
        for (const [name, a, b] of [['x', x.x, y.x], ['y', x.y, y.y], ['width', x.w, y.w], ['height', x.h, y.h]]) if (Math.abs(a - b) > TOLERANCE) here.push(`${name} ${a} -> ${b}`);
        const swapped = SWAPS.test(key) && /^0px /.test(y.font); // the digit is hidden by design (a play mark takes its place); the box still may not move
        if (x.lines !== y.lines && !swapped) here.push(`text rows ${x.lines} -> ${y.lines}`);
        if (x.font !== y.font && !swapped) here.push(`font ${x.font} -> ${y.font}`);
        if (here.length) out.push(`${key}: ${here.join(', ')}`);
    }
    return out;
}

// ---------- the app ----------

async function openApp(browser, dir) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
    page.setDefaultTimeout(8000); // a broken set-up fails in seconds, not half a minute
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
    await waitForAppSettled(page, 3000);
    return { page, errors };
}

async function reset(page) {
    await page.mouse.up().catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.mouse.move(2, 2);
    await page.waitForTimeout(60);
}

/**
 * Measures until two readings in a row agree (the list draws in steps, images and fonts arrive). Returns { value, steady }. `steady` false means
 * the item never stopped changing by itself: then a before/after comparison would only measure that noise, so the caller reports it as unstable.
 */
async function measureSteady(page, handle) {
    let last = await handle.evaluate(measureInPage).catch(() => null);
    if (!last) return { value: null, steady: false };
    for (let k = 0; k < 12; k++) {
        await page.waitForTimeout(150);
        const now = await handle.evaluate(measureInPage).catch(() => null);
        if (!now) return { value: null, steady: false };
        if (!differences(last, now).length) return { value: now, steady: true };
        last = now;
    }
    return { value: last, steady: false };
}

const quote = (id) => String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Measures each of the first `limit` elements of `selector` idle and in each state. Returns the findings, each with a kind:
 *   moved       the item changed size, text rows, text place or font in the state (the B8 work list)
 *   unstable    the item changes by itself with no state (idle against idle): it cannot be judged until that is fixed
 *   unmeasured  the item could not be found or measured: never counted as "nothing moved"
 * Rows are found again by their data-id after every state, because a state (playing) redraws the list and a position then means another row.
 */
async function measureItems(page, scenario) {
    const findings = [];
    const add = (item, state, kind, diff) => findings.push({ scenario: scenario.name, item, state, kind, diff });
    const limit = scenario.limit || 6;
    const count = Math.min(await page.locator(scenario.selector).count(), limit);
    if (!count) throw new Error(`no element matches ${scenario.selector}`);
    const ids = await page.$$eval(scenario.selector, (els, n) => els.slice(0, n).map((e) => e.getAttribute('data-id')), count);
    const find = (i) => (ids[i] ? page.locator(`${scenario.selector}[data-id="${quote(ids[i])}"]`).first() : page.locator(scenario.selector).nth(i)); // first(): a redraw can briefly hold two nodes with one id, and a strict locator then fails at once
    const reacquire = async (i) => {
        const end = Date.now() + 3000;
        while (Date.now() < end) {
            const handle = await find(i).elementHandle({ timeout: 300 }).catch(() => null);
            if (handle) return handle;
            await page.waitForTimeout(150);
        }
        return null;
    };
    const acquire = async (i) => {
        for (let attempt = 0; attempt < 3; attempt++) {
            if (scenario.toTop) await scenario.toTop(page);
            const item = find(i);
            const handle = await item.elementHandle({ timeout: 2500 }).catch(() => null);
            if (handle) {
                await item.scrollIntoViewIfNeeded().catch(() => {});
                return { item, handle };
            }
            await reset(page);
            if (scenario.prepare) await scenario.prepare(page); // the list was redrawn (a state did it): set it up again, then look again
        }
        return null;
    };
    for (let i = 0; i < count; i++) {
        for (const state of scenario.states) {
            await reset(page);
            if (scenario.keepOpen) await scenario.prepare(page); // the reset closes a menu: open it again for each measurement
            const got = await acquire(i);
            const name = ids[i] ? `#${i} (id ${ids[i]})` : `#${i}`;
            if (!got) {
                add(name, state, 'unmeasured', ['not found, even after setting the list up again']);
                continue;
            }
            const { item, handle } = got;
            const label = await handle.evaluate(labelOf).catch(() => '');
            const idle = await measureSteady(page, handle); // the control: idle against idle, no state yet
            if (!idle.value) {
                add(`${name} ${label}`.trim(), state, 'unmeasured', ['the item went away while it was being measured idle']);
                continue;
            }
            if (!idle.steady) {
                add(`${name} ${label}`.trim(), state, 'unstable', ['changes by itself with no state (idle against idle): not a state problem, measured as noise']);
                continue;
            }
            const before = idle.value;
            if (state === 'hover') await item.hover();
            else if (state === 'focus') await handle.evaluate((el) => el.focus({ focusVisible: true }));
            else if (state === 'pressed') {
                await item.hover();
                await page.mouse.down();
            } else if (state === 'selected') await item.click();
            else if (state === 'playing') await scenario.play(page, i);
            await page.waitForTimeout(scenario.settle || 120); // transitions end
            const alive = await handle.evaluate((el) => el.isConnected).catch(() => false);
            const target = alive ? handle : await reacquire(i);
            const after = target ? await target.evaluate(measureInPage).catch(() => null) : null;
            if (!after) {
                const rows = await page.locator(scenario.selector).count().catch(() => -1);
                add(`${name} ${label}`.trim(), state, 'unmeasured', [`the item was not there for 3 s after the state (rows now matching the selector: ${rows})`]);
                continue;
            }
            const diff = differences(before, after);
            if (diff.length) add(`${name} ${label}`.trim(), state, 'moved', diff);
        }
    }
    await reset(page);
    return findings;
}

// The lyrics: every line is measured with no line active, then with each line in turn as the playing one (as the engine does).
async function measureLyrics(page, scenario) {
    const findings = [];
    const lines = page.locator(scenario.selector);
    const n = await lines.count();
    if (!n) throw new Error(`no element matches ${scenario.selector}`);
    const all = () => page.evaluate(([sel, fn]) => [...document.querySelectorAll(sel)].map((el) => new Function(`return (${fn})`)()(el)), [scenario.selector, measureInPage.toString()]);
    if (n < 2) throw new Error(`only ${n} line(s) match ${scenario.selector}`);
    const [activeClass, pastClass] = scenario.classes || ['synced-active', 'synced-past'];
    const setActive = (k) =>
        page.evaluate(([sel, k, active, past]) => {
            const els = [...document.querySelectorAll(sel)];
            els.forEach((el, i) => {
                el.classList.toggle(active, i === k);
                el.classList.toggle(past, k >= 0 && i < k);
            });
        }, [scenario.selector, k, activeClass, pastClass]);
    await setActive(-1);
    await page.waitForTimeout(300);
    const idle = await all();
    for (let k = 0; k < n; k++) {
        await setActive(k);
        await page.waitForTimeout(scenario.settle || 400); // opacity and colour transitions (0.25 s)
        const now = await all();
        idle.forEach((before, i) => {
            const diff = differences(before, now[i]);
            if (diff.length) findings.push({ scenario: scenario.name, item: `line ${i}${i === k ? ' (the playing one)' : ''} while line ${k} plays`, state: 'playing', kind: 'moved', diff });
        });
    }
    await setActive(-1);
    // hover over each non-empty line
    for (let i = 0; i < n; i++) {
        const txt = await lines.nth(i).evaluate((el) => el.textContent.trim());
        if (!txt) continue;
        await reset(page);
        const before = (await all())[i];
        await lines.nth(i).hover();
        await page.waitForTimeout(300);
        const after = (await all())[i];
        const diff = differences(before, after);
        if (diff.length) findings.push({ scenario: scenario.name, item: `line ${i}`, state: 'hover', kind: 'moved', diff });
    }
    // click (selects the line and seeks): measured with the pointer still on it
    for (let i = 0; i < n; i++) {
        const txt = await lines.nth(i).evaluate((el) => el.textContent.trim());
        if (!txt) continue;
        await reset(page);
        const before = (await all())[i];
        await lines.nth(i).click().catch(() => {});
        await page.waitForTimeout(400);
        const after = (await all())[i];
        const diff = differences(before, after);
        if (diff.length) findings.push({ scenario: scenario.name, item: `line ${i}`, state: 'clicked', kind: 'moved', diff });
    }
    return findings;
}

// ---------- scenarios ----------

const playSong = (page, id) =>
    page.evaluate((songId) => {
        window.playSongFromList(songId);
    }, id);

const SCENARIOS = [
    {
        name: 'Song list rows',
        selector: '#song-list .song-item:not(.lazy-skeleton)',
        states: ['hover', 'focus', 'pressed', 'selected', 'playing'],
        toTop: (page) => page.evaluate(() => document.querySelectorAll('#song-list, #song-list-container, .song-list-scroll').forEach((e) => { e.scrollTop = 0; })),
        prepare: async (page) => {
            await page.evaluate(() => window.switchView(VIEWS.ALL_SONGS));
            await page.waitForSelector('#song-list .song-item:not(.lazy-skeleton)', { timeout: 6000 });
            await page.waitForTimeout(800); // the list draws in steps
        },
        play: async (page, i) => playSong(page, await page.locator('#song-list .song-item:not(.lazy-skeleton)').nth(i).getAttribute('data-id').then((v) => Number(v) || i + 1))
    },
    { name: 'Library panel rows', selector: '.library-panel .left-panel-main-item', states: ['hover', 'focus', 'pressed', 'selected'] },
    {
        name: 'Song menu rows',
        selector: '#context-menu .context-menu-item',
        states: ['hover', 'focus'],
        prepare: async (page) => {
            await page.locator('#song-list .song-item:not(.lazy-skeleton)').first().click({ button: 'right' });
            await page.waitForSelector('#context-menu .context-menu-item', { timeout: 4000 });
        },
        keepOpen: true
    },
    {
        name: 'Lyrics lines (right panel)',
        kind: 'lyrics',
        selector: '.rp-now__lyrics .rp-line:not(.rp-line--empty)',
        classes: ['rp-line--active', 'rp-line--past'], // what right-panel-content.js toggles
        prepare: async (page) => {
            await page.evaluate(() => localStorage.setItem('xplayer.ui-next.right-open', 'true')); // the test browser starts with it closed
            await page.reload();
            await waitForAppSettled(page, 3000);
            await page.evaluate(([plain, lrc]) => {
                const s = window.SONGS_DATA[0];
                s.duration = '03:00.00';
                window.setLyricsForSong(s.id, plain);
                window.addSyncedLyricsVariant(s.id, lrc, 0);
                window.playSongFromList(s.id);
            }, [PLAIN, LRC]);
            try {
                await page.waitForSelector('.rp-now__lyrics .rp-line', { timeout: 10000 });
            } catch (e) {
                // Say what is on the page instead of just timing out, so the set-up can be put right from this report.
                const seen = await page.evaluate(() => ({ open: localStorage.getItem('xplayer.ui-next.right-open'), panel: Boolean(document.querySelector('.rp-now')), box: Boolean(document.querySelector('.rp-now__lyrics')), lines: document.querySelectorAll('.rp-now__lyrics > *').length, note: (document.querySelector('.rp-now__note') || {}).textContent || '', playing: typeof window.playbackQueue !== 'undefined' && window.currentQueueIndex }));
                throw new Error(`no lyrics lines in the right panel (open key ${seen.open}, panel ${seen.panel}, lyrics box ${seen.box}, ${seen.lines} children, note "${seen.note}", queue index ${seen.playing})`);
            }
        }
    },
    {
        name: 'Lyrics lines (View page)',
        kind: 'lyrics',
        selector: '.lyrics-view-text .lyrics-line',
        prepare: async (page) => {
            await page.evaluate(([plain, lrc]) => {
                const s = window.SONGS_DATA[0];
                s.duration = '03:00.00';
                window.setLyricsForSong(s.id, plain);
                window.addSyncedLyricsVariant(s.id, lrc, 0);
                window.playSongFromList(s.id);
                window.switchView('lyrics');
            }, [PLAIN, LRC]);
            try {
                await page.waitForSelector('.lyrics-view-text .lyrics-line', { timeout: 10000 });
            } catch (e) {
                const seen = await page.evaluate(() => ({ view: typeof window.currentView === 'undefined' ? 'unknown' : window.currentView, root: Boolean(document.getElementById('lyrics-view-root')), text: document.querySelectorAll('.lyrics-view-text').length, lines: document.querySelectorAll('.lyrics-line').length, host: [...document.querySelectorAll('.view-host')].map((h) => h.dataset.engine || h.dataset.view || '?').join(',') }));
                throw new Error(`no lyrics lines on the View page (current view ${seen.view}, lyrics root ${seen.root}, .lyrics-view-text ${seen.text}, .lyrics-line ${seen.lines}, hosts ${seen.host})`);
            }
        }
    }
];

async function run() {
    const args = process.argv.slice(2);
    const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
    const pw = loadPlaywright();
    if (!pw) return fail('playwright is not installed (npm i -D playwright)');
    const browser = await launch(pw);
    if (!browser) return fail('no browser found (npx playwright install chromium)');
    const dir = buildApp(30);
    fs.cpSync(path.join(ROOT, 'src', 'ui-next'), path.join(dir, 'ui-next'), { recursive: true });
    const index = path.join(dir, 'ui-next', 'index.html');
    fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('<script src="../player.js">', () => STUB + '<script src="../player.js">'));

    const findings = [];
    const skipped = [];
    const ran = [];
    for (const scenario of SCENARIOS.filter((s) => !only || s.name.toLowerCase().includes(only.toLowerCase()))) {
        const { page, errors } = await openApp(browser, dir);
        try {
            if (scenario.prepare) await scenario.prepare(page);
            const found = scenario.kind === 'lyrics' ? await measureLyrics(page, scenario) : await measureItems(page, scenario);
            findings.push(...found);
            ran.push(scenario.name);
            if (errors.length) skipped.push(`${scenario.name}: page errors while measuring: ${errors.slice(0, 2).join('; ')}`);
        } catch (e) {
            skipped.push(`${scenario.name}: could not run (${String(e.message).split('\n')[0]})`);
        }
        await page.close();
    }
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });

    const text = render(findings, ran, skipped);
    process.stdout.write(text + '\n');
    if (args.includes('--write') || args.includes('-write')) {
        fs.writeFileSync(OUT, text + '\n');
        console.log(`Wrote ${path.relative(ROOT, OUT)}`);
    }
    if (args.includes('--strict') && (findings.length || skipped.length)) process.exit(1); // not measuring is not passing
}

function render(findings, ran, skipped) {
    const kindOf = (f) => f.kind || 'moved'; // a finding without a kind is a move
    const moved = findings.filter((f) => kindOf(f) === 'moved');
    const unstable = findings.filter((f) => kindOf(f) === 'unstable');
    const unmeasured = findings.filter((f) => kindOf(f) === 'unmeasured');
    const out = ['# State size measurement (generated, do not edit by hand)', ''];
    out.push('Made by `node tools/dev/measure-states.js --write`. Each row of the first table is an item that changed size, text lines, text place or font when it went into a state. B8 rule: none may.', '');
    out.push(`**${moved.length} things moved.** Scenarios run: ${ran.join(', ') || 'none'}.`, '');
    if (unstable.length || unmeasured.length || skipped.length) {
        out.push(`**Not a clean result:** ${unmeasured.length} could not be measured, ${unstable.length} change by themselves, ${skipped.length} scenario(s) did not run. "0 moved" means nothing until these are 0.`, '');
    }
    if (skipped.length) out.push('Not measured:', ...skipped.map((s) => `- ${s}`), '');
    const table = (title, rows) => {
        if (!rows.length) return;
        out.push(title, '', '| Scenario | Item | State | What |', '|---|---|---|---|');
        for (const f of rows) out.push(`| ${f.scenario} | ${f.item.replace(/\|/g, '/')} | ${f.state} | ${f.diff.join('; ').replace(/\|/g, '/')} |`);
        out.push('');
    };
    table('## Moved (the B8 work list)', moved);
    table('## Unstable (idle against idle already differs: fix this first, it hides the real result)', unstable);
    table('## Could not be measured', unmeasured);
    return out.join('\n').trimEnd();
}

function fail(reason) {
    console.error(reason);
    process.exit(2);
}

module.exports = { differences, render };

if (require.main === module) run().catch((e) => fail(String(e && e.stack ? e.stack : e)));
