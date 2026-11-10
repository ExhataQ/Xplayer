// The main process log: <data folder>/logs/main.log, rotated at 512 KB, the last 3 files kept (task 1.4 of .agent/archive/dev-plan/DEV-PLAN.md).
//
// It records what already goes to the console (console.warn and console.error), crashes that would otherwise only show in a
// terminal nobody is watching in the portable app (uncaught exceptions, a renderer or helper process that died), and start-up.
// The file stays on the computer; "Copy diagnostics" in Settings > About shares the last lines with paths removed (see redact()).

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 512 * 1024;
const KEEP = 3;

function rotate(dir) {
    try {
        fs.rmSync(path.join(dir, `main.${KEEP - 1}.log`), { force: true });
        for (let i = KEEP - 2; i >= 1; i--) {
            const from = path.join(dir, `main.${i}.log`);
            if (fs.existsSync(from)) fs.renameSync(from, path.join(dir, `main.${i + 1}.log`));
        }
        fs.renameSync(path.join(dir, 'main.log'), path.join(dir, 'main.1.log'));
    } catch (e) {
        // Intentionally silent: a log that cannot rotate must never stop the app.
    }
}

function format(value) {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch (e) {
        return String(value);
    }
}

function createLogger({ dir, now = () => new Date(), maxBytes = MAX_BYTES }) {
    const file = path.join(dir, 'main.log');
    let size = 0;
    try {
        fs.mkdirSync(dir, { recursive: true });
        size = fs.existsSync(file) ? fs.statSync(file).size : 0;
        if (size > maxBytes) {
            rotate(dir);
            size = 0;
        }
    } catch (e) {
        // Intentionally silent: logging is best effort.
    }

    function write(level, ...parts) {
        const line = `${now().toISOString()} ${level} ${parts.map(format).join(' ').replace(/\r?\n/g, '\n    ')}\n`;
        try {
            if (size + line.length > maxBytes) {
                rotate(dir);
                size = 0;
            }
            fs.appendFileSync(file, line, 'utf8');
            size += line.length;
        } catch (e) {
            // Intentionally silent.
        }
    }

    // The last `count` lines of the current log (entries that span lines count as one line each part).
    function tail(count = 50) {
        try {
            return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-count);
        } catch (e) {
            return [];
        }
    }

    return { file, info: (...a) => write('INFO', ...a), warn: (...a) => write('WARN', ...a), error: (...a) => write('ERROR', ...a), tail };
}

// Makes console.warn and console.error also write to the log (the console still gets them), and logs a crash.
function hookProcess(logger, { target = console, proc = process, app = null } = {}) {
    for (const level of ['warn', 'error']) {
        const original = target[level].bind(target);
        target[level] = (...args) => {
            logger[level](...args);
            original(...args);
        };
    }
    // Monitor only: it logs, and leaves what Electron does with the crash alone.
    proc.on('uncaughtExceptionMonitor', (error) => logger.error('uncaught exception', error));
    if (app && typeof app.on === 'function') {
        app.on('render-process-gone', (event, contents, details) => logger.error('renderer process gone:', details && details.reason));
        app.on('child-process-gone', (event, details) => logger.error('helper process gone:', details && details.type, details && details.reason));
    }
}

// Removes what could say where the person's files are or who they are: drive paths, other absolute paths, the user name, file URLs.
function redact(text, { home = '' } = {}) {
    let out = String(text);
    if (home) out = out.split(home).join('~');
    return out
        .replace(/file:\/\/\/?[^\s'")]+/gi, '<file-url>')
        .replace(/[A-Za-z]:[\\/][^\s'"),;]*/g, '<path>')
        .replace(/\\\\[^\s'"),;]+/g, '<path>')
        .replace(/(^|[\s'"(=])~?\/(?:[^\s'"/),;]+\/)+[^\s'"/),;]*/g, '$1<path>');
}

module.exports = { createLogger, hookProcess, redact, MAX_BYTES, KEEP };
