const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const configPath = path.join(__dirname, 'download-folder-config.json');

function getConfiguredDownloadFolder() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(data);
            if (parsed.downloadFolder) return parsed.downloadFolder;
        }
    } catch (e) {}
    return null;
}

function getDownloadFolder() {
    return getConfiguredDownloadFolder() || app.getPath('downloads');
}

function saveDownloadFolder(folder) {
    try {
        fs.writeFileSync(
            configPath,
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
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
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

function getUniqueFilePath(downloadFolder, url) {
    const rawFileName = url.split('/').pop().split('?')[0] || 'downloaded_audio.mp3';
    let fileName = decodeURIComponent(rawFileName);
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

function downloadFile(url, filePath, onProgress) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol
            .get(url, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    resolve({
                        success: false,
                        error: 'redirect not supported'
                    });
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;
                const fileStream = fs.createWriteStream(filePath);

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize > 0 && onProgress) {
                        const percent = Math.round((downloadedSize / totalSize) * 100);
                        onProgress(percent);
                    }
                });

                response.pipe(fileStream);

                fileStream.on('finish', async () => {
                    fileStream.close(() => {
                        resolve({
                            success: true,
                            filePath: filePath
                        });
                    });
                });

                fileStream.on('error', (err) => {
                    resolve({
                        success: false,
                        error: err.message
                    });
                });
            })
            .on('error', (err) => {
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
    download
};
