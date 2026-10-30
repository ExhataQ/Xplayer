const { spawn: realSpawn } = require('child_process');
const path = require('path');
const { createTagBackend } = require('./tag-backend');
const { createNodeBackend } = require('./tag-node-backend');

// Tags are read and written by the Node backend when it can (tag-node-backend.js) and otherwise by metadata-editor.py (Python + the mutagen package). When Python cannot run, the answer says exactly why and
// what to do, with a `reason` the callers can test: 'no-python' (no Python 3 on this computer), 'no-mutagen' (Python is there, the package is
// not) or 'failed' (the script ran and crashed). The first two will not fix themselves between two songs, so for RETRY_MS every call answers
// at once instead of starting a process per song to find out again; after that it looks again, so installing mutagen needs no restart.
const INSTALL = 'python -m pip install mutagen';
const MESSAGES = {
    'no-python': `Tags cannot be read or saved yet: Python 3 was not found on this computer. Install Python 3 (python.org), then run: ${INSTALL}`,
    'no-mutagen': `Tags cannot be read or saved yet: the Python package "mutagen" is not installed. Install it with: ${INSTALL}`
};
const RETRY_MS = 30000;

function createPythonRunner({ spawn = realSpawn, platform = process.platform, now = Date.now, script = path.join(__dirname, 'metadata-editor.py') } = {}) {
    const candidates = platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
    let unavailable = null; // { reason, at }
    const lastLine = (text) => String(text).trim().split(/\r?\n/).filter(Boolean).pop() || 'Metadata operation failed';

    return function runMetadataPython(request) {
        return new Promise((resolve) => {
            if (unavailable && now() - unavailable.at < RETRY_MS) return resolve({ success: false, reason: unavailable.reason, error: MESSAGES[unavailable.reason] });
            let i = 0;
            let sawNoMutagen = false; // some Python on this computer answered, and it has no mutagen
            let crash = ''; // some Python ran the script and it crashed for another reason
            const finish = (result) => {
                if (result.reason === 'no-python' || result.reason === 'no-mutagen') unavailable = { reason: result.reason, at: now() }; // a call only runs once the last record is older than RETRY_MS, so there is nothing to clear
                resolve(result);
            };
            const next = () => {
                if (i >= candidates.length) {
                    if (sawNoMutagen) return finish({ success: false, reason: 'no-mutagen', error: MESSAGES['no-mutagen'] });
                    if (crash) return finish({ success: false, reason: 'failed', error: crash });
                    return finish({ success: false, reason: 'no-python', error: MESSAGES['no-python'] });
                }
                const cmd = candidates[i++];
                const args = cmd === 'py' ? ['-3', script] : [script];
                const outChunks = []; // bytes, joined and decoded once: a character can be split between two chunks
                let out = '';
                let err = '';
                let moved = false; // a failed start can raise 'error' and then 'close': go on only once
                const advance = () => {
                    if (moved) return;
                    moved = true;
                    next();
                };
                let child;
                try { child = spawn(cmd, args, { windowsHide: true, env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } }); } catch (e) { return advance(); }
                child.stdout.on('data', (c) => { outChunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c), 'utf8')); });
                child.stderr.on('data', (c) => { err += c; });
                child.on('error', advance);
                child.on('close', (code) => {
                    if (moved) return;
                    out = Buffer.concat(outChunks).toString('utf8');
                    if (code !== 0 && !out) {
                        if (/No module named ['"]?mutagen/.test(err)) sawNoMutagen = true;
                        else if (/Traceback/.test(err)) crash = lastLine(err);
                        return advance();
                    }
                    moved = true;
                    try { finish(JSON.parse(out.trim())); } catch (e) { finish({ success: false, reason: 'failed', error: err.trim() || 'Metadata operation failed' }); }
                });
                child.stdin.on('error', () => {});
                child.stdin.end(JSON.stringify(request));
            };
            next();
        });
    };
}
const runMetadataPython = createPythonRunner();
function fileUrlToPath(fileUrl){if(!fileUrl)return ''; try{const u=new URL(fileUrl);let p=decodeURIComponent(u.pathname);if(process.platform==='win32'&&/^\/[A-Za-z]:/.test(p))p=p.slice(1);return p.replace(/\//g,path.sep);}catch(e){return String(fileUrl).replace(/^file:\/\//,'').replace(/\//g,path.sep);}}
const python = {
    getAudioMetadata: (fileUrl) => runMetadataPython({ action: 'read', path: fileUrlToPath(fileUrl) }),
    saveAudioMetadata: (fileUrl, metadata, coverPath = '') => runMetadataPython({ action: 'save', path: fileUrlToPath(fileUrl), metadata, coverPath }),
    saveAudioCover: (fileUrl, imagePath) => runMetadataPython({ action: 'cover', path: fileUrlToPath(fileUrl), imagePath })
};
// Node first (electron/tag-node-backend.js), Python as the fallback (electron/tag-backend.js).
const { getAudioMetadata, saveAudioMetadata, saveAudioCover } = createTagBackend({
    node: createNodeBackend({ toPath: fileUrlToPath }),
    python,
    mode: process.env.XPLAYER_TAG_BACKEND
});
module.exports = { getAudioMetadata, saveAudioMetadata, saveAudioCover, createPythonRunner, fileUrlToPath };
