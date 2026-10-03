'use strict';

// Renders build/music_player.html's {{CSS_LINKS}} / {{JS_SCRIPTS}} placeholders from
// src/manifest.json - the same thing build/build_manifest.py does for the real build.
// The manifest is the single source of truth for renderer load order.

const fs = require('fs');
const path = require('path');

function loadManifest(root) {
    return JSON.parse(fs.readFileSync(path.join(root, 'src', 'manifest.json'), 'utf8'));
}

function renderTemplate(html, root) {
    const manifest = loadManifest(root);
    const css = manifest.css.map((name) => `        <link rel="stylesheet" href="css/${name}">`).join('\n');
    const js = [
        ...manifest.js.map((name) => `        <script src="js/${name}"></script>`),
        ...(manifest.modules || []).map((name) => `        <script type="module" src="js/${name}"></script>`)
    ].join('\n');
    for (const placeholder of ['{{CSS_LINKS}}', '{{JS_SCRIPTS}}']) {
        const count = html.split(placeholder).length - 1;
        if (count !== 1) throw new Error(`music_player.html must contain ${placeholder} exactly once (found ${count})`);
    }
    return html.replace('{{CSS_LINKS}}', () => css).replace('{{JS_SCRIPTS}}', () => js);
}

module.exports = { loadManifest, renderTemplate };
