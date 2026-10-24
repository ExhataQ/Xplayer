#!/usr/bin/env node
// Adapter line budgets (task PA-09, decisions D13, D18, D30 and DP9). One place that measures every file in src/ui-next/adapter/ and
// says which budget it belongs to. A line counts when it is not blank and not a comment line, the same rule the older size tests use.
//
//   node tools/adapter-budget.js          prints the table
//
// The groups:
//   core      store, actions, events and engine-view: D18, 300 lines together
//   engine    engine-api: D30, counted on its own (it was 90 lines over D18 when it was added, the owner accepted it)
//   legacy    legacy-dom-adapter: D13, 250 lines
//   phase 1   the other bridges that existed when this plan started (2026-10-21): each has its own small cap in its own test
//   plan      every other .js file in adapter/, that is, any bridge added by this plan: DP9, 300 lines together
// A new bridge is therefore a "plan" file without anyone having to register it, so it cannot be added without being counted.

const fs = require('fs');
const path = require('path');

const ADAPTER_DIR = path.join(__dirname, '..', 'src', 'ui-next', 'adapter');

const CORE = ['store.js', 'actions.js', 'events.js', 'engine-view.js'];
const ENGINE = ['engine-api.js'];
const LEGACY = ['legacy-dom-adapter.js'];
const PHASE_1 = ['library-bridge.js', 'listbar-bridge.js', 'notifications-bridge.js', 'player-parts.js', 'playback-bridge.js', 'search-bridge.js', 'songlist-bridge.js', 'startup-bridge.js'];

const LIMITS = { core: 300, legacy: 250, plan: 300 };

// DP14 (open, 2026-10-24): the bridges the other agents added after DP9 (ai-bridge 206, tag-sheet-bridge 74, ai-lyrics 39, library-create 23,
// home-bridge 25, menu-bridge 17, songsort-bridge 6) total 390, which is 90 over the owner's 300. Whether to raise the limit or trim
// ai-bridge is the owner's decision. Until then the total may not grow: the test fails above this number, and the owner sets the real limit
// by changing LIMITS.plan and removing this line.
const PLAN_FROZEN_AT = 390;

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
