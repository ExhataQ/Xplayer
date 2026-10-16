'use strict';

// The "Startup screen" choice: saved with the other settings, offered in the Settings panel, safe against bad data.
// Real browser, real change event.
//
// Run: node --test tools/tests/startup-setting.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();

describe('startup screen setting', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(3);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    test('defaults to vinyl, saves a valid choice, refuses an invalid one, and repairs bad saved data on read', async (t) => {
        if (!guard(t)) return;
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        const out = await page.evaluate(() => {
            localStorage.removeItem('startupBackground');
            const first = getStartupBackground();
            const saved = setStartupBackground('playhead');
            const afterSave = { value: getStartupBackground(), raw: localStorage.getItem('startupBackground') };
            const refused = setStartupBackground('not-a-background');
            const afterRefuse = getStartupBackground();
            localStorage.setItem('startupBackground', 'garbage');
            const repaired = getStartupBackground();
            const rawKept = localStorage.getItem('startupBackground');
            return { first, saved, afterSave, refused, afterRefuse, repaired, rawKept, ids: STARTUP_BACKGROUNDS.map((o) => o.id) };
        });
        assert.equal(out.first, 'vinyl');
        assert.equal(out.saved, true);
        assert.deepEqual(out.afterSave, { value: 'playhead', raw: 'playhead' });
        assert.equal(out.refused, false);
        assert.equal(out.afterRefuse, 'playhead');
        assert.equal(out.repaired, 'vinyl');
        assert.equal(out.rawKept, 'garbage', 'reading must not rewrite what is stored');
        assert.equal(out.ids.at(-1), 'random');
        assert.deepEqual(errors, []);
        await page.close();
    });

    test('the Settings panel lists every choice and a change is saved', async (t) => {
        if (!guard(t)) return;
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await gotoApp(page, dir);
        await page.evaluate(() => {
            localStorage.setItem('startupBackground', 'equalizer');
            openSettingsPanel();
        });
        const select = page.locator('select[data-args-change=\'["$value"]\'][aria-label="Startup screen background"]');
        await select.waitFor();
        assert.equal(await select.inputValue(), 'equalizer', 'the saved choice is selected');
        assert.deepEqual(
            await select.locator('option').evaluateAll((os) => os.map((o) => o.value)),
            ['playhead', 'vinyl', 'equalizer', 'light', 'constellation', 'plain', 'random']
        );
        await select.selectOption('constellation');
        assert.equal(await page.evaluate(() => localStorage.getItem('startupBackground')), 'constellation');
        assert.deepEqual(errors, []);
        await page.close();
    });
});
