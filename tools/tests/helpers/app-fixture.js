// Builds a throwaway copy of the real app (html/css/js from src/) with fake songs and a stubbed
// window.electronAPI, so UI logic can be tested in a headless browser. Shared by browser tests.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..', '..');
const PH =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23555'/></svg>";

function loadPlaywright() {
    for (const c of ['playwright', path.join(ROOT, 'electron', 'node_modules', 'playwright'), path.join(ROOT, 'node_modules', 'playwright')]) {
        try {
            return require(c);
        } catch (_) {
            /* next */
        }
    }
    return null;
}

async function launch(pw) {
    if (!pw) return null;
    for (const opts of [{}, { channel: 'msedge' }, { channel: 'chrome' }]) {
        try {
            return await pw.chromium.launch({ args: ['--allow-file-access-from-files'], ...opts });
        } catch (_) {
            /* next */
        }
    }
    return null;
}

function buildApp(songCount = 50) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), `apptest-${songCount}-`));
    fs.cpSync(path.join(ROOT, 'src', 'css'), path.join(out, 'css'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'src', 'js'), path.join(out, 'js'), { recursive: true });
    const fonts = path.join(ROOT, 'tools', 'fonts');
    if (fs.existsSync(fonts)) fs.cpSync(fonts, path.join(out, 'fonts'), { recursive: true });
    const songs = Array.from({ length: songCount }, (_, i) => ({
        id: i + 1, title: `Song title number ${i + 1}`, artist: `Artist ${i % 97}`, album: `Album ${i % 211}`,
        duration: 180 + (i % 120), path: `C:/m/${i}.mp3`, url: `file:///music/${i + 1}.mp3`, cover: PH, largeCover: PH, year: 2000 + (i % 25), genre: 'Pop', trackNumber: (i % 12) + 1
    }));
    const tpl = fs.readFileSync(path.join(ROOT, 'src', 'js', '99-player.js'), 'utf8');
    fs.writeFileSync(path.join(out, 'player.js'), tpl.replace('{{SONGS_DATA}}', () => JSON.stringify(songs)).replace('{{PLACEHOLDER_IMAGE}}', () => PH.replace(/'/g, "\\'")));
    let html = fs.readFileSync(path.join(ROOT, 'build', 'music_player.html'), 'utf8');
    html = html.replace('{{SONGS_COUNT}}', String(songCount)).split('{{PLACEHOLDER_IMAGE}}').join(PH);
    const stub = `<script>window.electronAPI = new Proxy({}, {get:(t,k)=> (k==='then')?undefined:(...a)=>{ if(/^on[A-Z]/.test(String(k))) return ()=>{}; return Promise.resolve(null);} });</script>\n`;
    html = html.replace('<script src="js/00-state.js">', stub + '<script src="js/00-state.js">');
    fs.writeFileSync(path.join(out, 'index.html'), html);
    return out;
}

module.exports = { ROOT, loadPlaywright, launch, buildApp };
