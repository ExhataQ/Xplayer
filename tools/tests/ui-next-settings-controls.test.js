// The controls of the Settings page (Playback and every other section): a switch answers a click only on the switch, a slider shows the part up to its
// thumb, and a feature's settings sit under its switch and fade while it is off. views/tools/settings.css, views/tools/range-fill.js, js/ui/08e-panel-settings.js.
//
// Run:   node --test tools/tests/ui-next-settings-controls.test.js
// Needs: npm i -D playwright (the last describe only; the rest runs without a browser)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ROOT, loadPlaywright, launch, buildApp, waitForAppSettled } = require('./helpers/app-fixture');

const NEXT_SRC = path.join(ROOT, 'src', 'ui-next');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const css = strip(fs.readFileSync(path.join(NEXT_SRC, 'views', 'tools', 'settings.css'), 'utf8'));
const rule = (needle) => css.split('}').find((block) => block.includes(needle)) || '';

describe('settings controls: styles', () => {
    test('only the switch answers a click: the row does not, the switch does, and the switch has a larger place to click', () => {
        assert.match(rule('.settings-toggle-row {\n') || rule('.settings-toggle-row {\r\n'), /pointer-events:\s*none/);
        assert.match(rule(".settings-toggle-row input[type='checkbox'] {"), /pointer-events:\s*auto/);
        assert.match(rule(".settings-toggle-row input[type='checkbox']::before"), /inset:\s*-\d+px/);
        assert.doesNotMatch(css, /\.settings-toggle-row\s*{[^}]*cursor:\s*pointer/, 'the row is not a pointer: the switch is');
    });

    test('sliders: a track with an active part from --lo to --hi, a round thumb with a halo, no native accent-color', () => {
        const track = rule("input[type='range']::-webkit-slider-runnable-track");
        assert.match(track, /var\(--lo, 0\)/);
        assert.match(track, /var\(--hi, 0\)/);
        assert.match(rule("input[type='range']::-webkit-slider-thumb"), /border-radius:\s*var\(--radius-pill\)/);
        assert.match(rule("input[type='range']:hover {"), /--range-halo/);
        assert.doesNotMatch(css, /input\[type='range'\][^{]*{[^}]*accent-color/);
        assert.doesNotMatch(css, /scrollbar-width|scrollbar-color/, 'the scrollbar rule: never set these');
    });

    test('a feature groups its switch and its settings; the settings fade while the switch is off', () => {
        assert.match(rule('.settings-feature:has('), /opacity:\s*0\.5/);
        assert.match(rule('.settings-sub {'), /border-inline-start/);
    });

    test('tokens only: no raw colors in the file', () => {
        assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    });
});

describe('settings controls: smooth switch, sliders that are not clipped, icons, folder list', () => {
    test('the switch thumb glides: it moves with translate, stretches with width, and both are transitioned', () => {
        const thumb = rule(".settings-toggle-row input[type='checkbox']::after");
        assert.match(thumb, /transition:[^;]*translate[^;]*width/);
        assert.match(rule(".settings-toggle-row input[type='checkbox']:checked::after"), /translate:\s*14px 0/);
        assert.doesNotMatch(css, /settings-toggle-row input\[type='checkbox'\][^{]*{[^}]*transform:\s*translateX/, 'no jump: transform is not used for the thumb');
    });

    test('the slider dot reaches both ends of the track: the thumb is the 12px dot, its halo is a shadow, and the slider has room for it', () => {
        const thumb = rule("input[type='range']::-webkit-slider-thumb {");
        assert.match(thumb, /width:\s*var\(--range-thumb\)/);
        assert.match(thumb, /box-shadow:\s*0 0 0 var\(--range-halo-size\) var\(--range-halo\)/);
        assert.doesNotMatch(thumb, /border:\s*\d+px solid var\(--range-halo\)/, 'a halo border inside the thumb box leaves the dot 5px short of each end of the track');
        const control = rule(".settings-section input[type='range'] {");
        assert.match(control, /--range-thumb:\s*12px/);
        assert.match(control, /--range-halo-size:\s*5px/);
        assert.match(control, /padding:\s*0 var\(--range-halo-size\)/, 'room for the halo: a slider clips whatever it draws outside its own box');
        assert.match(control, /height:\s*24px/, 'the control is taller than its thumb');
    });

    test('every Font Awesome icon the folder list and the settings buttons use is drawn again; the rest stay hidden', () => {
        const used = new Set();
        for (const file of [['js', 'ui', '08e-panel-settings.js'], ['js', 'library', '03m-library-folder-render.js']]) {
            for (const m of fs.readFileSync(path.join(ROOT, 'src', ...file), 'utf8').matchAll(/fas (fa-[a-z-]+)/g)) used.add(m[1]);
        }
        const hiddenOnPurpose = new Set(['fa-circle', 'fa-sliders-h', 'fa-wand-magic-sparkles']); // the old theme swatches and the old interface switch: in blocks that are hidden
        for (const name of used) {
            if (hiddenOnPurpose.has(name)) continue;
            assert.match(css, new RegExp(`i\\.${name} {\\s*--fa-icon: url\\("data:image/svg\\+xml`), `${name} is drawn`);
        }
        assert.match(rule('i.fas {'), /display:\s*none/, 'any other icon stays hidden');
        assert.doesNotMatch(css, /--fa-icon:[^;]*#/, 'no raw color in an icon');
    });

    test('a folder row is a grid of name, path, songs and a remove button; a selected one shows an accent edge', () => {
        assert.match(rule('.library-location-item {'), /grid-template-columns:[^;]*auto 32px/);
        assert.match(rule('.library-location-item.selected {'), /inset 3px 0 0 var\(--accent\)/);
        assert.match(rule('.library-location-remove {'), /opacity:\s*0/);
        assert.match(rule('.library-location-item:is(:hover, .selected) .library-location-remove'), /opacity:\s*1/);
    });
});

describe('the folder list in the engine (03m-library-folder-render.js)', () => {
    const render = fs.readFileSync(path.join(ROOT, 'src', 'js', 'library', '03m-library-folder-render.js'), 'utf8');
    const settings = fs.readFileSync(path.join(ROOT, 'src', 'js', 'ui', '08e-panel-settings.js'), 'utf8');

    test('every folder row has its own remove button that does not also select the row', () => {
        assert.match(render, /<button type="button" class="library-location-remove"[^>]*data-stop[^>]*actionAttrs\('removeLibraryFolder', \[item\.folder\]\)/);
        assert.match(render, /export async function removeLibraryFolder\(folderPath\)/);
        assert.match(render, /removeLibraryFolders\(\[folderPath\]\)/);
        assert.match(render, /removeLibraryFolders\(\[\.\.\.selectedLibraryFolders\]\)/, 'the header button and the row button share one removal');
    });

    test('the action is registered, and the outside-click rule looks at the section of its own list', () => {
        assert.match(settings, /removeLibraryFolder: function \(\.\.\.args\)/);
        assert.match(render, /^\s*removeLibraryFolder,$/m);
        assert.match(render, /list\.closest\('\.library-locations-section'\)/);
        assert.doesNotMatch(render, /document\.querySelector\('\.library-locations-section'\)/, 'the first section of the page is not always the folders');
    });
});

describe('the filled part of a slider (range-fill.js)', () => {
    test('a slider fills from its start; one that crosses zero fills from its zero to the thumb', async () => {
        const { rangeFill } = await import(pathToFileURL(path.join(NEXT_SRC, 'views', 'tools', 'range-fill.js')).href);
        assert.deepEqual(rangeFill({ min: 0.5, max: 10, value: 0.5 }), { lo: 0, hi: 0 });
        assert.deepEqual(rangeFill({ min: 0, max: 10, value: 5 }), { lo: 0, hi: 0.5 });
        assert.deepEqual(rangeFill({ min: 0, max: 10, value: 10 }), { lo: 0, hi: 1 });
        assert.deepEqual(rangeFill({ min: -12, max: 12, value: 0 }), { lo: 0.5, hi: 0.5 });
        assert.deepEqual(rangeFill({ min: -12, max: 12, value: 6 }), { lo: 0.5, hi: 0.75 });
        assert.deepEqual(rangeFill({ min: -12, max: 12, value: -6 }), { lo: 0.25, hi: 0.5 });
        assert.deepEqual(rangeFill({ min: 0, max: 10, value: 99 }), { lo: 0, hi: 1 }, 'clamped');
        assert.deepEqual(rangeFill({ min: 5, max: 5, value: 5 }), { lo: 0, hi: 0 }, 'a track with no length');
    });
});

describe('the Playback section markup', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'js', 'ui', '08e-panel-settings.js'), 'utf8');
    const section = source.slice(source.indexOf('Playback & Audio</div>'), source.indexOf('${buildEqualizerSection()}'));

    test('five features, each a switch with its own settings under it', () => {
        assert.equal((section.match(/class="settings-feature"/g) || []).length, 5);
        assert.equal((section.match(/<label class="settings-toggle-row">/g) || []).length, 5);
        assert.equal((section.match(/settings-threshold-row settings-sub/g) || []).length, 5, 'crossfade, fade in, fade out lengths, gain mode, trim');
    });

    test('the settings keep every handler: the move into groups changed no attribute', () => {
        for (const action of ['setAudioPlaybackSetting', 'setAudioPlaybackDurationSetting', 'setReplayGainTrimSetting']) assert.ok(section.includes(action), action);
    });
});

