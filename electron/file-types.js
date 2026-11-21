'use strict';

// Lets Windows know what Xplayer is, so audio files show the audio-file icon, "Open with" lists Xplayer, and Settings > Default apps has
// an Xplayer page of its own (the "Capabilities" keys; the welcome screen opens that page with ms-settings:defaultapps?registeredAppUser=Xplayer).
//
// A portable folder has no installer, so nothing else tells Windows about it. The installer registers its own file types
// (package.json build.fileAssociations) but not the Capabilities page, so the installed build runs this too. Everything goes under the
// current user's keys (HKCU), which needs no administrator rights. It does not choose the default app: Windows allows that only in its own
// settings, so the person does it there. It can read the answer back (defaultStatus), which the welcome screen shows.
//
// Only on Windows, in the portable and installed modes, and only when the exe or icon location changed since the last run. To keep a copy
// from touching the registry at all, put an empty file named no-file-types.txt in its data folder.
//
// Plain Node with no Electron: the registry and file calls are passed in, so tools/tests/electron/file-types.test.js can run it anywhere.

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { AUDIO_EXTENSIONS } = require('./ipc-checks');

const PROG_ID = 'Xplayer.AudioFile';
const OPT_OUT_FILE = 'no-file-types.txt';
const STATE_FILE = 'file-types.json';
const CLASSES = 'HKCU\\Software\\Classes';
const APP_NAME = 'Xplayer'; // the value under HKCU\Software\RegisteredApplications, and the name in the ms-settings address
const CAPABILITIES = 'Software\\Xplayer\\Capabilities';

// The same list as package.json build.fileAssociations: .mp4 is mostly video, Xplayer must not offer to take it over.
const SKIPPED = new Set(['.mp4']);
function registeredExtensions() {
    return [...AUDIO_EXTENSIONS].filter((ext) => !SKIPPED.has(ext)).sort();
}

// The `reg add` calls, as argument lists. Pure, so the exact keys can be tested.
function registryCommands({ exePath, iconPath, extensions = registeredExtensions() }) {
    const exeName = path.win32.basename(exePath);
    const command = `"${exePath}" "%1"`;
    const icon = `"${iconPath}",0`;
    const add = (key, name, value) => (name === null ? ['add', key, '/ve', '/d', value, '/f'] : ['add', key, '/v', name, '/t', 'REG_NONE', '/f']);
    const commands = [
        add(`${CLASSES}\\${PROG_ID}`, null, 'Audio file'),
        add(`${CLASSES}\\${PROG_ID}\\DefaultIcon`, null, icon),
        add(`${CLASSES}\\${PROG_ID}\\shell\\open\\command`, null, command),
        add(`${CLASSES}\\Applications\\${exeName}`, null, 'Xplayer'),
        ['add', `${CLASSES}\\Applications\\${exeName}`, '/v', 'FriendlyAppName', '/d', 'Xplayer', '/f'],
        add(`${CLASSES}\\Applications\\${exeName}\\DefaultIcon`, null, icon),
        add(`${CLASSES}\\Applications\\${exeName}\\shell\\open\\command`, null, command)
    ];
    // The Default apps page of Xplayer: RegisteredApplications names a Capabilities key, which lists the types and the class that opens them.
    const caps = `HKCU\\${CAPABILITIES}`;
    commands.push(['add', caps, '/v', 'ApplicationName', '/d', APP_NAME, '/f']);
    commands.push(['add', caps, '/v', 'ApplicationDescription', '/d', 'Music player', '/f']);
    commands.push(['add', 'HKCU\\Software\\RegisteredApplications', '/v', APP_NAME, '/d', CAPABILITIES, '/f']);
    for (const ext of extensions) {
        commands.push(add(`${CLASSES}\\${ext}\\OpenWithProgids`, PROG_ID));
        commands.push(add(`${CLASSES}\\Applications\\${exeName}\\SupportedTypes`, ext));
        commands.push(['add', `${caps}\\FileAssociations`, '/v', ext, '/d', PROG_ID, '/f']);
    }
    return commands;
}

