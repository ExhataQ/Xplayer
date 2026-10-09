'use strict';

// Shared harness for the per-agent "same calls, same order" suites
// (events-a/b/c/d.test.js). One scenario = real app code run in the real page with some
// UI functions wrapped in spies; the recorded call order is compared with a sequence
// that was MEASURED ON THE UNCONVERTED CODE.
//
//   scenarios      { name: { spy: [...], setup: '...', run: '...' } }  (see call-sequence-scenarios.js)
//   expectedFile   tools/tests/expected/events-<agent>.json  { name: [calls...] }
//
// Workflow for one slice (the order is the point):
//   1. Add the scenario to helpers/scenarios-<agent>.js. Do NOT touch the app code yet.
//   2. EVENT_BASELINE=1 node --test tools/tests/events-<agent>.test.js
//      records the sequence into expected/events-<agent>.json. It only ADDS scenarios;
//      it refuses to change one that is already recorded (set EVENT_BASELINE=force to
//      re-record, and say why in the report).
//   3. Convert the code (emit + subscriber).
//   4. Run the suite normally. It must reproduce the recorded sequence exactly.
//
// Needs playwright + a browser; skips itself if missing (see scroll.test.js for setup).
//
// Every scenario gets its own fresh page, so scenarios do not share state. They run one after the other by
// default. SEQUENCE_PAGES=<n> runs up to n at once (useful on a machine with spare cores; the recorded
// sequences must not change - if one does, run with 1 to see whether the load, not the code, caused it).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadPlaywright, launch, buildApp, gotoApp } = require('./app-fixture');
const { measure } = require('./call-sequence-scenarios');

function defineSequenceSuite({ title, scenarios, expectedFile }) {
    const pw = loadPlaywright();
    const baseline = process.env.EVENT_BASELINE; // undefined | '1' | 'force'

    describe(title, { concurrency: false }, () => {
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

        async function openApp() {
            const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
            const errors = [];
            page.on('pageerror', (e) => errors.push(String(e)));
            await gotoApp(page, dir);
            return { page, errors };
        }

        async function runScenario(name) {
            const { page, errors } = await openApp();
            try {
                const calls = await measure(page, scenarios[name]);
                return { name, calls, errors };
            } finally {
                await page.close();
            }
        }

        async function runAll(names) {
            const results = new Array(names.length);
            let next = 0;
            const worker = async () => {
                while (next < names.length) {
                    const i = next++;
                    results[i] = await runScenario(names[i]);
                }
            };
            const width = Math.max(1, Math.min(names.length, Number(process.env.SEQUENCE_PAGES) || 1));
            await Promise.all(Array.from({ length: width }, worker));
            return results;
        }

        const names = Object.keys(scenarios);
        const timeout = 30000 + names.length * 6000;

        test('every scenario makes the recorded calls, in the recorded order', { timeout }, async (t) => {
            if (skip) return void t.skip(skip);
            if (names.length === 0) return; // nothing converted in this suite yet
            const expected = JSON.parse(fs.readFileSync(expectedFile, 'utf8'));
            let changed = false;
            const results = await runAll(names);
            for (const { name, calls, errors } of results) {
                assert.deepEqual(errors, [], `${name}: page errors`);
                if (baseline) {
                    if (name in expected && baseline !== 'force') {
                        assert.deepEqual(calls, expected[name], `${name}: already recorded and different - the baseline must come from the unconverted code (EVENT_BASELINE=force to re-record)`);
                    } else {
                        expected[name] = calls;
                        changed = true;
                    }
                } else {
                    assert.ok(name in expected, `${name}: no recorded sequence yet - run EVENT_BASELINE=1 on the UNCONVERTED code first`);
                    assert.deepEqual(calls, expected[name], name);
                }
            }
            if (changed) fs.writeFileSync(expectedFile, JSON.stringify(expected, null, 4) + '\n');
            if (!baseline) {
                assert.deepEqual(Object.keys(expected).sort(), names.slice().sort(), 'scenario list and recorded list must match');
            }
        });
    });
}

module.exports = { defineSequenceSuite };
