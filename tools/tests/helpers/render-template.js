'use strict';

// Renders src/old-ui/music_player.template.html's {{CSS_LINKS}} / {{JS_SCRIPTS}} placeholders from
// src/manifest.json - the same thing tools/dev/gen-web.js does for the real page.
// The manifest names the stylesheets and the one module entry (src/js/main.js); the entry's imports
// are the renderer's load order.

const { readManifest } = require('../../lib/manifest');

function loadManifest(root) {
    return readManifest(root);
}

function renderTemplate(html, root) {
    const manifest = loadManifest(root);
    const css = manifest.css.map((name) => `        <link rel="stylesheet" href="css/${name}">`).join('\n');
    const js = `        <script type="module" src="js/${manifest.entry}"></script>`;
    for (const placeholder of ['{{CSS_LINKS}}', '{{JS_SCRIPTS}}']) {
        const count = html.split(placeholder).length - 1;
        if (count !== 1) throw new Error(`music_player.html must contain ${placeholder} exactly once (found ${count})`);
    }
    return html.replace('{{CSS_LINKS}}', () => css).replace('{{JS_SCRIPTS}}', () => js);
}

module.exports = { loadManifest, renderTemplate };
