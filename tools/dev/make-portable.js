'use strict';

// Step two of `npm run dist`: turns electron-builder's unpacked folder (dist/win-unpacked) into the portable app.
//
//   dist/Xplayer/             Xplayer.exe, resources, ...   (replace this folder to update)
//   dist/Xplayer/portable.txt  the marker: the app keeps its library and settings in Xplayer-Data next to the exe
//   dist/Xplayer.zip           the same folder zipped (needs `tar`, which Windows 10 and later have)
//
// The data folder (Xplayer-Data) is made on first run, next to the exe, and is never part of the build. To update a copy in use,
// replace everything in the Xplayer folder except Xplayer-Data.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIST = path.resolve(__dirname, '..', '..', 'dist');
const UNPACKED = ['win-unpacked', 'linux-unpacked', 'mac'].map((n) => path.join(DIST, n)).find((p) => fs.existsSync(p));
const TARGET = path.join(DIST, 'Xplayer');

const NOTE = [
    'Xplayer (portable)',
    '',
    'Keep this file next to Xplayer.exe: it makes the app save its library and settings in the Xplayer-Data folder beside it',
    'instead of in your user profile. Copy or move the whole folder (with Xplayer-Data) to take everything with you.',
    '',
    'To update: close the app, then replace everything in this folder except Xplayer-Data.',
    ''
].join('\r\n');

if (!UNPACKED) {
    console.error('make-portable: dist/win-unpacked not found. Run `npm run dist` (it runs electron-builder first).');
    process.exit(1);
}
fs.rmSync(TARGET, { recursive: true, force: true });
fs.renameSync(UNPACKED, TARGET);
fs.writeFileSync(path.join(TARGET, 'portable.txt'), NOTE);
console.log('make-portable: ' + path.relative(process.cwd(), TARGET));

const zip = path.join(DIST, 'Xplayer.zip');
fs.rmSync(zip, { force: true });
const result = spawnSync('tar', ['-a', '-c', '-f', zip, '-C', DIST, 'Xplayer'], { stdio: 'inherit' });
console.log(result.status === 0 ? 'make-portable: ' + path.relative(process.cwd(), zip) : 'make-portable: could not zip (the folder is ready; zip it yourself)');
