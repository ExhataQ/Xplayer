// Checks for the arguments that the page sends to the main process, so a handler never acts on
// something that is not the kind of value it expects.

const fs = require('fs');
const path = require('path');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.mp4', '.aac', '.ogg', '.opus', '.wma', '.wav', '.aiff', '.aif', '.ape', '.wv']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function isAbsolutePath(value) {
    return typeof value === 'string' && value.length > 0 && !value.includes('\0') && path.isAbsolute(value);
}

function hasExtension(value, extensions) {
    return isAbsolutePath(value) && extensions.has(path.extname(value).toLowerCase());
}

const isAudioPath = (value) => hasExtension(value, AUDIO_EXTENSIONS);
const isImagePath = (value) => hasExtension(value, IMAGE_EXTENSIONS);

function isDirectory(value) {
    try {
        return isAbsolutePath(value) && fs.statSync(value).isDirectory();
    } catch (e) {
        return false;
    }
}

function isHttpUrl(value) {
    if (typeof value !== 'string') return false;
    try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
    } catch (e) {
        return false;
    }
}

// The entries of `value` that are strings; anything that is not a list gives an empty list.
function stringList(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

module.exports = {
    AUDIO_EXTENSIONS,
    isAbsolutePath,
    isAudioPath,
    isImagePath,
    isDirectory,
    isHttpUrl,
    stringList
};
