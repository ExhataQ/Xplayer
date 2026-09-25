const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

function getScanScriptPath() {
    return path.join(__dirname, 'scan-folder.js');
}

function ensureCoversFolder(outputDir) {
    const coversFolder = path.join(outputDir, 'covers');
    if (!fs.existsSync(coversFolder))
        fs.mkdirSync(coversFolder, {
            recursive: true
        });
    return coversFolder;
}

function getStepTitle(prefix) {
    let stepTitle = 'Processing...';
    if (prefix.includes('Extracting covers')) stepTitle = 'Extracting Covers';
    if (prefix.includes('Scanning songs')) stepTitle = 'Scanning Songs';
    if (prefix.includes('GENERATING')) stepTitle = 'Generating Player';
    return stepTitle;
}

function runScan(args, options = {}) {
    return new Promise((resolve) => {
        const child = fork(getScanScriptPath(), args, {
            silent: true,
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1'
            }
        });

        let stdoutBuffer = '';
        let resultData = '';
        let lastStep = '';

        child.stdout.on('data', (data) => {
            const text = data.toString();
            resultData += text;

            if (options.stdoutProgressMode === 'simple') {
                stdoutBuffer += text;
                const progressMatch = stdoutBuffer.match(/\|█+\|?\s*(\d+)%/);
                if (progressMatch && options.onStdoutProgress) {
                    options.onStdoutProgress(parseInt(progressMatch[1]));
                    stdoutBuffer = '';
                }
                return;
            }

            if (options.onStdoutProgress) {
                stdoutBuffer += text;
                const lines = stdoutBuffer.split('\n');
                stdoutBuffer = lines.pop() || '';
                for (const line of lines) {
                    const progressMatch = line.match(/\|█+\|?\s*(\d+)%/);
                    if (progressMatch) {
                        const percent = parseInt(progressMatch[1]);
                        const stepTitle = getStepTitle(line);
                        if (options.trackStepChanges && stepTitle !== lastStep) {
                            options.onStdoutProgress(0, stepTitle);
                            lastStep = stepTitle;
                        }
                        options.onStdoutProgress(percent, stepTitle);
                    }
                }
            }
        });

        let settled = false;

        // A pipe delivers ~64KB chunks, so one long line (FASTRESULT, COVERBATCH) can arrive split
        // across chunks. Carry the incomplete tail over to the next chunk instead of parsing halves.
        let stderrCarry = '';
        child.stderr.on('data', (data) => {
            stderrCarry += data.toString();
            const lines = stderrCarry.split('\n');
            stderrCarry = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('FASTRESULT:')) {
                    try {
                        const songs = JSON.parse(line.slice('FASTRESULT:'.length));
                        if (options.onFastResult) options.onFastResult(songs);
                        if (options.resolveOnFastResult && !settled) {
                            settled = true;
                            resolve({
                                code: 0,
                                parsed: { success: true, songs, fastPass: true },
                                parseError: null,
                                resultData
                            });
                        }
                    } catch (e) {
                        // Intentionally silent: a malformed/truncated FASTRESULT line from the
                        // worker process shouldn't crash the parent; just skip that line.
                    }
                    continue;
                }
                if (line.startsWith('COVERBATCH:')) {
                    try {
                        const updates = JSON.parse(line.slice('COVERBATCH:'.length));
                        if (options.onCoverBatch) options.onCoverBatch(updates);
                    } catch (e) {
                        // Intentionally silent: same as above, a malformed COVERBATCH line
                        // is skipped rather than crashing the scan.
                    }
                    continue;
                }

                if (!options.onStderrProgress) continue;
                const match = line.match(/^PROGRESS:(\d+):(.+)$/);
                if (match) {
                    const percent = parseInt(match[1]);
                    const stepTitle = getStepTitle(match[2]);
                    if (options.trackStepChanges && stepTitle !== lastStep) {
                        options.onStderrProgress(0, stepTitle);
                        lastStep = stepTitle;
                    }
                    options.onStderrProgress(percent, stepTitle);
                }
            }
        });

        child.on('close', (code) => {
            if (options.onScanComplete) options.onScanComplete(code);
            if (settled) return;
            settled = true;

            let parsed = null;
            let parseError = null;

            if (code === 0 && options.jsonType) {
                try {
                    if (options.jsonType === 'array') {
                        parsed = extractJsonArray(resultData);
                    } else if (options.jsonType === 'object') {
                        parsed = extractJsonObject(resultData);
                    }
                } catch (err) {
                    parseError = err;
                }
            }

            resolve({
                code,
                parsed,
                parseError,
                resultData
            });
        });

        child.on('error', (error) => {
            resolve({
                code: null,
                parsed: null,
                parseError: error,
                resultData
            });
        });
    });
}

