'use strict';

// A-04 module-loading spike. Run it with the real Electron, from the project root:
//
//   App\electron.exe tools\spike-modules\run-spike.js electron\MusicPlayerOutput
//
// (the folder is whatever your build produced: it contains music_player.html and player.js).
// It copies that folder to a temp folder, adds a <script type="module"> after player.js,
// loads the page in a hidden window with the same webPreferences as the app, prints PASS or
// FAIL for each check and exits 0 only if every check passes. Your build folder is not changed.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox'); // only needed when running as root (CI); harmless otherwise

const sourceDir = path.resolve(process.argv[process.argv.length - 1]);

app.whenReady().then(async () => {
    let exitCode = 1;
    try {
        const htmlName = ['music_player.html', 'index.html'].find((n) => fs.existsSync(path.join(sourceDir, n)));
        if (!htmlName) throw new Error(`no music_player.html or index.html in ${sourceDir}`);

        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'module-spike-'));
        fs.cpSync(sourceDir, tmp, { recursive: true });
        for (const f of ['spike-module.js', 'spike-sibling.js']) fs.copyFileSync(path.join(__dirname, f), path.join(tmp, f));

        const htmlPath = path.join(tmp, htmlName);
        let html = fs.readFileSync(htmlPath, 'utf8');
        const tag = '<script src="player.js"></script>';
        if (!html.includes(tag)) throw new Error('the page has no <script src="player.js"> tag to put the spike after');
        html = html.replace(tag, `<script>window.__spikeOrder = [];</script>
${tag}
<script>window.__spikeOrder.push('player.js done');</script>
<script type="module" src="spike-module.js"></script>
<button id="spike-btn" onclick="window.__inline = typeof spikeBridged === 'function' ? spikeBridged() : 'not visible'"></button>`);
        fs.writeFileSync(htmlPath, html);

        const win = new BrowserWindow({
            show: false, width: 1500, height: 900,
            webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false }
        });
        win.webContents.on('console-message', (e, level, message) => {
            const text = typeof level === 'object' ? level.message : message;
            if (/uncaught|error/i.test(text)) console.log('[page] ' + text);
        });
        await win.loadFile(htmlPath);
        await new Promise((r) => setTimeout(r, 2500));

        const out = await win.webContents.executeJavaScript(`(() => {
            document.getElementById('spike-btn').click();
            return JSON.stringify({ spike: window.__spike || null, inline: window.__inline || null, ua: navigator.userAgent });
        })()`);
        const { spike, inline, ua } = JSON.parse(out);
        if (!spike) throw new Error('the module never ran (window.__spike is missing)');

        const rows = Object.entries(spike.checks).map(([name, c]) => ({ name, ok: c.ok, detail: c.detail }));
        const order = spike.order;
        rows.push({
            name: '4 order: player.js, then module, then DOMContentLoaded',
            ok: JSON.stringify(order) === JSON.stringify(['player.js done', 'module', 'DOMContentLoaded']),
            detail: JSON.stringify(order)
        });
        rows.push({ name: '5b inline onclick can call a function the module put on window', ok: inline === 'bridged-ok', detail: String(inline) });

        console.log('Electron/Chromium: ' + (/Electron\/[\d.]+/.exec(ua) || ['?'])[0] + ' ' + (/Chrome\/[\d.]+/.exec(ua) || ['?'])[0]);
        for (const r of rows.sort((a, b) => a.name.localeCompare(b.name))) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`);
        exitCode = rows.every((r) => r.ok) ? 0 : 1;
        console.log(exitCode === 0 ? 'RESULT: all checks pass' : 'RESULT: at least one check failed');
        fs.rmSync(tmp, { recursive: true, force: true });
    } catch (error) {
        console.log('SPIKE ERROR: ' + error.message);
    }
    app.exit(exitCode);
});
