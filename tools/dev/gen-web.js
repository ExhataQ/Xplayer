'use strict';

// Writes the few page files that are generated rather than kept in src/, so the app can run straight from Source/src
// (the old build script used to copy everything into a separate App folder):
//
//   src/player.js          src/js/99-player.js with the placeholders filled in (the only classic script on the page)
//   src/music_player.html  the old interface: src/old-ui/music_player.template.html with the CSS and script tags from src/manifest.json
//   src/fonts/             the icon fonts of the old interface, copied from src/assets/fonts
//   src/icons/             play.svg and lyrics.svg, which both interfaces ask for as icons/<name> (copied from src/assets/icons)
//
// All three are generated, ignored by git, and safe to delete: `npm start` and `npm run dist` write them again.
// The library (songs.json, covers) is not here; it lives in the data folder (electron/app-paths.js).
//
//   node tools/dev/gen-web.js          write the files
//   node tools/dev/gen-web.js --check  exit 1 if a file is missing or out of date (writes nothing)
//   node tools/dev/gen-web.js --watch  write them, then write again whenever a source of them changes (npm run dev does this)

const fs = require('fs');
const path = require('path');
const { readManifest } = require('../lib/manifest');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function placeholderImage() {
    const svg = fs.readFileSync(path.join(SRC, 'assets', 'default-cover.svg'));
    return 'data:image/svg+xml;base64,' + svg.toString('base64');
}

function renderPlayerJs() {
    return read(path.join(SRC, 'js', '99-player.js')).split('{{SONGS_DATA}}').join('[]').split('{{PLACEHOLDER_IMAGE}}').join(placeholderImage());
}

function renderOldPage() {
    const manifest = readManifest(ROOT);
    let html = read(path.join(SRC, 'old-ui', 'music_player.template.html'));
    for (const placeholder of ['{{CSS_LINKS}}', '{{JS_SCRIPTS}}']) {
        const count = html.split(placeholder).length - 1;
        if (count !== 1) throw new Error(`src/old-ui/music_player.template.html must contain ${placeholder} exactly once (found ${count})`);
    }
    const css = manifest.css.map((name) => `        <link rel="stylesheet" href="css/${name}">`).join('\n');
    const js = `        <script type="module" src="js/${manifest.entry}"></script>`;
    html = html.replace('{{CSS_LINKS}}', () => css).replace('{{JS_SCRIPTS}}', () => js);
    // The song count in the hero is filled in by the page itself from songs.json.
    return html.split('{{SONGS_COUNT}}').join('0').split('{{PLACEHOLDER_IMAGE}}').join(placeholderImage());
}

const FONT_FILES = ['all.min.css', 'material-icons.css', 'fa-solid-900.woff2', 'fa-regular-400.woff2', 'fa-brands-400.woff2', 'material-symbols-outlined.woff2'];

function fontFile(name) {
    const file = path.join(SRC, 'assets', 'fonts', name);
    if (!fs.existsSync(file)) return null;
    // all.min.css points its font files at ../webfonts/; here they sit beside it.
    if (name === 'all.min.css') return Buffer.from(read(file).split('url(../webfonts/').join('url('), 'utf8');
    return fs.readFileSync(file);
}

const ICON_FILES = ['prev.png', 'play.png', 'pause.png', 'next.png', 'play.svg', 'lyrics.svg'];

// The files to write: [absolute path, contents (string or Buffer)]
function generated() {
    const files = [
        [path.join(SRC, 'player.js'), renderPlayerJs()],
        [path.join(SRC, 'music_player.html'), renderOldPage()]
    ];
    for (const name of FONT_FILES) {
        const data = fontFile(name);
        if (data) files.push([path.join(SRC, 'fonts', name), data]);
    }
    for (const name of ICON_FILES) {
        const file = path.join(SRC, 'assets', 'icons', name);
        if (fs.existsSync(file)) files.push([path.join(SRC, 'icons', name), fs.readFileSync(file)]);
    }
    return files;
}

function sameContent(file, data) {
    try {
        return Buffer.compare(fs.readFileSync(file), Buffer.from(data)) === 0;
    } catch (e) {
        return false;
    }
}

function run({ check = false } = {}) {
    const stale = [];
    for (const [file, data] of generated()) {
        if (sameContent(file, data)) continue;
        stale.push(path.relative(ROOT, file));
        if (!check) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, data);
        }
    }
    return stale;
}

// What the generated files are made from.
function sourcePaths() {
    return [path.join(SRC, 'js', '99-player.js'), path.join(SRC, 'old-ui', 'music_player.template.html'), path.join(SRC, 'manifest.json'), path.join(SRC, 'assets', 'default-cover.svg'), path.join(SRC, 'assets', 'fonts'), path.join(SRC, 'assets', 'icons')];
}

// Writes the files now and again after any of their sources changes (debounced). Returns a function that stops.
function watch({ log = console.log, delay = 150 } = {}) {
    let timer = null;
    const regenerate = () => {
        timer = null;
        try {
            const changed = run();
            if (changed.length) log('gen-web: wrote ' + changed.join(', '));
        } catch (e) {
            log('gen-web: ' + e.message); // a half-saved file; the next change tries again
        }
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(regenerate, delay); };
    regenerate();
    const watchers = [];
    for (const source of sourcePaths()) {
        try {
            watchers.push(fs.watch(source, { recursive: true, persistent: true }, schedule));
        } catch (e) {
            // A source that is not there is not watched.
        }
    }
    return () => { if (timer) clearTimeout(timer); watchers.forEach((w) => w.close()); };
}

if (require.main === module && process.argv.includes('--watch')) {
    watch();
    console.log('gen-web: watching (Ctrl+C to stop)');
} else if (require.main === module) {
    const check = process.argv.includes('--check');
    const changed = run({ check });
    if (check) {
        if (changed.length) {
            console.error('Out of date: ' + changed.join(', ') + '\nRun: node tools/dev/gen-web.js');
            process.exit(1);
        }
        console.log('Generated web files are up to date.');
    } else {
        console.log(changed.length ? 'gen-web: wrote ' + changed.join(', ') : 'gen-web: nothing to change');
    }
}

module.exports = { run, generated, watch, sourcePaths, GENERATED_PATHS: ['src/player.js', 'src/music_player.html', 'src/fonts/', 'src/icons/'] };