function updatePlayerSongs(outputDir, songs) {
    const jsPath = path.join(outputDir, 'player.js');
    if (!fs.existsSync(jsPath)) return false;

    const jsContent = fs.readFileSync(jsPath, 'utf-8');
    const newJsContent = jsContent.replace(
        /const SONGS_DATA = \[.*?\];/s,
        'const SONGS_DATA = ' + JSON.stringify(songs) + ';'
    );
    fs.writeFileSync(jsPath, newJsContent, 'utf-8');
    return true;
}

function extractJsonArray(rawOutput) {
    let cleanResult = rawOutput;
    cleanResult = cleanResult.replace(/[\r\n].*?\|[█░]*\|[^\n]*/g, '');
    cleanResult = cleanResult.replace(/[\r\n]+\s*$/g, '').trim();
    const jsonStart = cleanResult.indexOf('[');
    const jsonEnd = cleanResult.lastIndexOf(']') + 1;
    const jsonOnly =
        jsonStart >= 0 && jsonEnd > jsonStart
            ? cleanResult.substring(jsonStart, jsonEnd)
            : cleanResult;
    return JSON.parse(jsonOnly);
}

function extractJsonObject(rawOutput) {
    let jsonStr = rawOutput.trim();
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
    }
    return JSON.parse(jsonStr);
}

function mergeSongs(existingSongs, newSongs, prepend = false) {
    if (!Array.isArray(newSongs) || newSongs.length === 0) return null;
    if (!Array.isArray(existingSongs)) return null;

    const existingUrls = new Set(existingSongs.map((song) => song.url));
    const uniqueNewSongs = newSongs
        .filter((song) => !existingUrls.has(song.url))
        .map((song, index) => ({
            ...song,
            id: existingSongs.length + index
        }));

    const merged = prepend
        ? [...uniqueNewSongs, ...existingSongs]
        : [...existingSongs, ...uniqueNewSongs];

    return {
        songs: merged,
        newSongs: uniqueNewSongs
    };
}

function mergeAppend(existingSongs, newSongs) {
    return mergeSongs(existingSongs, newSongs, false);
}

function mergePrepend(existingSongs, newSongs) {
    return mergeSongs(existingSongs, newSongs, true);
}

function mergeNewSongs(outputDir, newSongs, prepend) {
    if (!newSongs || newSongs.length === 0) return null;

    const existingJsPath = path.join(outputDir, 'player.js');
    if (!fs.existsSync(existingJsPath)) return null;

    const existingContent = fs.readFileSync(existingJsPath, 'utf-8');
    const existingMatch = existingContent.match(/const SONGS_DATA = (\[.*?\]);/s);
    if (!existingMatch) return null;

    const existingSongs = JSON.parse(existingMatch[1]);
    const merged = prepend
        ? mergePrepend(existingSongs, newSongs)
        : mergeAppend(existingSongs, newSongs);
    if (!merged) return null;

    updatePlayerSongs(outputDir, merged.songs);
    return merged;
}

