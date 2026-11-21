// What Settings > About shows and shares (the development plan, tasks 1.4 and 1.5): the version, where the data is, and a short
// diagnostics text for a bug report. The text never holds a key, a song title or a path (see redact() in logger.js).

const os = require('os');
const path = require('path');
const { redact } = require('./logger');

function getInfo({ app, appPaths }) {
    return {
        version: typeof app.getVersion === 'function' ? app.getVersion() : '',
        electron: process.versions.electron || '',
        mode: appPaths.getMode(),
        dataDir: appPaths.getDataDir()
    };
}

function buildDiagnostics({ info, tail = [], memory = '', home = os.homedir(), platform = process.platform, arch = process.arch, chrome = process.versions.chrome, node = process.versions.node }) {
    const lines = [
        `Xplayer ${info.version}`,
        `Electron ${info.electron} (Chrome ${chrome}, Node ${node})`,
        `${platform} ${arch}`,
        `Mode: ${info.mode}`,
        `Data folder: ${redact(info.dataDir, { home })}`,
        '',
        ...(memory ? [memory, ''] : []),
        'Last log lines:',
        ...(tail.length ? tail.map((line) => '  ' + redact(line, { home })) : ['  (none)'])
    ];
    return lines.join('\n');
}

// The folder the "Open data folder" button opens.
function dataFolder(appPaths) {
    return path.resolve(appPaths.getDataDir());
}

// The last lines of the log for the log viewer, with paths, file addresses and the user name removed (redact in logger.js).
function readLog({ logger, home = os.homedir(), count = 300 }) {
    return logger.tail(count).map((line) => redact(line, { home }));
}

// The data folder as About shows it: the folder's own name only, never the path (which holds the user name or a drive).
function dataFolderLabel(dir) {
    return String(dir || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop();
}

// The folder the logger writes to and "Open logs" opens (main.js: createLogger({ dir })).
function logsFolder(appPaths) {
    return path.join(dataFolder(appPaths), 'logs');
}

module.exports = { getInfo, buildDiagnostics, dataFolder, logsFolder, readLog, dataFolderLabel };
