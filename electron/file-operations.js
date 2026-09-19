const { dialog } = require('electron');
const fs = require('fs');
const { getMainWindow } = require('./window-manager');

async function saveLyricsFile(defaultName, contents) {
    const result = await dialog.showSaveDialog(getMainWindow(), {
        title: 'Save Lyrics',
        defaultPath: defaultName,
        filters: [
            {
                name: 'LRC File',
                extensions: ['lrc']
            },
            {
                name: 'Text File',
                extensions: ['txt']
            },
            {
                name: 'All Files',
                extensions: ['*']
            }
        ]
    });

    if (result.canceled || !result.filePath)
        return {
            success: false,
            reason: 'cancelled'
        };

    try {
        fs.writeFileSync(result.filePath, contents, 'utf-8');
        return {
            success: true,
            filePath: result.filePath
        };
    } catch (e) {
        return {
            success: false,
            reason: e.message
        };
    }
}

async function readLyricsFile() {
    const result = await dialog.showOpenDialog(getMainWindow(), {
        title: 'Open LRC File',
        properties: ['openFile'],
        filters: [
            {
                name: 'LRC File',
                extensions: ['lrc']
            },
            {
                name: 'Text File',
                extensions: ['txt']
            },
            {
                name: 'All Files',
                extensions: ['*']
            }
        ]
    });

    if (result.canceled || result.filePaths.length === 0)
        return {
            success: false,
            reason: 'cancelled'
        };

    try {
        const contents = fs.readFileSync(result.filePaths[0], 'utf-8');
        return {
            success: true,
            contents: contents,
            filePath: result.filePaths[0]
        };
    } catch (e) {
        return {
            success: false,
            reason: e.message
        };
    }
}

module.exports = {
    saveLyricsFile,
    readLyricsFile
};