async function scanDroppedFiles(filePaths, outputDir) {
    ensureCoversFolder(outputDir);
    const result = await runScan(['__files__', outputDir, 'metadata-only', ...filePaths], {
        jsonType: 'array'
    });

    if (result.code !== 0) {
        return {
            success: false,
            error: 'Scan failed'
        };
    }

    if (result.parseError) {
        return {
            success: false,
            error: 'Parse error: ' + result.parseError.message
        };
    }

    const merged = mergeNewSongs(outputDir, result.parsed, false);
    if (!merged) {
        return {
            success: false,
            error: 'No valid songs found'
        };
    }

    return {
        success: true,
        songs: merged.songs,
        newSongs: merged.newSongs
    };
}

async function scanDownloadedFile(downloadFolder, outputDir, filePath, isTemp) {
    const result = await runScan([downloadFolder, outputDir, 'metadata-only', filePath], {
        jsonType: 'array'
    });

    if (result.code === 0) {
        if (result.parseError) {
            return {
                success: false,
                error: 'Parse error: ' + result.parseError.message
            };
        }

        const merged = mergeNewSongs(outputDir, result.parsed, true);
        if (merged) {
            return {
                success: true,
                songs: merged.songs,
                newSongs: merged.newSongs,
                filePath: filePath,
                isTemp: isTemp
            };
        }
    }

    return {
        success: false,
        error: 'Failed to scan file'
    };
}

async function rebuildFromFolders(outputDir, options = {}) {
    const mode = options.streamed ? 'rebuild-all-streamed' : 'rebuild-all';
    const result = await runScan(['__rebuild__', outputDir, mode], {
        jsonType: 'object',
        onStdoutProgress: options.onStdoutProgress,
        onStderrProgress: options.onStderrProgress,
        onFastResult: options.onFastResult,
        onCoverBatch: options.onCoverBatch,
        onScanComplete: options.onScanComplete,
        resolveOnFastResult: options.streamed
    });

    if (result.code === null) {
        return {
            success: false,
            reason: 'spawn-error',
            error: result.parseError ? result.parseError.message : undefined
        };
    }

    if (result.code !== 0) {
        return {
            success: false,
            reason: 'scan-error',
            code: result.code
        };
    }

    if (result.parseError) {
        return {
            success: false,
            reason: 'parse-error',
            error: result.parseError.message
        };
    }

    const parsed = result.parsed;
    if (!(parsed.success && parsed.songs)) {
        return {
            success: false,
            reason: 'no-songs',
            error: parsed && parsed.error
        };
    }

    const jsPath = path.join(outputDir, 'player.js');
    if (!fs.existsSync(jsPath)) {
        return {
            success: false,
            reason: 'file-not-found'
        };
    }

    let jsContent = fs.readFileSync(jsPath, 'utf-8');
    const newJsContent = jsContent.replace(
        /const SONGS_DATA = \[.*?\];/s,
        'const SONGS_DATA = ' + JSON.stringify(parsed.songs) + ';'
    );
    fs.writeFileSync(jsPath, newJsContent, 'utf-8');

    return {
        success: true,
        songs: parsed.songs
    };
}

async function scanFolder(folderPath, outputDir, options = {}) {
    const args = options.streamed ? [folderPath, outputDir, 'full-streamed'] : [folderPath, outputDir];
    const result = await runScan(args, {
        jsonType: 'object',
        onStdoutProgress: options.onStdoutProgress,
        onStderrProgress: options.onStderrProgress,
        stdoutProgressMode: options.stdoutProgressMode,
        trackStepChanges: options.trackStepChanges,
        onFastResult: options.onFastResult,
        onCoverBatch: options.onCoverBatch,
        onScanComplete: options.onScanComplete,
        resolveOnFastResult: options.streamed
    });
    return result;
}

module.exports = {
    extractJsonArray,
    extractJsonObject,
    mergeAppend,
    mergePrepend,
    scanDroppedFiles,
    scanDownloadedFile,
    rebuildFromFolders,
    scanFolder
};
