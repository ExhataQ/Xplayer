'use strict';

// Event-bus completion audit (Plan 1).
//
// Lists every place where a file owned by agent A, B or C calls a function defined in
// agent D's files (04*-07) that is a REACTION - "something changed, redraw" - and so should
// go through the event bus. Calls that are allowed to stay direct (UI services, read-only
// queries, navigation commands, start-up setup) are listed in tools/event-allowlist.json.
//
//   node tools/event-audit.js            per-agent summary and the file list
//   node tools/event-audit.js B          detail for one agent: file, function, count
//   node tools/event-audit.js --strict   exit code 1 while any reaction call remains
//
// Plan 1 is finished when this reports 0 for A, B and C. It reads call counts from
// tools/dep-map.js, so it is a static count of references, not of runtime calls.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const allow = JSON.parse(fs.readFileSync(path.join(__dirname, 'event-allowlist.json'), 'utf8'));
const out = path.join(os.tmpdir(), `dep-map-${process.pid}.json`);
execFileSync(process.execPath, [path.join(__dirname, 'dep-map.js'), 'json', out], { cwd: ROOT, stdio: 'ignore' });
const map = JSON.parse(fs.readFileSync(out, 'utf8'));
fs.rmSync(out, { force: true });

const agentOf = (file) => {
    if (file.startsWith('core/')) return 'A';
    const m = /^(\d+)/.exec(path.basename(file));
    if (!m) return '?';
    const n = Number(m[1]);
    return Object.keys(allow.groups).find((g) => allow.groups[g].includes(n)) || '?';
};
const allowed = new Set(['services', 'queries', 'navigation', 'setup'].flatMap((k) => allow[k].names));

const remaining = {}; // agent -> file -> fn -> count
for (const [file, uses] of Object.entries(map.uses)) {
    const agent = agentOf(file);
    if (agent === 'D' || agent === '?') continue;
    for (const [name, count] of Object.entries(uses)) {
        const def = map.defs[name];
        if (!def || def.kind !== 'fn' || agentOf(def.file) !== 'D' || allowed.has(name)) continue;
        remaining[agent] = remaining[agent] || {};
        remaining[agent][file] = remaining[agent][file] || {};
        remaining[agent][file][name] = count;
    }
}

const total = (agent) => Object.values(remaining[agent] || {}).reduce((s, f) => s + Object.values(f).reduce((a, b) => a + b, 0), 0);
const want = process.argv.slice(2).find((a) => /^[ABC]$/.test(a));
let grand = 0;
for (const agent of ['A', 'B', 'C']) {
    grand += total(agent);
    console.log(`Agent ${agent}: ${total(agent)} reaction call(s) still direct`);
    if (want && want !== agent) continue;
    const files = Object.entries(remaining[agent] || {}).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0));
    for (const [file, fns] of files) {
        const n = Object.values(fns).reduce((a, b) => a + b, 0);
        console.log(`  ${file} (${n}): ${Object.entries(fns).sort((a, b) => b[1] - a[1]).map(([f, c]) => `${f}x${c}`).join(', ')}`);
    }
}
console.log(`Total: ${grand}`);
if (process.argv.includes('--strict') && grand > 0) process.exit(1);
