'use strict';

// The icon fonts of the old interface (Font Awesome 6.4.0 and Material Symbols) are kept in src/assets/fonts, so nothing needs to be
// downloaded to build or run the app. This is for getting them again (a lost file) or checking that the kept ones are untouched.
// It replaces four older download scripts.
//
//   node tools/fonts/fetch-fonts.js            download the files that are missing
//   node tools/fonts/fetch-fonts.js --force    download all of them again
//   node tools/fonts/fetch-fonts.js --check    compare the files with tools/fonts/fonts.lock.json (no network)
//   node tools/fonts/fetch-fonts.js --lock     write fonts.lock.json from the files now in src/assets/fonts
//
// The fonts of the new interface (IBM Plex Sans, Newsreader) are in src/ui-next/fonts with their licences and are not fetched here.
// all.min.css is saved with its font paths fixed (url(../webfonts/ becomes url( ) because the font files sit beside it.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'src', 'assets', 'fonts');
const LOCK = path.join(__dirname, 'fonts.lock.json');
const FA = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0';

const FILES = [
    { name: 'all.min.css', url: FA + '/css/all.min.css', fix: (text) => text.split('url(../webfonts/').join('url(') },
    { name: 'fa-solid-900.woff2', url: FA + '/webfonts/fa-solid-900.woff2' },
    { name: 'fa-regular-400.woff2', url: FA + '/webfonts/fa-regular-400.woff2' },
    { name: 'fa-brands-400.woff2', url: FA + '/webfonts/fa-brands-400.woff2' },
    { name: 'material-symbols-outlined.woff2', url: 'https://fonts.gstatic.com/s/materialsymbolsoutlined/v226/kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1n-q_4MrImHCIJIZrDCvHOej.woff2' }
];
// Written by us, not downloaded.
const MATERIAL_CSS = `@font-face {
    font-family: 'Material Symbols Outlined';
    font-style: normal;
    font-weight: 400;
    src: url('material-symbols-outlined.woff2') format('woff2');
}

.material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-weight: normal;
    font-style: normal;
    font-size: 20px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
}
`;

// Text files are hashed with LF line endings, so the check gives the same answer on a Windows checkout (CRLF) and on Linux.
const sha = (data, name = '') => crypto.createHash('sha256').update(name.endsWith('.css') ? Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : data).digest('hex');
const names = () => [...FILES.map((f) => f.name), 'material-icons.css'];

async function download(file) {
    const response = await fetch(file.url);
    if (!response.ok) throw new Error(file.name + ': HTTP ' + response.status);
    let data = Buffer.from(await response.arrayBuffer());
    if (file.fix) data = Buffer.from(file.fix(data.toString('utf8')), 'utf8');
    if (!data.length) throw new Error(file.name + ': empty answer');
    fs.writeFileSync(path.join(DIR, file.name), data);
    return data;
}

function lockFromDisk() {
    const lock = {};
    for (const name of names()) {
        const file = path.join(DIR, name);
        if (fs.existsSync(file)) lock[name] = sha(fs.readFileSync(file), name);
    }
    return lock;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--lock')) {
        fs.writeFileSync(LOCK, JSON.stringify(lockFromDisk(), null, 2) + '\n');
        console.log('Wrote ' + path.relative(ROOT, LOCK));
        return;
    }
    if (args.includes('--check')) {
        const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
        const now = lockFromDisk();
        const bad = names().filter((n) => now[n] !== lock[n]);
        if (bad.length) {
            console.error('Different from the lock file, or missing: ' + bad.join(', '));
            process.exit(1);
        }
        console.log('All ' + names().length + ' font files match the lock file.');
        return;
    }
    fs.mkdirSync(DIR, { recursive: true });
    for (const file of FILES) {
        if (fs.existsSync(path.join(DIR, file.name)) && !args.includes('--force')) {
            console.log('kept        ' + file.name);
            continue;
        }
        await download(file);
        console.log('downloaded  ' + file.name);
    }
    const css = path.join(DIR, 'material-icons.css');
    if (!fs.existsSync(css) || args.includes('--force')) fs.writeFileSync(css, MATERIAL_CSS);
    console.log('Done. If the files changed on purpose, run with --lock and commit tools/fonts/fonts.lock.json.');
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
