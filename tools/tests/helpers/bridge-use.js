'use strict';

// Which names a module has to publish on window. A module registers a name with registerLegacyGlobals only if
// something outside the module reads it by bare name: another renderer file, the page template, the Electron
// main process (executeJavaScript), the build tools or a test. A name used only inside its own file stays private.
// The check is textual (a whole-word match), so it can only over-count, never miss a use.

const fs = require('fs');
const path = require('path');
const { readManifest } = require('../../lib/manifest');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..', '..');
const JS = path.join(ROOT, 'src', 'js');

let corpus = null;
function load() {
    if (corpus) return corpus;
    const modules = readManifest(ROOT).modules;
    const source = Object.fromEntries(modules.map((f) => [f, fs.readFileSync(path.join(JS, ...f.split('/')), 'utf8')]));
    const other = [fs.readFileSync(path.join(ROOT, 'build', 'music_player.html'), 'utf8'), fs.readFileSync(path.join(JS, '99-player.js'), 'utf8')];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules') walk(full);
            } else if (/\.(js|json|py|md)$/.test(entry.name) && !full.endsWith(path.join('helpers', 'bridge-use.js'))) other.push(fs.readFileSync(full, 'utf8'));
        }
    })(path.join(ROOT, 'tools'));
    for (const entry of fs.readdirSync(path.join(ROOT, 'electron'))) if (entry.endsWith('.js')) other.push(fs.readFileSync(path.join(ROOT, 'electron', entry), 'utf8'));
    corpus = { modules, source, other };
    return corpus;
}

const wordRegex = (name) => new RegExp('(?<![\\w$])' + name.replace(/\$/g, '\\$') + '(?![\\w$])');

// true when a file other than `file`, the page template, the main process, the tools or a test mentions the name.
function usedOutside(file, name) {
    const { modules, source, other } = load();
    const re = wordRegex(name);
    return modules.some((m) => m !== file && re.test(source[m])) || other.some((text) => re.test(text));
}

// The names listed in the file's registerLegacyGlobals / registerLegacyState calls.
function registeredNames(file) {
    const text = fs.readFileSync(path.join(JS, ...file.split('/')), 'utf8');
    const names = [];
    for (const call of text.matchAll(/registerLegacy(?:Globals|State)\(\{([\s\S]*?)\}\);/g)) {
        for (const part of call[1].split(/,\s*(?![^\[]*\])/)) {
            const m = part.trim().match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
            if (m) names.push(m[1]);
        }
    }
    return names;
}

const exportedFunctions = (file) =>
    [...fs.readFileSync(path.join(JS, ...file.split('/')), 'utf8').matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]);

module.exports = { usedOutside, registeredNames, exportedFunctions };
