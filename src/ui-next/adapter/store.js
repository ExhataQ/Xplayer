function engineValue(name) {
    if (!Object.prototype.hasOwnProperty.call(window, name)) {
        throw new Error(`Engine state "${name}" is not available`);
    }
    return window[name];
}

function copySong(song) {
    return song && typeof song === 'object' ? { ...song } : song;
}

function copyQueueItem(item) {
    if (!item || typeof item !== 'object') return item;
    if (item.song && typeof item.song === 'object') return { ...item, song: copySong(item.song) };
    return copySong(item);
}

export function getCurrentView() {
    return engineValue('currentView');
}

export function getQueue() {
    return engineValue('playbackQueue').map(copyQueueItem);
}

export function getQueueIndex() {
    return engineValue('currentQueueIndex');
}

export function getCurrentSong() {
    const item = engineValue('playbackQueue')[engineValue('currentQueueIndex')];
    return item ? copySong(item.song || item) : null;
}

export function isPlaying() {
    const audio = engineValue('audioElement');
    return !audio.paused && !audio.ended;
}

export function getVolume() {
    const volume = window.lastVolume;
    return Number.isFinite(volume) ? volume : engineValue('audioElement').volume;
}

export function isMuted() {
    return engineValue('audioElement').muted;
}

export function getRepeatMode() {
    return engineValue('repeatMode');
}

export function isShuffled() {
    return engineValue('isShuffled');
}

export function getSelection() {
    return new Set(engineValue('selectedSongIds'));
}

export function songs(listId) {
    const getSongs = window.getSongsForList;
    if (typeof getSongs !== 'function') throw new Error('Engine action "getSongsForList" is not available');
    const result = getSongs(listId);
    if (!Array.isArray(result)) throw new TypeError('Engine getSongsForList() did not return an array');
    return result.map(copySong);
}