// What the last run wrote. A different exe or icon path (the folder was moved) or version of this list means: write again.
function signature({ exePath, iconPath, extensions = registeredExtensions() }) {
    return JSON.stringify({ v: 2, exePath, iconPath, extensions });
}

function runReg(args) {
    return new Promise((resolve, reject) => {
        execFile('reg.exe', args, { windowsHide: true, timeout: 15000 }, (error) => (error ? reject(error) : resolve()));
    });
}

// Asks Windows to redraw the file icons. Failing is fine: the icons then update after the next sign-in or Explorer restart.
function refreshIcons() {
    return new Promise((resolve) => {
        execFile('ie4uinit.exe', ['-show'], { windowsHide: true, timeout: 15000 }, () => resolve());
    });
}

// Returns { status: 'skipped' | 'unchanged' | 'registered' | 'failed', reason?, error? }. Never throws.
async function registerFileTypes({
    platform = process.platform,
    mode,
    exePath = process.execPath,
    iconPath,
    dataDir,
    exists = fs.existsSync,
    readText = (file) => fs.readFileSync(file, 'utf8'),
    writeText = (file, text) => fs.writeFileSync(file, text),
    reg = runReg,
    refresh = refreshIcons,
    log = () => {}
} = {}) {
    try {
        if (platform !== 'win32') return { status: 'skipped', reason: 'not Windows' };
        if (mode !== 'portable' && mode !== 'installed') return { status: 'skipped', reason: 'a development run' };
        if (!exePath || !iconPath || !dataDir) return { status: 'skipped', reason: 'missing paths' };
        if (exists(path.join(dataDir, OPT_OUT_FILE))) return { status: 'skipped', reason: 'opted out' };
        if (!exists(iconPath)) return { status: 'skipped', reason: 'icon file missing' };

        const stateFile = path.join(dataDir, STATE_FILE);
        const now = signature({ exePath, iconPath });
        let before = null;
        try {
            before = exists(stateFile) ? readText(stateFile) : null;
        } catch (e) {
            before = null;
        }
        if (before === now) return { status: 'unchanged' };

        for (const args of registryCommands({ exePath, iconPath })) await reg(args);
        try {
            writeText(stateFile, now);
        } catch (e) {
            log('file types: could not save ' + STATE_FILE + ': ' + e.message);
        }
        await refresh();
        log('file types registered (' + mode + ')');
        return { status: 'registered' };
    } catch (error) {
        log('file types: not registered: ' + (error && error.message ? error.message : error));
        return { status: 'failed', error: String(error && error.message ? error.message : error) };
    }
}

// What opens each music type now, read from Windows' own record of the person's choice: { total, ours }. Null when it cannot be read
// (not Windows). A class named Xplayer.* (ours, or the installer's) or Applications\<exe> counts as Xplayer.
const USER_CHOICE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts';
const queryReg = (args) =>
    new Promise((resolve) => {
        execFile('reg.exe', args, { windowsHide: true, timeout: 8000 }, (error, stdout) => resolve(error ? '' : String(stdout)));
    });
const isOurs = (progId, exeName) => /^xplayer(\.|$)/i.test(progId) || progId.toLowerCase() === `applications\\${String(exeName).toLowerCase()}`;
async function defaultStatus({ platform = process.platform, exePath = process.execPath, query = queryReg } = {}) {
    if (platform !== 'win32') return null;
    const exeName = path.win32.basename(exePath);
    const extensions = registeredExtensions();
    let ours = 0;
    await Promise.all(
        extensions.map(async (ext) => {
            const text = await query(['query', `${USER_CHOICE}\\${ext}\\UserChoice`, '/v', 'ProgId']);
            const match = /ProgId\s+REG_SZ\s+(\S.*?)\s*$/m.exec(text);
            if (match && isOurs(match[1], exeName)) ours++;
        })
    );
    return { total: extensions.length, ours };
}

module.exports = { PROG_ID, APP_NAME, OPT_OUT_FILE, STATE_FILE, registeredExtensions, registryCommands, signature, registerFileTypes, defaultStatus };
