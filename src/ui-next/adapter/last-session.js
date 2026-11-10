// last-session (Home hero): remembers the song that is playing and where it was, so Home can offer to pick it up after the app was
// closed in the middle of a song. Stores only { id, position, duration } under one localStorage key; the title, artist and cover are read
// from the library when Home asks. It never starts playing by itself: Resume is a button on Home.
//
//   startSessionMemory()          -> stop(); saves once the engine is up (the shell mounts before the engine's modules run)
//   currentHero()                 -> { mode: 'playing' | 'paused' | 'resume', song, position, duration } or null
//   resumeSession(session, from)  -> plays the saved song, from the saved position when `from` is true

import { playSongFromList } from './actions.js';
import { nowPlaying } from './engine-api.js';
import { onTime } from './player-parts.js';
import { SESSION, sessionToSave } from './last-session-math.js';

const KEY = 'xplayer.ui-next.last-session';
const audio = () => window.audioElement || null;
const find = (id) => (window.SONGS_DATA || []).find((s) => String(s.id) === String(id));
const describe = (s) => ({ id: s.id, title: String(s.title || ''), artist: String(s.artist || 'Unknown Artist'), album: String(s.album || ''), cover: s.cover || '' });

function save(position, duration) {
    const song = nowPlaying();
    if (!song) return; // nothing loaded: keep what was saved
    const record = sessionToSave({ id: song.id, position, duration });
    try {
        if (record) localStorage.setItem(KEY, JSON.stringify(record));
        else localStorage.removeItem(KEY);
    } catch (_) {
        /* nothing to pick up next time */
    }
}

export function startSessionMemory() {
    let last = 0;
    let stop = () => {};
    const close = () => audio() && save(audio().currentTime, audio().duration);
    const begin = () => {
        stop = onTime((s) => {
            if (s.playing && Date.now() - last < SESSION.saveEveryMs) return;
            last = Date.now();
            save(s.currentTime, s.duration);
        });
        window.addEventListener('pagehide', close);
    };
    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', begin, { once: true });
    return () => {
        window.removeEventListener('load', begin);
        window.removeEventListener('pagehide', close);
        stop();
    };
}

export function currentHero() {
    const playing = nowPlaying();
    const a = audio();
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(KEY));
    } catch (_) {
        /* none */
    }
    const song = find(playing && a ? playing.id : saved && saved.id);
    if (!song) return null;
    if (playing && a) return { mode: a.paused ? 'paused' : 'playing', song: describe(song), position: a.currentTime || 0, duration: Number.isFinite(a.duration) ? a.duration : 0 };
    return saved ? { mode: 'resume', song: describe(song), position: Number(saved.position) || 0, duration: Number(saved.duration) || 0 } : null;
}

export function resumeSession(session, from = true) {
    playSongFromList(session.song.id, 'all-songs');
    const a = audio();
    if (!from || !a || !(session.position > 0)) return;
    const seek = () => {
        window.clearTimeout(giveUp);
        a.currentTime = Number.isFinite(a.duration) ? Math.min(session.position, a.duration) : session.position;
    };
    const giveUp = window.setTimeout(() => a.removeEventListener('loadedmetadata', seek), 8000);
    a.addEventListener('loadedmetadata', seek, { once: true });
}
