// What Settings > About shows and shares (tasks 1.4 and 1.5 of .agent/archive/dev-plan/DEV-PLAN.md): the version, where the data is, and a short
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

module.exports = { getInfo, buildDiagnostics, dataFolder };
