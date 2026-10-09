'use strict';

// ESLint flat config. REPORT-ONLY: it exists to catch missing imports and typos while the renderer moves from
// classic scripts to ES modules (see tools/tests/README.md, "Lint"). Run it with `npm run lint`.
//
// The app's own globals are generated from src/manifest.json by tools/lint-globals.js on every run; do not list them here.
// src/js/99-player.js is skipped: it holds a build template token ({{SONGS_DATA}}) that is not valid JavaScript.

const globals = require('globals');
const { buildLintGlobals } = require('./tools/lint-globals');

const app = buildLintGlobals(__dirname);
const underSrc = (files) => files.filter((f) => f !== '99-player.js').map((f) => `src/js/${f}`);

const baseRules = {
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-self-assign': 'error'
};
const unused = (vars) => ['warn', { vars, args: 'none', caughtErrors: 'none' }];

module.exports = [
    { ignores: ['**/node_modules/**', 'src/js/99-player.js', 'electron/MusicPlayerOutput/**'] },
    {
        // Classic scripts: one shared global scope. Top-level functions/variables are used by OTHER files, so
        // no-unused-vars only looks inside functions and blocks here.
        files: underSrc(app.classic),
        languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser, ...app.globals } },
        rules: { ...baseRules, 'no-unused-vars': unused('local') }
    },
    {
        files: underSrc(app.modules),
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...app.globals } },
        rules: { ...baseRules, 'no-unused-vars': unused('all') }
    },
    {
        files: ['electron/**/*.js'],
        languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } },
        rules: { ...baseRules, 'no-unused-vars': unused('all') }
    },
    {
        files: ['electron/preload.js'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } }
    }
];
