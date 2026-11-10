'use strict';

// Moves the finished Polish 1 plan files out of .agent/ into .agent/archive/polish-1/. Nothing is deleted.
//
//   node tools/dev/archive-polish-docs.js            show what would move
//   node tools/dev/archive-polish-docs.js --apply    move it
//
// Stays in .agent/: Polish 2 reports (P2-*), AGENTS.md, CONTEXT.md, AI-TAG-SHEET.md, E-D-REMAINING.md, reports/README.md, reports/TEMPLATE.md and
// archive/ itself. Run it once; running it again moves nothing.

const fs = require('fs');
const path = require('path');

const AGENT = path.resolve(__dirname, '..', '..', '.agent');
const FILES = ['PLAN.md', 'BOARD.md', 'POLISH-1-BRIEF.md', 'MINI-PLAN-songs-search-recents.md'];
const KEEP_REPORTS = new Set(['README.md', 'TEMPLATE.md']);

function plan() {
    const moves = [];
    for (const name of FILES) {
        if (fs.existsSync(path.join(AGENT, name))) moves.push([name, path.join('archive', 'polish-1', name)]);
    }
    const reports = path.join(AGENT, 'reports');
    if (fs.existsSync(reports)) {
        for (const name of fs.readdirSync(reports)) {
            if (!KEEP_REPORTS.has(name) && !name.startsWith('P2-')) moves.push([path.join('reports', name), path.join('archive', 'polish-1', 'reports', name)]);
        }
    }
    return moves;
}

const apply = process.argv.includes('--apply');
if (!fs.existsSync(path.join(AGENT, 'E-D-REMAINING.md'))) {
    console.error('.agent/E-D-REMAINING.md is missing: it holds what D and E still have to do. Not moving anything.');
    process.exit(1);
}
const moves = plan();
for (const [from, to] of moves) {
    console.log((apply ? 'moved  ' : 'would move  ') + from + '  ->  ' + to);
    if (apply) {
        fs.mkdirSync(path.dirname(path.join(AGENT, to)), { recursive: true });
        fs.renameSync(path.join(AGENT, from), path.join(AGENT, to));
    }
}
console.log(moves.length ? (apply ? 'Done: ' : 'Nothing moved yet. Add --apply. ') + moves.length + ' item(s).' : 'Nothing to move.');
