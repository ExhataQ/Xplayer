// Task PA-09: the adapter line budgets, measured in one place (tools/adapter-budget.js). Static, no browser.
//
// Run:   node --test tools/tests/ui-next-adapter-budget.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { measure, LIMITS, PLAN_FROZEN_AT, CORE, ENGINE, LEGACY, PHASE_1 } = require('../adapter-budget');

const { files, totals } = measure();
const names = files.map((f) => f.name);
const table = () => files.map((f) => `${f.lines} ${f.name} (${f.group})`).join(', ');

test('core adapter (store, actions, events, engine-view) stays within the 300 lines of D18', () => {
    for (const name of CORE) assert.ok(names.includes(name), `${name} is missing`);
    assert.ok(totals.core <= LIMITS.core, `core uses ${totals.core} of ${LIMITS.core}: ${table()}`);
});

test('legacy-dom-adapter stays within the 250 lines of D13', () => {
    for (const name of LEGACY) assert.ok(names.includes(name), `${name} is missing`);
    assert.ok(totals.legacy <= LIMITS.legacy, `legacy uses ${totals.legacy} of ${LIMITS.legacy}`);
});

test('the bridges added by this plan share the 300 lines of DP9 (open decision DP14: over by 90, frozen until the owner decides), and a new one is counted without being registered', () => {
    const plan = files.filter((f) => f.group === 'plan').map((f) => f.name);
    for (const name of [...CORE, ...ENGINE, ...LEGACY, ...PHASE_1]) assert.ok(!plan.includes(name), `${name} is counted twice`);
    assert.ok(plan.length > 0, 'the plan bridges are found (home-bridge, menu-bridge, tag-sheet-bridge, ...)');
    const allowed = Math.max(LIMITS.plan, PLAN_FROZEN_AT);
    assert.ok((totals.plan || 0) <= allowed, `plan bridges use ${totals.plan}; the limit is ${LIMITS.plan} (DP9) and the total is frozen at ${PLAN_FROZEN_AT} until DP14 is decided: ${table()}`);
});

test('every adapter file is in exactly one group', () => {
    for (const f of files) assert.ok(['core', 'engine', 'legacy', 'phase 1', 'plan'].includes(f.group), f.name);
    assert.equal(files.reduce((sum, f) => sum + f.lines, 0), Object.values(totals).reduce((a, b) => a + b, 0));
});
