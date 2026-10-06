const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const { configPath: settingsFile } = require('./storage-paths');

function getConfigFile() {
    return settingsFile('downloadFolder');
}

function getConfiguredDownloadFolder() {
    try {
        if (fs.existsSync(getConfigFile())) {
            const data = fs.readFileSync(getConfigFile(), 'utf-8');
            const parsed = JSON.parse(data);
            if (parsed.downloadFolder) return parsed.downloadFolder;
        }
    } catch (e) {
        // Intentionally silent: missing/corrupt config just falls back to the default below.
    }
    return null;
}

function getDownloadFolder() {
    return getConfiguredDownloadFolder() || app.getPath('downloads');
}

function saveDownloadFolder(folder) {
    try {
        fs.writeFileSync(
            getConfigFile(),
            JSON.stringify({ downloadFolder: folder }, null, 2),
            'utf-8'
        );
        return {
            success: true,
            folder: folder
        };
    } catch (e) {
        return {
            success: false,
            reason: e.message
        };
    }
}

function resetDownloadFolder() {
    try {
        if (fs.existsSync(getConfigFile())) fs.unlinkSync(getConfigFile());
        return {
            success: true
        };
    } catch (e) {
        return {
            success: false,
            reason: e.message
        };
    }
}

function getDownloadTargetFolder(isTemp) {
    if (isTemp) return path.join(require('os').tmpdir(), 'music-player-temp');
    return getDownloadFolder();
}

// The name to save a download under, taken from the last part of the URL. It is only ever a plain
// file name (never a path), so a URL like ".../a%2F..%2F..%2Fx.mp3" cannot write outside the folder.
function safeDownloadFileName(url) {
    let raw = '';
    try {
        raw = new URL(url).pathname.split('/').pop() || '';
    } catch (e) {
        raw = String(url || '').split('?')[0].split('#')[0].split('/').pop() || '';
    }
    let name;
    try {
        name = decodeURIComponent(raw);
    } catch (e) {
        name = raw;
    }
    name = name
        .split(/[\\/]/).pop()
        .replace(/[<>:"|?*\x00-\x1F]/g, '_')
        .replace(/[. ]+$/g, '')
        .trim();
    if (!name || name === '.' || name === '..') name = 'downloaded_audio.mp3';
    return name;
}

function getUniqueFilePath(downloadFolder, url) {
    let fileName = safeDownloadFileName(url);
    let filePath = path.join(downloadFolder, fileName);
    let counter = 1;

    while (fs.existsSync(filePath)) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        fileName = `${base} (${counter})${ext}`;
        filePath = path.join(downloadFolder, fileName);
        counter++;
    }

    return filePath;
}

const MAX_REDIRECTS = 5;

function downloadFile(url, filePath, onProgress, redirectsLeft = MAX_REDIRECTS) {
    return new Promise((resolve) => {
        let parsed;
        try {
            parsed = new URL(url);
        } catch (e) {
            resolve({ success: false, error: 'Invalid URL' });
            return;
        }
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            resolve({ success: false, error: 'Only http and https links can be downloaded' });
            return;
        }
        const protocol = parsed.protocol === 'https:' ? https : http;

        const request = protocol.get(parsed, (response) => {
            const status = response.statusCode || 0;

            if (status >= 300 && status < 400 && response.headers.location) {
                response.resume();
                if (redirectsLeft <= 0) {
                    resolve({ success: false, error: 'Too many redirects' });
                    return;
                }
                let next;
                try {
                    next = new URL(response.headers.location, parsed).toString();
                } catch (e) {
                    resolve({ success: false, error: 'Invalid redirect' });
                    return;
                }
                // Nothing has been written yet, so name the file after where the redirect leads.
                resolve(downloadFile(next, getUniqueFilePath(path.dirname(filePath), next), onProgress, redirectsLeft - 1));
                return;
            }

            if (status < 200 || status >= 300) {
                response.resume();
                resolve({ success: false, error: `Download failed (HTTP ${status})` });
                return;
            }

            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;
            let finished = false;
            const fileStream = fs.createWriteStream(filePath);

            const fail = (message) => {
                if (finished) return;
                finished = true;
                response.destroy();
                fileStream.destroy();
                // Do not leave a half-written file behind.
                fs.unlink(filePath, () => resolve({ success: false, error: message }));
            };

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (totalSize > 0 && onProgress) {
                    const percent = Math.round((downloadedSize / totalSize) * 100);
                    onProgress(percent);
                }
            });

            response.on('error', (err) => fail(err.message));
            response.on('aborted', () => fail('The connection was closed before the download finished'));

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                if (finished) return;
                if (totalSize > 0 && downloadedSize < totalSize) {
                    fail('The download ended early');
                    return;
                }
                finished = true;
                fileStream.close(() => {
                    resolve({
                        success: true,
                        filePath: filePath
                    });
                });
            });

            fileStream.on('error', (err) => fail(err.message));
        });

        request.on('error', (err) => {
            resolve({
                success: false,
                error: err.message
            });
        });
    });
}

async function download(url, isTemp, onProgress) {
    const downloadFolder = getDownloadTargetFolder(isTemp);

    if (isTemp && !fs.existsSync(downloadFolder))
        fs.mkdirSync(downloadFolder, {
            recursive: true
        });

    const filePath = getUniqueFilePath(downloadFolder, url);
    return downloadFile(url, filePath, onProgress);
}

module.exports = {
    getDownloadFolder,
    saveDownloadFolder,
    resetDownloadFolder,
    download,
    safeDownloadFileName,
    getUniqueFilePath
};
