// player-parts (proposal for requests R-C3 and R-C4 from Agent C).
//
// The only other file besides legacy-dom-adapter.js that knows the engine's element names. Views import from here and
// never look an id up themselves (gate 13, ENGINE-CONTRACT.md L-01).
//
//   playerPart(name) -> HTMLElement | null     the player's elements by a stable, view-facing name
//   onTime(callback) -> unsubscribe()          callback({ currentTime, duration, playing }); ONE shared listener (L-04)
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
    'volume-icon': '#volume-icon',
    lyrics: '#lyrics-toggle-btn',
    cover: '#player-cover',
    title: '#player-title',
    artist: '#player-artist'
};

export const PLAYER_PART_NAMES = Object.freeze(Object.keys(PARTS));

export function playerPart(name) {
    const selector = PARTS[name];
    return selector ? document.querySelector(selector) : null;
}

const listeners = new Set();
let audio = null;

function snapshot() {
    return { currentTime: audio.currentTime || 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0, playing: !audio.paused && !audio.ended };
}

function emit() {
    const state = snapshot();
    for (const listener of [...listeners]) listener(state);
}

const EVENTS = ['timeupdate', 'durationchange', 'loadedmetadata', 'emptied', 'seeked', 'play', 'pause', 'ended'];

/** Subscribes to playback position. The first subscriber attaches the single shared listeners; the last one removes them. */
export function onTime(callback) {
    if (!listeners.size) {
        audio = document.getElementById('audio');
        if (!audio) return () => {};
        for (const name of EVENTS) audio.addEventListener(name, emit);
    }
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
        if (!listeners.size && audio) for (const name of EVENTS) audio.removeEventListener(name, emit);
    };
}
