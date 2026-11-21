'use strict';

// Songs whose file is gone. The saved library keeps a song until something removes it, so a file deleted outside the app (or emptied from the
// Recycle Bin after the app moved it there) left a song that shows its title and cover and cannot be played.
//
//   findMissingSongs(songs, io)   the urls of the songs whose file does not exist any more, checked a few hundred at a time so the app stays alive
//   urlToPath(url)                the file path a song url stands for
//
// A file counts as gone only when its FOLDER still exists and the file is not in it. A folder that cannot be reached (an unplugged drive, a network
// share that is off) says nothing about its files, so those songs stay.

const fs = require('fs');
const path = require('path');

function urlToPath(url) {
    try {
        const u = new URL(url);
        let p = decodeURIComponent(u.pathname);
        if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(p)) p = p.slice(1);
        return p.split('/').join(path.sep);
    } catch (e) {
        return String(url || '').replace(/^file:\/\/\/?/, '');
    }
}

const defaultIo = {
    exists: (p) => fs.promises.access(p).then(() => true, (e) => (e && e.code === 'ENOENT' ? false : true)), // any other error: do not call it missing
    dirExists: (p) => fs.promises.stat(p).then((s) => s.isDirectory(), () => false),
    pause: () => new Promise((resolve) => setImmediate(resolve))
};

async function findMissingSongs(songs, io = {}) {
    const { exists, dirExists, pause } = { ...defaultIo, ...io };
    const chunk = 200;
    const dirs = new Map();
    const missing = [];
    const list = Array.isArray(songs) ? songs : [];
    for (let i = 0; i < list.length; i += chunk) {
        for (const song of list.slice(i, i + chunk)) {
            if (!song || typeof song.url !== 'string' || !song.url.startsWith('file:')) continue;
            const file = urlToPath(song.url);
            if (await exists(file)) continue;
            const dir = path.dirname(file);
            if (!dirs.has(dir)) dirs.set(dir, await dirExists(dir));
            if (dirs.get(dir)) missing.push(song.url);
        }
        await pause();
    }
    return missing;
}

module.exports = { findMissingSongs, urlToPath };
