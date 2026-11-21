'use strict';

// Reads src/manifest.json and the renderer's module list. The manifest names the stylesheets and the one
// script entry (src/js/main.js). The entry is an ES module whose static imports are the renderer's files in
// load order, so that order lives in one place: main.js. Tools and tests that need the list read it here.
//
//   readManifest(root)  ->  { css, entry, modules, js }
//     modules  the files main.js imports, relative to src/js/, in import order
//     js       always [], kept so older code that asks for the classic scripts finds none
//
// 99-player.js is not listed anywhere: it is the player.js build-data template (the only classic script).

const fs = require('fs');
const path = require('path');

const IMPORT_LINE = /^import\s+(['"])(\.\/[^'"]+)\1\s*;?[ \t]*$/gm;

function parseEntryImports(source) {
    return [...source.matchAll(IMPORT_LINE)].map((m) => m[2].replace(/^\.\//, ''));
}

function readManifest(root) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'manifest.json'), 'utf8'));
    if (typeof manifest.entry !== 'string' || !manifest.entry) throw new Error('src/manifest.json: "entry" must name the module entry file');
    const entrySource = fs.readFileSync(path.join(root, 'src', 'js', ...manifest.entry.split('/')), 'utf8');
    return { ...manifest, js: [], modules: parseEntryImports(entrySource) };
}

module.exports = { readManifest, parseEntryImports };
