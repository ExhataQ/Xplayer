'use strict';

// Writes THIRD-PARTY-NOTICES.txt: what Xplayer ships that other people made, with each licence.
//
//   node tools/dev/make-notices.js           write the file
//   node tools/dev/make-notices.js --check   exit 1 if the file is not what the lockfile would give (a test runs this)
//
// The packages come from package-lock.json: the production tree only (no dev tools), and only the ones the Windows x64 build can use (a
// package for another system is left out). A licence this file does not know makes it fail, so a new dependency is looked at by a person.
// Electron's own licence files (LICENSE, LICENSES.chromium.html) are copied next to the exe by electron-builder; this file points to them.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'THIRD-PARTY-NOTICES.txt');

const KNOWN = new Set(['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'BlueOak-1.0.0', 'Zlib', 'LGPL-2.1-or-later', 'LGPL-3.0-or-later']);

// Packages whose lockfile entry has no licence field; the value was read from the package's own package.json. Verify when the version changes.
const OVERRIDES = { 'exif-parser': 'MIT' };

// Things that are not npm packages. Font Awesome Free is licensed in three parts; Material Symbols and Material Icons are Apache-2.0.
const EXTRAS = [
    { name: 'Electron and Chromium', licence: 'MIT, and the licences of Chromium\'s own parts', note: 'See LICENSE and LICENSES.chromium.html next to Xplayer.exe.' },
    { name: 'Lucide icons (the interface icons)', licence: 'ISC', note: 'Text in src/ui-next/icons/LICENSE-Lucide-ISC.txt.' },
    { name: 'Font Awesome Free (fonts and style sheet, downloaded by tools/fonts/fetch-fonts.js)', licence: 'Fonts: SIL OFL 1.1; icons: CC BY 4.0; code: MIT', note: 'https://fontawesome.com/license/free' },
    { name: 'Material Symbols and Material Icons (Google)', licence: 'Apache-2.0', note: 'https://github.com/google/material-design-icons' }
];

function licenceOk(expression) {
    const parts = String(expression || '').replace(/[()]/g, ' ').split(/\s+(?:AND|OR)\s+|\s+/).filter(Boolean).filter((t) => t !== 'AND' && t !== 'OR');
    return parts.length > 0 && parts.every((p) => KNOWN.has(p));
}

/** The packages that ship: [{ name, version, licence }] sorted by name, and the problems found. */
function listPackages(lock) {
    const out = [];
    const problems = [];
    for (const [key, info] of Object.entries(lock.packages || {})) {
        if (!key || info.dev || info.devOptional) continue;
        if (Array.isArray(info.os) && !info.os.includes('win32')) continue;
        if (Array.isArray(info.cpu) && !info.cpu.includes('x64')) continue;
        const name = key.replace(/^.*node_modules\//, '');
        const licence = info.license || OVERRIDES[name];
        if (!licenceOk(licence)) problems.push(`${name}@${info.version}: licence "${licence || 'none'}" is not one this file knows (add it to KNOWN after reading it, or to OVERRIDES)`);
        out.push({ name, version: info.version, licence: licence || 'unknown' });
    }
    out.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
    return { packages: out, problems };
}

function render(lock) {
    const { packages, problems } = listPackages(lock);
    const lines = [
        'Xplayer: third-party notices',
        '',
        'Xplayer itself is under the ISC licence (the file Xplayer-LICENSE.txt). It includes the software below, each under its own licence.',
        'Some of it (the tag library node-taglib-sharp and the image library\'s native parts) is under the GNU LGPL: it is kept as separate, replaceable',
        'files in this folder (resources/app/node_modules), and its source and licence text are at the addresses given by each package.',
        '',
        'Not npm packages',
        '----------------'
    ];
    for (const e of EXTRAS) lines.push(`${e.name}`, `    ${e.licence}`, `    ${e.note}`);
    lines.push('', `npm packages (${packages.length})`, '-'.repeat(16));
    for (const p of packages) lines.push(`${p.name} ${p.version}    ${p.licence}`);
    lines.push('');
    return { text: lines.join('\r\n'), problems };
}

if (require.main === module) {
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
    const { text, problems } = render(lock);
    if (problems.length) {
        console.error('make-notices:\n  ' + problems.join('\n  '));
        process.exit(1);
    }
    if (process.argv.includes('--check')) {
        const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
        if (have !== text) {
            console.error('make-notices: THIRD-PARTY-NOTICES.txt is out of date. Run: node tools/dev/make-notices.js');
            process.exit(1);
        }
        console.log('make-notices: THIRD-PARTY-NOTICES.txt is current');
    } else {
        fs.writeFileSync(OUT, text);
        console.log(`make-notices: wrote ${path.relative(process.cwd(), OUT)}`);
    }
}

module.exports = { licenceOk, listPackages, render, KNOWN, OVERRIDES };
