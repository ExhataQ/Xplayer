// player-parts (proposal for requests R-C3 and R-C4 from Agent C).
//
// The only other file besides legacy-dom-adapter.js that knows the engine's element names. Views import from here and
// never look an id up themselves (gate 13, ENGINE-CONTRACT.md L-01).
//
//   playerPart(name) -> HTMLElement | null     the player's elements by a stable, view-facing name
//   onTime(callback) -> unsubscribe()          callback({ currentTime, duration, playing, src }); ONE shared listener (L-04)
//
// The names on the left are the contract with views; the ids on the right may change with the engine.

const PARTS = {
    shuffle: '#shuffle-btn',
    prev: '#prev-btn',
    play: '#play-btn',
    next: '#next-btn',
    repeat: '#repeat-btn',
    'time-current': '#current-time',
    'time-total': '#total-time',
    seek: '.progress-container',
    'seek-fill': '#progress-bar',
    volume: '#volume-slider',
    'volume-fill': '#volume-fill',
    'volume-icon': '#volume-icon',
    lyrics: '#lyrics-toggle-btn',
    cover: '#player-cover',
    title: '#player-title',
    artist: '#player-artist',
    'song-info': '.player-song-info',
    'right-controls': '.player-right-controls'
};

export const PLAYER_PART_NAMES = Object.freeze(Object.keys(PARTS));

export function playerPart(name) {
    const selector = PARTS[name];
    return selector ? document.querySelector(selector) : null;
}

const listeners = new Set();
let audio = null;
let watcher = 0;

// The engine plays on one of two <audio> elements and swaps them at a track change when gapless playback is on, which is
// the default (playback/10c usePreloadedGaplessTrack, setAudioElement). The page's own element then goes idle, so the
// reader follows whichever element the engine reports as active and moves its listeners when that changes.
const activeAudio = () => window.audioElement || document.getElementById('audio');

function snapshot() {
    return { currentTime: audio.currentTime || 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0, playing: !audio.paused && !audio.ended, src: audio.currentSrc || '' };
}

function emit() {
    const state = snapshot();
    for (const listener of [...listeners]) listener(state);
}

const EVENTS = ['timeupdate', 'durationchange', 'loadstart', 'loadedmetadata', 'emptied', 'seeked', 'play', 'pause', 'ended'];

function bind(next) {
    if (audio === next) return;
    if (audio) for (const name of EVENTS) audio.removeEventListener(name, emit);
    audio = next;
    if (audio) for (const name of EVENTS) audio.addEventListener(name, emit);
}

function follow() {
    const now = activeAudio();
    if (now && now !== audio) {
        bind(now);
        emit();
    }
}

/**
 * Subscribes to playback position. The first subscriber attaches the single shared listeners; the last one removes them.
 * With { immediate: true } the callback also gets the current state once, now (a view that starts while a song is already
 * playing or paused would otherwise wait for the next time event, which a paused song never sends).
 */
export function onTime(callback, { immediate = false } = {}) {
    if (!listeners.size) {
        const first = activeAudio();
        if (!first) return () => {};
        bind(first);
        watcher = setInterval(follow, 150);
    }
    listeners.add(callback);
    if (immediate && audio) callback(snapshot());
    return () => {
        listeners.delete(callback);
        if (!listeners.size) {
            clearInterval(watcher);
            bind(null);
        }
    };
}