describe('settings controls in the real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed (npm i -D playwright)');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found (npx playwright install chromium)');
        dir = buildApp(30);
        fs.cpSync(NEXT_SRC, path.join(dir, 'ui-next'), { recursive: true });
        const file = path.join(dir, 'ui-next', 'index.html');
        const stub = '<script>window.electronAPI = new Proxy({}, {get:(t,k)=>(k==="then"?undefined:(...a)=>/^on[A-Z]/.test(String(k))?()=>{}:Promise.resolve(null))});</script>\n';
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<script src="../player.js">', () => stub + '<script src="../player.js">'));
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function openPlayback() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto('file://' + path.join(dir, 'ui-next', 'index.html').replace(/\\/g, '/'));
        await waitForAppSettled(page, 3000);
        await page.click('.rail-btn[data-view="settings"]');
        await page.waitForSelector('.settings-menu [data-page="playback"]');
        await page.click('.settings-menu [data-page="playback"]');
        await page.waitForSelector('.settings-feature');
        return { page, errors };
    }

    test('a click on the words of a switch does nothing; a click on the switch turns it', { timeout: 40000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openPlayback();
        const row = page.locator('.settings-toggle-row', { hasText: 'Gapless playback' });
        const box = row.locator('input');
        const before = await box.isChecked();
        const words = await row.locator('span').first().boundingBox();
        await page.mouse.click(words.x + words.width / 2, words.y + words.height / 2);
        const rowBox = await row.boundingBox();
        await page.mouse.click(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2); // the empty middle of the row
        assert.equal(await box.isChecked(), before, 'the row and its words are not the switch');
        await box.click();
        assert.equal(await box.isChecked(), !before, 'the switch is');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('a slider shows its filled part, follows the thumb, and its settings fade while the switch is off', { timeout: 40000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openPlayback();
        const slider = page.locator('.settings-sub input[type="range"]').first();
        const filled = () => slider.evaluate((n) => getComputedStyle(n).getPropertyValue('--hi'));
        assert.ok(Number(await filled()) > 0, 'a value above the minimum has a filled part');
        await slider.evaluate((n) => {
            n.value = n.max;
            n.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(Number(await filled()), 1);
        const feature = page.locator('.settings-feature').first();
        const toggle = feature.locator('.settings-toggle-row input');
        if (await toggle.isChecked()) await toggle.click();
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.settings-sub')).opacity) < 1);
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the thumb dot reaches both ends of the track, and the hover halo is not cut off', { timeout: 40000 }, async (t) => {
        if (!guard(t)) return;
        const { page, errors } = await openPlayback();
        const feature = page.locator('.settings-feature').first();
        const toggle = feature.locator('.settings-toggle-row input');
        if (!(await toggle.isChecked())) await toggle.click(); // a feature that is off fades its settings: measure the slider at full strength
        const slider = feature.locator('input[type="range"]');
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.settings-sub')).opacity) === 1);
        await page.waitForTimeout(400); // let the page finish fading in
        // Looks at the painted pixels, so it does not depend on how the slider is built. Two pixel rows of the slider: the middle one crosses the 4px
        // track (its ends are the track's ends), and one 3px above it is above the track, where only the dot is drawn (at that height the 12px dot is
        // still about 10px wide, so its edge is within 1px of where it is at the middle). Returns the leftmost and rightmost painted column of each.
        async function edges(value, hover, haloThreshold) {
            await slider.evaluate((n, v) => {
                n.value = v === 'min' ? n.min : n.max;
                n.dispatchEvent(new Event('input', { bubbles: true }));
            }, value);
            const box = await slider.boundingBox();
            if (hover) await page.mouse.move(box.x + (value === 'min' ? 3 : box.width - 3), box.y + box.height / 2);
            else await page.mouse.move(2, 2);
            await page.waitForTimeout(300);
            const margin = 12;
            const shot = (await page.screenshot({ clip: { x: box.x - margin, y: box.y, width: box.width + margin * 2, height: box.height } })).toString('base64');
            const mid = Math.round(box.height / 2);
            const found = await page.evaluate(async ({ shot, rows }) => {
                const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + shot)).blob());
                const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0);
                return rows.map(({ row, threshold }) => {
                    const { data, width } = ctx.getImageData(0, row, bitmap.width, 1);
                    const differs = (x) => [0, 1, 2].some((c) => Math.abs(data[x * 4 + c] - data[c]) > threshold); // against the first column: the page behind
                    let left = -1;
                    let right = -1;
                    for (let x = 1; x < width - 1; x++) {
                        if (differs(x)) {
                            if (left < 0) left = x;
                            right = x;
                        }
                    }
                    return { left, right };
                });
            }, { shot, rows: [{ row: mid - 3, threshold: haloThreshold || 40 }, { row: mid, threshold: 6 }] });
            return { dot: found[0], track: found[1], margin };
        }
        const atMin = await edges('min', false);
        assert.ok(atMin.dot.left >= 0 && atMin.track.left >= 0, `the dot and the track are drawn (dot ${JSON.stringify(atMin.dot)}, track ${JSON.stringify(atMin.track)})`);
        assert.ok(Math.abs(atMin.dot.left - atMin.track.left) <= 2, `at the minimum the dot starts where the track starts (dot at ${atMin.dot.left}, track at ${atMin.track.left})`);
        const atMax = await edges('max', false);
        assert.ok(Math.abs(atMax.dot.right - atMax.track.right) <= 2, `at the maximum the dot ends where the track ends (dot at ${atMax.dot.right}, track at ${atMax.track.right})`);
        // pointed at, at an end: the halo goes out to the slider's own edge (the 5px beside the dot are drawn, not cut short)
        const pointed = await edges('min', true, 6);
        assert.ok(pointed.dot.left >= 0 && pointed.dot.left <= pointed.margin + 2, `the halo reaches the slider's own edge at the minimum (halo at ${pointed.dot.left}, slider edge at ${pointed.margin})`);
        assert.deepEqual(errors, []);
        await page.close();
    });
});
