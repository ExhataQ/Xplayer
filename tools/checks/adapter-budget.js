#!/usr/bin/env node
// Adapter line budgets (task PA-09, decisions D13, D18, D30 and DP9). One place that measures every file in src/ui-next/adapter/ and
// says which budget it belongs to. A line counts when it is not blank and not a comment line, the same rule the older size tests use.
//
//   node tools/checks/adapter-budget.js          prints the table
//
// The groups:
//   core      store, actions, events and engine-view: D18, 300 lines together
//   engine    engine-api: D30, counted on its own (it was 90 lines over D18 when it was added, the owner accepted it)
//   legacy    legacy-dom-adapter: D13, 250 lines
//   phase 1   the other bridges that existed when this plan started (2026-10-21): each has its own small cap in its own test
//   plan      every other .js file in adapter/, that is, any bridge added by this plan: DP9, now 700 lines together (owner, 2026-11-05)
// A new bridge is therefore a "plan" file without anyone having to register it, so it cannot be added without being counted.

const fs = require('fs');
const path = require('path');

const ADAPTER_DIR = path.join(__dirname, '..', '..', 'src', 'ui-next', 'adapter');

const CORE = ['store.js', 'actions.js', 'events.js', 'engine-view.js'];
const ENGINE = ['engine-api.js'];
const LEGACY = ['legacy-dom-adapter.js'];
const PHASE_1 = ['library-bridge.js', 'listbar-bridge.js', 'notifications-bridge.js', 'player-parts.js', 'playback-bridge.js', 'search-bridge.js', 'songlist-bridge.js', 'startup-bridge.js'];

const LIMITS = { core: 300, legacy: 250, plan: 700 };

// DP14 (settled by the owner, 2026-11-05): the plan bridges had grown to about 600 lines, so the limit is now 700. The old freeze at 390 is gone.
const PLAN_FROZEN_AT = 0;

const codeLines = (file) =>
    fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !/^\s*(?:\/\/|\/\*|\*|\*\/)/.test(line)).length;

function groupOf(name) {
    if (CORE.includes(name)) return 'core';
    if (ENGINE.includes(name)) return 'engine';
    if (LEGACY.includes(name)) return 'legacy';
    if (PHASE_1.includes(name)) return 'phase 1';
    return 'plan';
}

/** Every adapter .js file as { name, group, lines }, and the totals per group. */
function measure() {
    const files = fs
        .readdirSync(ADAPTER_DIR)
        .filter((name) => name.endsWith('.js'))
        .sort()
        .map((name) => ({ name, group: groupOf(name), lines: codeLines(path.join(ADAPTER_DIR, name)) }));
    const totals = {};
    for (const f of files) totals[f.group] = (totals[f.group] || 0) + f.lines;
    return { files, totals, limits: LIMITS };
}

module.exports = { measure, LIMITS, PLAN_FROZEN_AT, CORE, ENGINE, LEGACY, PHASE_1 };

if (require.main === module) {
    const { files, totals } = measure();
    for (const group of ['core', 'engine', 'legacy', 'phase 1', 'plan']) {
        const limit = LIMITS[group] ? ` of ${LIMITS[group]}` : '';
        console.log(`${group}: ${totals[group] || 0}${limit}`);
        for (const f of files.filter((x) => x.group === group)) console.log(`    ${String(f.lines).padStart(4)}  ${f.name}`);
    }
}
