'use strict';

// Reads the fuses of the built exe and compares them with what package.json > build.electronFuses asks for. The Windows build job runs it
// after check-dist.js; run it by hand the same way.
//
//   node tools/dev/check-fuses.js [<path to Xplayer.exe>]
//
// It runs `npx @electron/fuses read --app <exe>` (a build tool, not part of the app) and reads its text. Fuses are switches inside the
// Electron binary that turn off features the app does not use (the NODE_OPTIONS variable, --inspect on the command line), so a copy of
// the exe cannot be started as a plain Node or debugger host. `runAsNode` stays on until electron/scanner.js moves to utilityProcess.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FUSES_VERSION = '2.1.3';

// The name in `fuses read` output -> the key in package.json > build.electronFuses.
const KEYS = {
    RunAsNode: 'runAsNode',
    EnableCookieEncryption: 'enableCookieEncryption',
    EnableNodeOptionsEnvironmentVariable: 'enableNodeOptionsEnvironmentVariable',
    EnableNodeCliInspectArguments: 'enableNodeCliInspectArguments',
    GrantFileProtocolExtraPrivileges: 'grantFileProtocolExtraPrivileges'
};

function parseFuses(text) {
    const out = {};
    for (const m of String(text).matchAll(/^\s*(\w+) is (Enabled|Disabled)\s*$/gm)) out[m[1]] = m[2] === 'Enabled';
    return out;
}

// Returns a list of problems (empty when the exe has every fuse the config asks for).
function checkFuses(readOutput, wanted) {
    const actual = parseFuses(readOutput);
    const problems = [];
    for (const [name, key] of Object.entries(KEYS)) {
        if (typeof wanted[key] !== 'boolean') { problems.push(`package.json build.electronFuses.${key} is not set`); continue; }
        if (!(name in actual)) problems.push(`${name} is not in the fuse list of the exe`);
        else if (actual[name] !== wanted[key]) problems.push(`${name} is ${actual[name] ? 'Enabled' : 'Disabled'} in the exe, package.json asks for ${wanted[key] ? 'Enabled' : 'Disabled'}`);
    }
    return problems;
}

if (require.main === module) {
    const exe = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'Xplayer', 'Xplayer.exe'));
    if (!fs.existsSync(exe)) { console.error(`check-fuses: ${exe} does not exist (run npm run dist first)`); process.exit(1); }
    const wanted = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).build.electronFuses || {};
    const run = spawnSync('npx', ['--yes', `@electron/fuses@${FUSES_VERSION}`, 'read', '--app', exe], { encoding: 'utf8', shell: process.platform === 'win32' });
    if (run.status !== 0) { console.error('check-fuses: could not read the fuses\n' + (run.stderr || run.error || '')); process.exit(1); }
    const problems = checkFuses(run.stdout, wanted);
    if (problems.length) { console.error(`check-fuses: ${exe}\n  ` + problems.join('\n  ')); process.exit(1); }
    console.log(`check-fuses: ${exe} has the ${Object.keys(KEYS).length} fuses package.json asks for`);
}

module.exports = { parseFuses, checkFuses, KEYS };
