'use strict';

// Starts the real app (Electron from node_modules) on a throwaway data folder and checks the basics through the debugging port.
//
//   npm run smoke
//   npm run smoke -- --ui=current        the same on the old interface
//
// Checks: the page is the new interface (or the one asked for), a cover file in the data folder loads as covers/<file>,
// Settings > About has its three calls, a second copy on the same data folder quits, a copy on another folder keeps running, and
// the log file was written. Needs a display (on Linux: xvfb-run -a npm run smoke). Takes about 20 seconds. Nothing in your own
// library or settings is touched: the data folder is made in the system temp folder and removed at the end.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9341;
const extra = process.argv.slice(2);
const wantOld = extra.includes('--ui=current') || extra.includes('--ui=old');

function png() {
    // A small red square, so the page can tell a loaded cover from a missing one by its width.
    const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => {
        const body = Buffer.concat([Buffer.from(type), data]);
        const out = Buffer.alloc(8 + data.length + 4);
        out.writeUInt32BE(data.length, 0);
        body.copy(out, 4);
        out.writeUInt32BE(crc(body), 8 + data.length);
        return out;
    };
    const head = Buffer.alloc(13);
    head.writeUInt32BE(8, 0);
    head.writeUInt32BE(8, 4);
    head[8] = 8;
    head[9] = 2;
    const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(8 * 3, 0xff)]);
    const raw = Buffer.concat(Array.from({ length: 8 }, () => row));
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const results = [];
const check = (name, ok, detail = '') => {
    results.push(ok);
    console.log((ok ? 'ok      ' : 'FAILED  ') + name + (detail ? '  (' + detail + ')' : ''));
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const { chromium } = require('playwright');
    require('./gen-web').run(); // the generated page files must exist
    const electron = process.env.XPLAYER_ELECTRON || require('electron'); // XPLAYER_ELECTRON: path of an electron executable to use instead
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-smoke-'));
    const data = path.join(base, 'data');
    fs.mkdirSync(path.join(data, 'library', 'covers'), { recursive: true });
    fs.writeFileSync(path.join(data, 'library', 'covers', 'x.png'), png());
    const flags = process.platform === 'linux' ? ['--no-sandbox'] : [];
    const env = { ...process.env, XPLAYER_DATA: data };
    const children = [];
    const start = (args, overrides = {}) => {
        const child = spawn(electron, [ROOT, ...flags, ...args], { env: { ...env, ...overrides }, stdio: 'ignore' });
        children.push(child);
        return child;
    };

    try {
        start([`--remote-debugging-port=${PORT}`, ...extra]);
        let browser = null;
        for (let i = 0; i < 60 && !browser; i++) {
            try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch (e) { await wait(500); }
        }
        check('the app starts and the debugging port answers', Boolean(browser));
        if (!browser) return;
        await wait(3500);
        const page = browser.contexts().flatMap((c) => c.pages())[0];
        const url = page.url();
        check(wantOld ? 'the old interface is the page' : 'the new interface is the page', wantOld ? url.endsWith('/src/music_player.html') : url.endsWith('/src/ui-next/index.html'), url.split('/src/')[1]);
        const covers = await page.evaluate(() => new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img.naturalWidth); img.onerror = () => resolve(0); img.src = 'covers/x.png'; }));
        check('a cover in the data folder loads as covers/<file>', covers === 8, 'width ' + covers);
        const about = await page.evaluate(async () => {
            const api = window.desktopApi;
            return { info: await api.app.getAppInfo(), copy: await api.app.copyDiagnostics(), open: api.supports('app.openDataFolder') };
        });
        check('Settings > About: version, data folder and diagnostics answer', about.info.dataDir === data && about.copy.success === true && about.open === true, about.info.mode);

        const second = start([]);
        const t0 = Date.now();
        const code = await Promise.race([new Promise((resolve) => second.on('exit', resolve)), wait(10000).then(() => 'still running')]);
        check('a second copy on the same data folder quits', code === 0, code + ' after ' + (Date.now() - t0) + ' ms');

        const other = start([`--remote-debugging-port=${PORT + 1}`], { XPLAYER_DATA: data + '-b' });
        await wait(6000);
        check('a copy on another data folder keeps running', other.exitCode === null);

        const log = path.join(data, 'logs', 'main.log');
        check('the log was written', fs.existsSync(log) && /another copy is already running/.test(fs.readFileSync(log, 'utf8')));
    } finally {
        for (const child of children) child.kill();
        await wait(500);
        fs.rmSync(base, { recursive: true, force: true });
        fs.rmSync(path.join(os.tmpdir(), path.basename(base) + '-b'), { recursive: true, force: true });
    }
}

main()
    .then(() => process.exit(results.length && results.every(Boolean) ? 0 : 1))
    .catch((error) => {
        console.error('smoke failed: ' + error.message);
        process.exit(1);
    });
