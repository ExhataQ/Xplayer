'use strict';

// Starts the app from Source. `npm start` and `npm run dev` both come here.
//
//   npm start                                   the app on the default dev data (Source/.dev-data), as before
//   npm run dev                                 the same, plus DevTools, a reload when src/ changes, a restart when electron/ changes,
//                                               and the generated page files rewritten when their sources change
//   npm start -- --profile=empty                a fresh, empty data folder every time (the first-run screens)
//   npm start -- --profile=sample               the made-up library of tools/dev/make-sample-library.js (made on the first use)
//   npm start -- --profile=real --data=<folder> an existing data folder, e.g. your portable Xplayer-Data, after you confirm in this window
//   npm start -- --ui=current                   the old interface (anything this script does not know goes on to Electron)
//
// The profiles live in Source/.dev-data/profiles/ (git-ignored, left out of backups). The profile switches also work with `npm run dev`.
// XPLAYER_DATA, when already set, is respected only without --profile (a profile says where the data is).

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const RESTART_EXIT_CODE = 75; // electron/dev-tools.js
const PROFILES_DIR = path.join(ROOT, '.dev-data', 'profiles');
const PROFILES = ['empty', 'sample', 'real'];

function parseArgs(argv) {
    const out = { dev: false, profile: null, data: null, yes: false, rest: [], errors: [] };
    for (const a of argv) {
        if (a === '--dev') out.dev = true;
        else if (a === '--yes') out.yes = true;
        else if (a.startsWith('--profile=')) out.profile = a.slice('--profile='.length);
        else if (a.startsWith('--data=')) out.data = a.slice('--data='.length);
        else out.rest.push(a);
    }
    if (out.profile !== null && !PROFILES.includes(out.profile)) out.errors.push(`--profile must be one of: ${PROFILES.join(', ')} (got "${out.profile}")`);
    if (out.data && out.profile !== 'real') out.errors.push('--data goes with --profile=real');
    return out;
}

// What a profile means: the data folder, and what has to happen to it first. Pure (no files are touched).
function planProfile(args, { env = process.env, profilesDir = PROFILES_DIR } = {}) {
    if (!args.profile) return { dataDir: env.XPLAYER_DATA ? path.resolve(env.XPLAYER_DATA) : null, wipe: false, makeSample: false, confirm: false, seed: false };
    if (args.profile === 'empty') return { dataDir: path.join(profilesDir, 'empty'), wipe: true, makeSample: false, confirm: false, seed: false };
    if (args.profile === 'sample') return { dataDir: path.join(profilesDir, 'sample'), wipe: false, makeSample: true, confirm: false, seed: true };
    const given = args.data || env.XPLAYER_REAL_DATA;
    if (!given) return { error: 'The real profile needs the folder: --profile=real --data=<folder> (or XPLAYER_REAL_DATA). It is the folder that holds library/ and settings/, e.g. Xplayer-Data.' };
    return { dataDir: path.resolve(given), wipe: false, makeSample: false, confirm: true, seed: false };
}

function looksLikeDataFolder(dir, exists = fs.existsSync) {
    return exists(path.join(dir, 'library', 'songs.json')) || exists(path.join(dir, 'settings'));
}

function ask(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
    });
}

async function confirmReal(dir, { yes, isTTY = process.stdin.isTTY, prompt = ask, log = console.log }) {
    log(`\nThe real profile opens an existing library:\n  ${dir}\nThe app can change it: tag edits, covers, scans and deleted songs all write there. Close any other Xplayer using it first.`);
    if (yes) return true;
    if (!isTTY) { log('Not an interactive window: add --yes to go ahead.'); return false; }
    return (await prompt('Type "real" to open it, anything else to stop: ')) === 'real';
}

function electronBinary() {
    return process.env.XPLAYER_ELECTRON || require('electron');
}

async function main(argv) {
    const args = parseArgs(argv);
    if (args.errors.length) { console.error(args.errors.join('\n')); return 2; }
    const plan = planProfile(args);
    if (plan.error) { console.error(plan.error); return 2; }

    const env = { ...process.env };
    if (plan.dataDir) {
        if (plan.confirm) {
            if (!fs.existsSync(plan.dataDir) || !looksLikeDataFolder(plan.dataDir)) { console.error(`Not an Xplayer data folder (no library/songs.json or settings/ in it): ${plan.dataDir}`); return 2; }
            if (!(await confirmReal(plan.dataDir, { yes: args.yes }))) { console.log('Stopped; nothing was opened.'); return 1; }
        }
        if (plan.wipe) {
            if (path.dirname(plan.dataDir) !== PROFILES_DIR) throw new Error('refusing to delete outside the profiles folder');
            fs.rmSync(plan.dataDir, { recursive: true, force: true });
        }
        if (plan.makeSample && !fs.existsSync(path.join(plan.dataDir, 'library', 'songs.json'))) {
            console.log('Making the sample library (once, a few seconds)...');
            await require('./make-sample-library').makeSampleLibrary({ dataDir: plan.dataDir, log: console.log });
        }
        fs.mkdirSync(plan.dataDir, { recursive: true });
        env.XPLAYER_DATA = plan.dataDir;
        if (plan.seed) env.XPLAYER_SEED = path.join(plan.dataDir, 'sample-seed.json');
    }
    console.log(`data: ${env.XPLAYER_DATA || path.join(ROOT, '.dev-data') + ' (default)'}`);

    const gen = require('./gen-web');
    let stopWatching = () => {};
    if (args.dev) stopWatching = gen.watch({ log: console.log });
    else gen.run();

    const flags = args.dev ? ['--devtools', '--watch'] : [];
    env.XPLAYER_LAUNCHER = '1';
    let code;
    do {
        code = await runElectron(['.', ...flags, ...args.rest], env);
        if (code === RESTART_EXIT_CODE) console.log('\nrestarting Electron...');
    } while (args.dev && code === RESTART_EXIT_CODE);
    stopWatching();
    return code;
}

function runElectron(argv, env) {
    return new Promise((resolve) => {
        const child = spawn(electronBinary(), argv, { cwd: ROOT, env, stdio: 'inherit' });
        child.on('exit', (code, signal) => resolve(signal ? 1 : code || 0));
        child.on('error', (e) => { console.error('Could not start Electron: ' + e.message); resolve(1); });
    });
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
}

module.exports = { parseArgs, planProfile, looksLikeDataFolder, confirmReal, PROFILES, PROFILES_DIR };
