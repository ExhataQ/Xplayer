import { playerPart } from './player-parts.js';

function engineFunction(name) {
    const fn = window[name];
    if (typeof fn !== 'function') throw new Error(`Engine action "${name}" is not available`);
    return fn;
}

function audioElement() {
    const audio = window.audioElement;
    if (!audio) throw new Error('Engine audio element is not available');
    return audio;
}

function clickPart(name) {
    const element = playerPart(name);
    if (!element) throw new Error(`Player control "${name}" is not available`);
    element.click();
}

function requireId(value, label) {
    if (value === null || value === undefined || value === '') throw new TypeError(`${label} is required`);
}

export function playSongFromList(songId, listId = null, clickedIndex = null) {
    requireId(songId, 'songId');
    return engineFunction('playSongFromList')(songId, listId, clickedIndex);
}

export function play() {
    if (audioElement().paused) clickPart('play');
}

export function pause() {
    if (!audioElement().paused) clickPart('play');
}

export function togglePlayback() {
    clickPart('play');
}

export function next() {
    clickPart('next');
}

export function previous() {
    clickPart('prev');
}

export function seekTo(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Seek position must be a finite, non-negative number');
    const audio = audioElement();
    audio.currentTime = Number.isFinite(audio.duration) ? Math.min(seconds, audio.duration) : seconds;
}

export function setVolume(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Volume must be between 0 and 1');
    return engineFunction('updateVolume')(value);
}

export function toggleMute() {
    return engineFunction('toggleMute')();
}

export function toggleFavorite(songId) {
    requireId(songId, 'songId');
    return engineFunction('toggleFavorite')(songId);
}

export function addSongToQueueNext(songId) {
    requireId(songId, 'songId');
    return engineFunction('addSongToQueueNext')(songId);
}

export function switchView(view) {
    if (typeof view !== 'string' || !view.trim()) throw new TypeError('view must be a non-empty string');
    return engineFunction('switchView')(view);
}

export function openAlbum(albumId) {
    requireId(albumId, 'albumId');
    return engineFunction('openAlbum')(albumId);
}

export function openArtist(artistId) {
    requireId(artistId, 'artistId');
    return engineFunction('openArtist')(artistId);
}

export function goBack() {
    return engineFunction('goBack')();
}

export function goForward() {
    return engineFunction('goForward')();
}
