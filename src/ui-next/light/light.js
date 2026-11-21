// The light window's page: plays the file(s) Xplayer was opened with, or a song sent from the full window.
// It has two views of one page: the Mini Player (the cover fills the window; controls come up over it when the pointer is on it) and the
// Quick Player (an app-style window with a queue and a control bar). Switching view does not reload anything, so the song keeps playing:
// the main process resizes the window and this page changes its layout (body[data-view], light.css).
// It is its own small page: no library, no shell, no engine (src/js). It shares the theme (tokens.css, appearance-boot.js), the icons, the
// logo, the volume curve and the saved volume with the full app, and talks to the main process through electronAPI (electron/preload.js,
// window group). The main process owns which window plays what (electron/open-router.js).

import { icon } from '../icons/icons.js';
import { logo } from '../startup/logo.js';
import { positionToGain, clampPosition, normalizeSavedVolume, DEFAULT_VOLUME_POSITION, VOLUME_KEY_STEP } from '../../js/playback/volume-curve.js';
import { PLAYER_NAMES, PLAYER_ICONS } from './names.js';
import { createSlider } from './slider.js';
import { nextIndex, previousIndex, nextRepeat, REPEAT_MODES } from './queue-logic.js';
import { mergeSnapshot, positionNow, toStandalone } from './remote.js';
import { attachTooltip } from '../components/tooltip.js';
import { openMenu } from '../components/menu.js';
import { createVolumePop } from '../components/volume-pop.js';
import { createQueueCard } from '../components/queue-card.js';
import { slidePanel } from '../shell/panel-motion.js';
import { isHttpLink, isHttpsLink, linkPreviewText, linkTitle, linkDialogHtml } from '../../js/core/link-check.js';
import { formatTime } from '../../js/core/format-time.js';

const api = window.electronAPI || {};
const $ = (id) => document.getElementById(id);

const VOLUME_KEY = 'volume'; // the full app's key (STORAGE_KEYS.VOLUME): { position, restore }
const QUEUE_KEY = 'xplayer.light.queue'; // 'open' | 'closed': whether the Quick Player shows its queue
const SEEK_STEP_SECONDS = 5;
const HISTORY_LIMIT = 200;
const PREFETCH_MS = 1500; // how long after a song starts the next listed one is read
const VIEWS = ['mini', 'quick'];
const DEFAULT_COVER = new URL('../../assets/default-cover.svg', import.meta.url).href;
// Lucide "copy" (ISC, like the icons of the app): the restore button of a maximized window
const RESTORE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

const audio = new Audio();
audio.preload = 'auto';

// The queue card: the same one the full app shows above its player bar (components/queue-card.js). It is opened above the queue button.
const queueCard = createQueueCard({ id: 'lp-queue', label: 'Queue', onClose: () => setQueueOpen(false) });
queueCard.closeButton.id = 'lp-queue-close';
document.body.append(queueCard.panel);
const queueBody = queueCard.body;

const state = {
    songs: [],
    index: -1,
    shuffle: false,
    repeat: 'off',
    played: new Set(), // the songs played in the current shuffle round
    history: [], // the songs played before this one, for Previous
    position: DEFAULT_VOLUME_POSITION,
    restore: DEFAULT_VOLUME_POSITION,
    pinned: false,
    maximized: false,
    synced: false, // the queue came from the full player (its own queue, shuffle and repeat), not from files opened here
    remaining: false, // the elapsed-time label shows the time left (a click on it switches)
    remote: false, // following the full app (it plays, this window shows and commands); false: this window plays by itself
    queueRev: 0, // which queue of the full app the list shown here is (a jump names it)
    view: VIEWS.includes(document.body.dataset.view) ? document.body.dataset.view : 'quick' // set before the first paint by light-boot.js
};

let seekBar = null;
let volumeBar = null;
let volumePop = null; // the Mini Player's vertical volume bar (components/volume-pop.js)
let started = false; // the first song (or the first answer that there is none) has come: until then no cover is shown, not even the default one
let snapshot = null; // following the full app: its newest state, and when it came
let snapshotAt = 0;
let shownKey = ''; // the song drawn now, so a state that did not change the song does not redraw it
let drawnRemote = false; // the first state of a follow is always drawn, even with no song: an idle full app gives the empty player with its default cover
let tickTimer = null;

// Where the song is, whether it plays and how long it is: from the audio here, or from what the full app said (moved on by the time since).
const isPlaying = () => (state.remote ? Boolean(snapshot && snapshot.playing) : !audio.paused && !audio.ended);
const nowTime = () => (state.remote ? positionNow(snapshot, snapshotAt, performance.now()) : audio.currentTime);
const totalTime = () => (state.remote ? (snapshot ? snapshot.duration : 0) : audio.duration);

// A command for the full app. If the full app is gone, this window goes on by itself.
function command(type, extra = {}) {
    if (typeof api.lightCommand !== 'function') return;
    Promise.resolve(api.lightCommand({ type, ...extra }))
        .then((answer) => {
            if (answer && answer.lost) leaveRemote();
        })
        .catch(() => {});
}

// The same address the full player uses for a local file (electron/media-protocol.js): it encodes the path and allows seeking.
const mediaUrl = (url) => `xplayer-media://media/${encodeURIComponent(url)}`;


// ---- volume ----------------------------------------------------------------------------------------------------------

function readSavedVolume() {
    try {
        const saved = normalizeSavedVolume(JSON.parse(localStorage.getItem(VOLUME_KEY) || 'null'));
        if (saved) return saved;
    } catch (e) {
        // A missing or damaged saved volume gives the default.
    }
    return { position: DEFAULT_VOLUME_POSITION, restore: DEFAULT_VOLUME_POSITION };
}

let saveTimer = null;
function saveVolumeSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(VOLUME_KEY, JSON.stringify({ position: state.position, restore: state.restore }));
        } catch (e) {
            // Storage that cannot be written only means the volume is not remembered.
        }
    }, 250);
}

let volumeSendTimer = null;

function setVolume(position, { save = true, fromFull = false } = {}) {
    state.position = clampPosition(position);
    if (state.position > 0) state.restore = state.position;
    if (!state.remote) audio.volume = positionToGain(state.position);
    else if (!fromFull) {
        // Following: the full app holds the volume. Sent a little after the last move, so a drag does not flood it.
        clearTimeout(volumeSendTimer);
        volumeSendTimer = setTimeout(() => command('volume', { value: state.position }), 30);
        save = false;
    }
    if (volumeBar) volumeBar.set(state.position);
    if (volumePop) volumePop.refresh();
    $('lp-mute').innerHTML = icon(state.position === 0 ? 'volume-x' : 'volume-2', { size: 18 });
    $('lp-mute').ariaLabel = state.position === 0 ? 'Unmute (M)' : 'Mute (M)';
    if (save) saveVolumeSoon();
}

function toggleMute() {
    if (state.remote) return command('mute');
    setVolume(state.position > 0 ? 0 : state.restore || DEFAULT_VOLUME_POSITION);
}

// ---- showing the song ------------------------------------------------------------------------------------------------

// The cover is the full-size picture (song.largeCover), like the big cover of the full app; the 160px thumbnail (song.cover) is the
// fallback when that file cannot be read, and the default cover when there is none. A thumbnail stretched over the whole window looked soft.
let coverToken = 0;

function renderCover(song) {
    const box = $('lp-cover');
    const backdrop = $('lp-backdrop');
    const token = ++coverToken;
    const candidates = song ? [song.largeCover, song.cover].filter((src, at, all) => src && all.indexOf(src) === at) : [];
    // Nothing to show: before the first song has come, nothing at all (a flash of the default cover before the real one was the bug); after it, the default.
    if (candidates.length === 0 && !started && !song) {
        box.replaceChildren();
        backdrop.hidden = true;
        return;
    }
    const picture = new Image();
    picture.alt = '';
    picture.decoding = 'async';
    let tried = 0;
    // The new picture takes the old one's place only when it has loaded, so the cover never blinks to the default (or to nothing) between two songs.
    const ready = () => {
        if (token !== coverToken) return;
        box.replaceChildren(picture);
    };
    picture.addEventListener('load', ready);
    picture.addEventListener('error', () => {
        if (token !== coverToken) return;
        tried += 1;
        if (tried < candidates.length) picture.src = candidates[tried];
        else if (picture.src !== DEFAULT_COVER) picture.src = DEFAULT_COVER;
    });
    picture.src = candidates.length > 0 ? candidates[0] : DEFAULT_COVER;
    // The Quick Player shows a soft, blurred copy of the cover behind everything (light.css); the small picture is enough for that.
    const soft = song && (song.cover || song.largeCover);
    if (soft) {
        backdrop.addEventListener('error', () => { backdrop.hidden = true; }, { once: true });
        backdrop.src = soft;
        backdrop.hidden = false;
    } else {
        backdrop.hidden = true;
    }
}

function absoluteUrl(path) {
    try {
        return new URL(path, document.baseURI).href;
    } catch (e) {
        return '';
    }
}

// The system's media controls (media keys, the volume flyout) show the song and can drive this window.
function updateMediaSession(song) {
    if (state.remote || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return; // following: the full app owns the system's media controls
    try {
        const src = song && (song.largeCover || song.cover);
        navigator.mediaSession.metadata = song
            ? new MediaMetadata({ title: song.title || '', artist: song.artist || '', album: song.album || '', artwork: src ? [{ src: absoluteUrl(src) }] : [] })
            : null;
    } catch (e) {
        // The system controls are a convenience.
    }
}

function renderSong(song) {
    document.body.classList.remove('lp-error');
    $('lp-title').textContent = song ? song.title || 'Unknown title' : 'Drop a music file here';
    // A song that is only listed (its tags are read when the player gets to it) has no artist yet: nothing is said rather than "Unknown artist".
    $('lp-sub').textContent = song ? [song.artist, song.album].filter(Boolean).join(' · ') || (song.bare ? '' : 'Unknown artist') : '';
    $('lp-count').textContent = song && state.songs.length > 1 ? `${state.index + 1} of ${state.songs.length}` : '';
    document.title = song ? [song.title, song.artist].filter(Boolean).join(' – ') + ' – Xplayer' : 'Xplayer';
    renderCover(song);
    updateMediaSession(song);
    syncQueue();
    renderButtons();
}

function canGoNext() {
    return nextIndex({ index: state.index, count: state.songs.length, shuffle: state.shuffle, repeat: state.repeat, played: state.played, manual: true }) !== -1;
}

function renderButtons() {
    const any = state.songs.length > 0;
    $('lp-prev').disabled = !any;
    $('lp-next').disabled = state.remote ? !any : !canGoNext(); // following: the full app decides what is next
    $('lp-shuffle').disabled = state.songs.length < 2;
    $('lp-repeat').disabled = !any;
    seekBar.setDisabled(!any);
}

function renderPlayState() {
    const playing = isPlaying();
    $('lp-play').innerHTML = icon(playing ? 'pause' : 'play', { size: 22, filled: true });
    $('lp-play').ariaLabel = playing ? 'Pause (Space)' : 'Play (Space)';
    $('lp-play').disabled = state.index < 0;
    document.body.toggleAttribute('data-playing', playing); // the bars of the queue's playing song move only while it plays
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

const REMAINING_KEY = 'xplayer.light.remaining';

function readRemaining() {
    try {
        return localStorage.getItem(REMAINING_KEY) === '1';
    } catch (e) {
        return false;
    }
}

// The label under the bar's left end: the time played, or (after a click on it, like the player bar of the full app) the time left, with a minus.
const timeText = (at, duration) => (state.remaining && duration > 0 ? `-${formatTime(Math.max(0, duration - at))}` : formatTime(at));

function renderTime() {
    const duration = Number.isFinite(totalTime()) ? totalTime() : 0;
    const at = nowTime();
    if (!seekBar.isDragging()) $('lp-cur').textContent = timeText(at, duration);
    $('lp-dur').textContent = formatTime(duration);
    seekBar.setDisabled(duration <= 0);
    seekBar.set(duration > 0 ? at / duration : 0);
}

function showProblem(message) {
    document.body.classList.add('lp-error');
    $('lp-sub').textContent = message;
}

// ---- the queue (Quick Player) ----------------------------------------------------------------------------------------

// One row of the queue: the full app's row (ui-next/shell's renderRightPanelItem): a picture, the title and artist, and the three dots.
// The playing mark (accent title, moving bars on the picture) is the Quick Player's own.
function buildRow(song, at, current) {
    const row = document.createElement('div');
    row.className = 'queue-item lp-q-item';
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.dataset.index = String(at);
    row.dataset.state = current ? 'current' : 'next';
    if (current) row.setAttribute('aria-current', 'true');
    const art = document.createElement('span');
    art.className = 'lp-q-art';
    const thumb = document.createElement('img');
    thumb.className = 'queue-item-cover';
    thumb.alt = '';
    thumb.loading = 'lazy';
    thumb.decoding = 'async';
    thumb.addEventListener('error', () => { thumb.src = DEFAULT_COVER; }, { once: true });
    thumb.src = song.cover || song.largeCover || DEFAULT_COVER;
    const bars = document.createElement('span');
    bars.className = 'lp-q-eq';
    bars.setAttribute('aria-hidden', 'true');
    bars.innerHTML = '<i></i><i></i><i></i>';
    art.append(thumb, bars);
    const info = document.createElement('div');
    info.className = 'queue-item-info';
    const title = document.createElement('div');
    title.className = 'queue-item-title';
    title.textContent = song.title || 'Unknown title';
    const artist = document.createElement('div');
    artist.className = 'queue-item-artist';
    artist.textContent = song.artist || (song.bare ? '' : 'Unknown artist');
    info.append(title, artist);
    const more = document.createElement('div');
    more.className = 'more-info';
    more.setAttribute('aria-label', `More options for ${song.title || 'Unknown title'}`); // (no native title: this window has the app's own tooltips)
    more.setAttribute('role', 'button');
    more.innerHTML = '<span class="material-symbols-outlined">more_horiz</span>';
    row.append(art, info, more);
    return row;
}

function queueLabel(text) {
    const label = document.createElement('div');
    label.className = 'queue-lables'; // (the engine's spelling: the shared card styles it)
    const span = document.createElement('span');
    span.textContent = text;
    label.append(span);
    return label;
}

function queueMessage(heading, small) {
    const empty = document.createElement('div');
    empty.className = 'empty-queue';
    const p = document.createElement('p');
    p.textContent = heading;
    const hint = document.createElement('small');
    hint.textContent = small;
    empty.append(p, hint);
    return empty;
}

// The queue as the full app lists it: "Now Playing" with the song that plays, then "Next Songs" (what comes after it; what was played is not listed).
// It is drawn only while the card is open (otherwise the next opening draws it), and only when what it shows changed: the full app sends its state
// several times a second while a song plays, and drawing the list again each time put it back to the top (it could not be scrolled) and restarted the
// moving bars on the playing row. A new song starts the list at the top (like the app's); a change of the list alone (a song whose tags were just read)
// keeps the place.
let queueDirty = true;
let drawnKey = '';
let drawnIndex = -2;
const queueKey = () => `${state.index}#${state.songs.map((song) => `${song.id ?? ''}|${song.url}|${song.title}|${song.artist}|${song.cover}|${song.bare ? 1 : 0}`).join('\n')}`;

function renderQueue({ keepScroll = false } = {}) {
    if (queueCard.panel.hidden) {
        queueDirty = true;
        return;
    }
    const key = queueKey();
    if (!queueDirty && key === drawnKey) return; // nothing changed since it was drawn: the rows and the scroll place stay as they are
    const scrolled = queueBody.scrollTop;
    const sameSong = drawnIndex === state.index;
    queueBody.replaceChildren();
    if (state.songs.length === 0) {
        queueBody.append(queueMessage('Queue is empty', 'Drop music files on the window, or use Open files'));
    } else {
        if (state.index >= 0 && state.songs[state.index]) {
            queueBody.append(queueLabel('Now Playing'), buildRow(state.songs[state.index], state.index, true));
        }
        const upcoming = [];
        for (let at = state.index + 1; at < state.songs.length; at += 1) upcoming.push(at);
        if (upcoming.length > 0) {
            queueBody.append(queueLabel('Next Songs'));
            for (const at of upcoming) queueBody.append(buildRow(state.songs[at], at, false));
        } else if (state.index >= 0) {
            queueBody.append(queueMessage('No more songs in queue', 'Add more songs to continue'));
        }
    }
    queueBody.scrollTop = keepScroll || sameSong ? scrolled : 0;
    drawnKey = key;
    drawnIndex = state.index;
    queueDirty = false;
}

// A song whose tags have just been read: the list is drawn again with them (the place in the list stays).
function redrawRow() {
    renderQueue({ keepScroll: true });
}

// The song that plays changed (or the list did): the queue is drawn again, from the top, like the full app's.
function syncQueue() {
    renderQueue();
}

// The card is a pop-up right above the control bar (components/queue-card.css reads --queue-card-bottom): the bar's height is passed on.
function placeQueue() {
    const bar = document.querySelector('.lp-bar');
    if (!bar) return;
    const top = bar.getBoundingClientRect().top;
    if (top > 0) document.documentElement.style.setProperty('--queue-card-bottom', `${Math.max(0, Math.round(window.innerHeight - top))}px`);
}

function setQueueOpen(open, { save = true } = {}) {
    const shown = open && state.view === 'quick';
    document.body.dataset.queue = open ? 'open' : 'closed';
    slidePanel(queueCard.panel, 'up', shown, (show) => { queueCard.panel.hidden = !show; }); // it rises in, like the full app's queue
    $('lp-queue-toggle').setAttribute('aria-pressed', String(open));
    if (shown) {
        placeQueue();
        if (queueDirty) renderQueue();
        const playing = queueBody.querySelector('.lp-q-item[aria-current]');
        if (playing) playing.scrollIntoView({ block: 'nearest' });
    }
    if (save) {
        try {
            localStorage.setItem(QUEUE_KEY, open ? 'open' : 'closed');
        } catch (e) {
            // The choice is only not remembered.
        }
    }
}

// The queue card opens only when the person opens it (like the full app's), and the choice is remembered.
function readQueuePreference() {
    try {
        return localStorage.getItem(QUEUE_KEY) === 'open';
    } catch (e) {
        return false;
    }
}

// ---- the two views ---------------------------------------------------------------------------------------------------

// Changes the layout. The window's size is the main process's job (electron/window-manager.js).
function showView(view) {
    if (!VIEWS.includes(view)) return;
    state.view = view;
    document.body.dataset.view = view;
    // The button offers the other view.
    const other = view === 'quick' ? 'mini' : 'quick';
    $('lp-view').innerHTML = icon(PLAYER_ICONS[other], { size: 16 });
    $('lp-view').ariaLabel = PLAYER_NAMES[other];
    $('lp-logo').ariaLabel = view === 'quick' ? 'Xplayer menu' : 'Open in Xplayer';
    queueCard.panel.hidden = !(view === 'quick' && document.body.dataset.queue === 'open'); // the Mini Player has no queue
    placeQueue();
    syncQueue();
}

async function switchView() {
    const other = state.view === 'quick' ? 'mini' : 'quick';
    if (typeof api.lightSetView !== 'function') return;
    try {
        const answer = await api.lightSetView(other);
        if (answer && answer.success) showView(other);
    } catch (e) {
        // The window stays as it is.
    }
}

function showMaximized(maximized) {
    state.maximized = maximized;
    $('lp-max').innerHTML = maximized ? RESTORE_ICON : icon('square', { size: 13 });
    $('lp-max').ariaLabel = maximized ? 'Restore' : 'Maximize';
}

// ---- playing ---------------------------------------------------------------------------------------------------------

// A song that was only listed (the other files of a folder; electron/open-router.js, bareEntry) has its tags and cover read when the player moves to it:
// one file, through the main process. Answers with the song as it is now in the list (read, or as listed if it cannot be read).
const reading = new Map(); // address -> the read in progress
function resolveBare(at) {
    const listed = state.songs[at];
    if (!listed || !listed.bare) return Promise.resolve(listed);
    if (typeof api.resolveListedFile !== 'function') {
        listed.bare = false;
        return Promise.resolve(listed);
    }
    if (reading.has(listed.url)) return reading.get(listed.url);
    const job = Promise.resolve()
        .then(() => api.resolveListedFile(listed.url))
        .then((answer) => (answer && answer.success && answer.song ? answer.song : null))
        .catch(() => null)
        .then((song) => {
            reading.delete(listed.url);
            const now = state.songs.findIndex((item) => item.url === listed.url); // the list may have been replaced meanwhile
            if (now < 0) return song || listed;
            if (song) state.songs[now] = song;
            else state.songs[now].bare = false; // it could not be read: it is played as it is, and says so if it cannot be played
            redrawRow();
            return state.songs[now];
        });
    reading.set(listed.url, job);
    return job;
}

// The next song is read a moment after a song starts, so Next (and the end of the song) does not wait for it. A shuffle has no known next song.
let prefetchTimer = null;
function prefetchNext() {
    clearTimeout(prefetchTimer);
    if (state.remote || state.shuffle) return;
    prefetchTimer = setTimeout(() => {
        const at = nextIndex({ index: state.index, count: state.songs.length, repeat: state.repeat, manual: false });
        if (at >= 0 && at !== state.index && state.songs[at] && state.songs[at].bare) resolveBare(at);
    }, PREFETCH_MS);
}

let loadToken = 0; // a song that was asked for while another was still being read replaces it

function start(song, { startAt, play }) {
    audio.src = mediaUrl(song.url);
    if (startAt > 0) audio.addEventListener('loadedmetadata', () => { audio.currentTime = startAt; }, { once: true });
    renderSong(song);
    renderTime();
    if (play) audio.play().catch(() => showProblem('This file could not be played'));
    renderPlayState();
    prefetchNext();
}

function load(index, { startAt = 0, play = true, remember = true } = {}) {
    const song = state.songs[index];
    if (!song) return;
    if (remember && state.index >= 0 && state.index !== index) {
        state.history.push(state.index);
        if (state.history.length > HISTORY_LIMIT) state.history.shift();
    }
    state.index = index;
    state.played.add(index);
    const token = ++loadToken;
    if (song.bare) {
        // Only listed so far: the song before stops at once, this one is shown from its file name and starts when its tags have been read (a moment).
        audio.pause();
        renderSong(song);
        renderTime();
        renderPlayState();
        resolveBare(index).then(() => {
            if (token !== loadToken) return;
            start(state.songs[state.index], { startAt, play });
        });
        return;
    }
    start(song, { startAt, play });
}

// What the main process sends: { songs, startIndex, startAt, paused, view?, pinned? } (electron/open-router.js).
function applyPayload(payload) {
    started = true; // the first answer has come: from here on, a missing cover shows the default one
    if (payload && VIEWS.includes(payload.view)) showView(payload.view);
    if (payload && payload.remote === true) {
        enterRemote();
        return;
    }
    if (state.remote) leaveRemote({ keep: false }); // files opened here: this window plays them by itself
    if (!payload || !Array.isArray(payload.songs) || payload.songs.length === 0) {
        if (payload && payload.success === false && !payload.canceled) showProblem(payload.error || 'This file could not be opened');
        if (state.index < 0 && state.songs.length === 0) renderSong(null); // nothing is playing: the empty window, with the default cover
        return;
    }
    if (typeof payload.pinned === 'boolean') setPinned(payload.pinned, { tell: false });
    loadToken += 1; // a song that was still being read for the list before is not started
    state.songs = payload.songs;
    state.index = -1;
    state.played = new Set();
    state.history = [];
    state.synced = payload.synced === true;
    // A queue handed over by the full player goes on with that player's shuffle and repeat.
    if (REPEAT_MODES.includes(payload.repeat)) setRepeat(payload.repeat);
    if (typeof payload.shuffle === 'boolean') setShuffle(payload.shuffle && payload.songs.length > 1);
    renderQueue();
    const index = Number.isInteger(payload.startIndex) && payload.startIndex >= 0 && payload.startIndex < payload.songs.length ? payload.startIndex : 0;
    load(index, { startAt: payload.startAt || 0, play: payload.paused !== true, remember: false });
}

// ---- following the full app -------------------------------------------------------------------------------------------

// What the full app says (see electron/player-sync.js): the song, where it is, the modes and the queue. Drawn here; nothing plays here.
function applySnapshot(next) {
    if (!next || !state.remote) return;
    snapshot = mergeSnapshot(snapshot, next);
    snapshotAt = performance.now();
    if (next.queue) {
        state.songs = snapshot.queue.songs;
        state.queueRev = snapshot.queue.rev;

    }
    const song = snapshot.song;
    if (song && !state.songs.length) state.songs = [song]; // a song that is not in the list it sent
    state.index = song && snapshot.index >= 0 && snapshot.index < state.songs.length ? snapshot.index : song ? 0 : -1;
    state.shuffle = snapshot.shuffle === true;
    state.repeat = snapshot.repeat;
    showModes();
    if (!volumeBar.isDragging()) setVolume(snapshot.volume, { save: false, fromFull: true });
    const key = song ? `${song.url}|${song.id ?? ''}` : '';
    const first = !drawnRemote;
    if (key !== shownKey || next.queue || first) {
        const songChanged = key !== shownKey || first;
        shownKey = key;
        drawnRemote = true;
        if (next.queue) renderQueue();
        if (songChanged) renderSong(song);
        else syncQueue();
    } else {
        syncQueue();
    }
    renderButtons();
    renderPlayState();
    renderTime();
}

// Follows the full app: asks for its state and then takes every change. This window's own audio stops.
async function enterRemote() {
    if (state.remote) return;
    loadToken += 1;
    clearTimeout(prefetchTimer);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    state.remote = true;
    state.songs = [];
    state.index = -1;
    snapshot = null;
    shownKey = '';
    drawnRemote = false;
    let answer = null;
    try {
        answer = await api.lightRemoteStart();
    } catch (e) {
        answer = null;
    }
    if (!answer || !answer.success) {
        state.remote = false;
        showProblem('The player is not open');
        return;
    }
    clearInterval(tickTimer);
    tickTimer = setInterval(() => {
        if (state.remote && isPlaying()) renderTime(); // the full app says where the song is a few times a second: the bar moves smoothly between
    }, 250);
    if (answer.snapshot) applySnapshot(answer.snapshot);
}

// Stops following. With `keep` (the full app is gone) the song goes on here from the same place; without it (files were opened here) it just stops.
function leaveRemote({ keep = true } = {}) {
    if (!state.remote) return;
    clearInterval(tickTimer);
    clearTimeout(volumeSendTimer);
    state.remote = false;
    if (typeof api.lightRemoteStop === 'function') api.lightRemoteStop();
    const own = keep ? toStandalone(snapshot) : null;
    snapshot = null;
    shownKey = '';
    drawnRemote = false;
    if (own) applyPayload(own);
    else {
        state.songs = [];
        state.index = -1;
        renderSong(null);
        renderQueue();
    }
}

function togglePlay() {
    if (state.index < 0) return;
    if (state.remote) return command('toggle');
    if (audio.paused || audio.ended) audio.play().catch(() => showProblem('This file could not be played'));
    else audio.pause();
}

function previous() {
    if (state.index < 0) return;
    if (state.remote) return command('previous');
    // Like most players: within the first seconds go back a song, later start this one again.
    const back = audio.currentTime > 3 ? -1 : previousIndex({ index: state.index, count: state.songs.length, repeat: state.repeat, history: state.history });
    if (back === -1) {
        audio.currentTime = 0;
        return;
    }
    const fromHistory = state.history.length > 0;
    if (fromHistory) state.history.pop();
    load(back, { remember: false });
}

// `manual` is true for the Next button, false when the song ended by itself.
function next({ manual = true } = {}) {
    if (state.remote) return command('next');
    const at = nextIndex({ index: state.index, count: state.songs.length, shuffle: state.shuffle, repeat: state.repeat, played: state.played, manual });
    if (at === -1) {
        renderPlayState();
        return;
    }
    if (state.shuffle && state.played.size >= state.songs.length) state.played = new Set(); // a new round
    if (at === state.index) {
        audio.currentTime = 0; // repeat one
        audio.play().catch(() => showProblem('This file could not be played'));
        return;
    }
    load(at);
}

function seekTo(seconds) {
    if (!state.remote) {
        audio.currentTime = seconds;
        return;
    }
    snapshot = { ...snapshot, position: seconds }; // shown at once; the full app confirms
    snapshotAt = performance.now();
    renderTime();
    command('seek', { value: seconds });
}

function seekBy(seconds) {
    const duration = totalTime();
    if (!Number.isFinite(duration) || duration <= 0) return;
    seekTo(Math.max(0, Math.min(duration, nowTime() + seconds)));
}

// The shuffle and repeat buttons as the state says (no side effect: also used when the full app says what they are).
function showModes() {
    $('lp-shuffle').setAttribute('aria-pressed', String(state.shuffle));
    $('lp-shuffle').ariaLabel = state.shuffle ? 'Shuffle: on (S)' : 'Shuffle: off (S)';
    const button = $('lp-repeat');
    button.dataset.mode = state.repeat;
    button.setAttribute('aria-pressed', String(state.repeat !== 'off'));
    button.ariaLabel = `Repeat: ${state.repeat} (R)`;
}

function setShuffle(on) {
    state.shuffle = on;
    state.played = new Set(state.index >= 0 ? [state.index] : []);
    showModes();
    renderButtons();
}

function toggleShuffle() {
    if (state.songs.length < 2) return;
    if (state.remote) return command('shuffle');
    setShuffle(!state.shuffle);
}

function setRepeat(mode) {
    state.repeat = mode;
    showModes();
    renderButtons();
}

function cycleRepeat() {
    if (state.remote) return command('repeat');
    setRepeat(nextRepeat(state.repeat));
}

audio.addEventListener('timeupdate', renderTime);
audio.addEventListener('durationchange', renderTime);
audio.addEventListener('loadedmetadata', renderTime);
audio.addEventListener('play', renderPlayState);
audio.addEventListener('pause', renderPlayState);
audio.addEventListener('ended', () => next({ manual: false }));
audio.addEventListener('error', () => showProblem('This file could not be played'));

// ---- window buttons --------------------------------------------------------------------------------------------------

function setPinned(pinned, { tell = true } = {}) {
    state.pinned = pinned;
    $('lp-pin').setAttribute('aria-pressed', String(pinned));
    if (tell && typeof api.lightSetPinned === 'function') api.lightSetPinned(pinned);
}

// The X at the top left: back to Xplayer, with this song from the same place.
async function openInFull() {
    if (typeof api.lightOpenInFull !== 'function') return;
    if (state.remote) {
        // The full app never stopped playing: it only comes forward, and this window closes.
        try {
            const answer = await api.lightOpenInFull({ remote: true });
            if (answer && answer.success) return;
        } catch (e) {
            // Shown below.
        }
        showProblem('Could not open the full app');
        return;
    }
    // This window plays by itself: the full app only starts (or comes forward). Nothing is handed over and this window goes on.
    try {
        const answer = await api.lightOpenInFull({ launch: true });
        if (answer && answer.success) return;
    } catch (e) {
        // Shown below.
    }
    showProblem('Could not open the full app');
}

function closeWindow() {
    if (typeof api.lightClose === 'function') api.lightClose();
    else window.close();
}

async function windowAction(action) {
    if (typeof api.lightWindowAction !== 'function') return;
    try {
        const answer = await api.lightWindowAction(action);
        if (answer && answer.success) showMaximized(answer.maximized);
    } catch (e) {
        // The window stays as it is.
    }
}

async function openFiles() {
    if (typeof api.lightOpenFiles !== 'function') return;
    try {
        applyOpened(await api.lightOpenFiles());
    } catch (e) {
        showProblem('These files could not be opened');
    }
}

async function openFolder() {
    if (typeof api.lightOpenFolder !== 'function') return;
    try {
        applyOpened(await api.lightOpenFolder());
    } catch (e) {
        showProblem('This folder could not be opened');
    }
}

// What the main process answers to files chosen or dropped here. A closed dialog changes nothing (what plays goes on playing). With the full app
// running it plays the files itself (a new queue) and this window follows it: `routed`, nothing to do here.
function applyOpened(answer) {
    if (answer && (answer.canceled || answer.routed)) return;
    applyPayload(answer);
}

// Something of the full app's own menu: the full app opens (or comes forward) and does it.
function appAction(name) {
    if (typeof api.lightAppAction === 'function') api.lightAppAction(name);
}

// ---- Play from URL ---------------------------------------------------------------------------------------------------
// The link is checked and described with the same code as the full app's dialog (js/core/link-check.js). Following the full app, the full app plays
// the link (it is a command, like Next) and this window follows; on its own, this window streams it through the media protocol, which relays https
// links (electron/media-protocol.js): the page's security policy is not opened up for the web.

function playLink(link) {
    const host = new URL(link).hostname;
    applyPayload({ songs: [{ id: -1, url: link, title: linkTitle(link), artist: host, album: '', cover: '', largeCover: '', duration: '', external: true, stream: true }], startIndex: 0, startAt: 0, paused: false });
}

function openUrlDialog() {
    if (document.querySelector('.playlist-modal-overlay')) return;
    // The full app's dialog: the same markup (js/core/link-check.js, linkDialogHtml) and the same styles (views/tools/dialogs.css). The Quick Player has no
    // library to download into, so it has Cancel and Stream Only.
    const overlay = document.createElement('div');
    overlay.className = 'playlist-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'playlist-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Play from URL');
    modal.innerHTML = linkDialogHtml(`
                <button type="button" id="lp-url-cancel" class="playlist-modal-cancel-btn">Cancel</button>
                <button type="button" id="lp-url-play" class="playlist-modal-create-btn">Stream Only</button>`);
    overlay.append(modal);
    document.body.append(overlay);
    const input = modal.querySelector('#link-url-input');
    const note = modal.querySelector('#link-preview');

    let sequence = 0;
    let timer = null;
    const close = () => {
        clearTimeout(timer);
        sequence += 1;
        overlay.remove();
    };
    const say = (text, problem = false) => {
        note.textContent = text;
        note.dataset.problem = problem ? 'true' : 'false';
    };

    // A light HEAD request once the person stops typing, only for a real link; an answer for an older value is dropped.
    input.addEventListener('input', () => {
        clearTimeout(timer);
        const mine = ++sequence;
        say('');
        const value = input.value.trim();
        if (!isHttpLink(value) || typeof api.probeUrl !== 'function') return;
        timer = setTimeout(() => {
            Promise.resolve(api.probeUrl(value))
                .then((info) => { if (mine === sequence) say(linkPreviewText(info)); })
                .catch(() => {});
        }, 500);
    });

    function play() {
        const link = input.value.trim();
        if (!link) return say('Please enter a URL', true);
        if (!isHttpLink(link)) return say('This is not a web link. It must start with https://', true);
        if (state.remote) {
            // The full app plays it and this window follows it, as for a file from Explorer.
            if (typeof api.lightCommand !== 'function') return say('The full app is not reachable', true);
            Promise.resolve(api.lightCommand({ type: 'play-url', url: link })).catch(() => {});
            return close();
        }
        if (!isHttpsLink(link)) return say('The Quick Player plays https links. Open the full app for http links.', true);
        close();
        playLink(link);
    }

    modal.querySelector('#lp-url-cancel').addEventListener('click', close);
    modal.querySelector('#lp-url-play').addEventListener('click', play);
    overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(); });
    // Enter plays, Escape closes; neither reaches the window's shortcuts (Escape would close a Mini Player, a letter would be a command).
    modal.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
            event.preventDefault();
            play();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    });
    input.focus();

    // The clipboard is read once, and used only when it holds a link and the box is still empty.
    if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then((text) => {
            const link = typeof text === 'string' ? text.trim() : '';
            if (input.isConnected && !input.value && isHttpLink(link)) {
                input.value = link;
                input.select();
                input.dispatchEvent(new Event('input'));
            }
        }).catch(() => {});
    }
}

// ---- menus ---------------------------------------------------------------------------------------------------------

// The path of the file of a song, for the file manager (a stream has none).
function songPath(song) {
    if (!song || typeof song.url !== 'string' || !song.url.startsWith('file:')) return '';
    try {
        const path = decodeURIComponent(new URL(song.url).pathname);
        return /^\/[A-Za-z]:/.test(path) ? path.slice(1).replace(/\//g, '\\') : path;
    } catch (e) {
        return '';
    }
}

const currentSong = () => (state.index >= 0 ? state.songs[state.index] : null);

// The right-click menu of the Quick Player (a window like any other player). The Mini Player has none: it is small, everything it does is on it, and
// the right-click of a small floating player is better left to the window under it (Spotify's mini player has none either).
function contextItems() {
    const has = state.index >= 0;
    const song = currentSong();
    const path = songPath(song);
    return [
        { label: isPlaying() ? 'Pause' : 'Play', icon: isPlaying() ? 'pause' : 'play', shortcut: 'Space', disabled: !has, onSelect: togglePlay },
        { label: 'Next', icon: 'skip-forward', shortcut: 'N', disabled: !has, onSelect: () => next({ manual: true }) },
        { label: 'Previous', icon: 'skip-back', shortcut: 'P', disabled: !has, onSelect: previous },
        { type: 'separator' },
        { label: 'Shuffle', icon: 'shuffle', shortcut: 'S', checked: state.shuffle, disabled: state.songs.length < 2, onSelect: toggleShuffle },
        { label: `Repeat: ${state.repeat}`, icon: 'repeat', shortcut: 'R', onSelect: cycleRepeat },
        { type: 'separator' },
        { label: 'Queue', icon: 'list-music', shortcut: 'Q', checked: document.body.dataset.queue === 'open', onSelect: () => setQueueOpen(document.body.dataset.queue !== 'open') },
        { label: 'Show in folder', icon: 'folder', disabled: !path || typeof api.showFileInExplorer !== 'function', onSelect: () => api.showFileInExplorer(path) },
        { label: 'Copy song info', icon: 'text-align-start', disabled: !song, onSelect: () => navigator.clipboard && navigator.clipboard.writeText([song.artist, song.title].filter(Boolean).join(' - ')).catch(() => {}) },
        { label: 'Open files...', icon: 'plus', onSelect: openFiles },
        { label: 'Open folder...', icon: 'folder', onSelect: openFolder },
        { type: 'separator' },
        { label: 'Open in Xplayer', icon: 'app-window', onSelect: openInFull },
        { label: 'Keep on top', icon: 'pin', checked: state.pinned, onSelect: () => setPinned(!state.pinned) },
        { label: 'Mini Player', icon: PLAYER_ICONS.mini, onSelect: switchView },
        { type: 'separator' },
        { label: 'Close', icon: 'x', onSelect: closeWindow }
    ];
}

let lastMenuAt = -1e9;

// Plays a song of the queue: following the full app it is asked to, on its own this window plays it.
function playQueueRow(at) {
    if (state.remote) command('jump', { index: at, rev: state.queueRev });
    else load(at);
}

// The menu of a queue row (the three dots, or a right-click on the row).
function openRowMenu(at, point) {
    const song = state.songs[at];
    if (!song) return;
    const path = songPath(song);
    lastMenuAt = performance.now(); // the window's own menu must not open as well
    openMenu({
        items: [
            { label: 'Play', icon: 'play', onSelect: () => playQueueRow(at) },
            { label: 'Show in folder', icon: 'folder', disabled: !path || typeof api.showFileInExplorer !== 'function', onSelect: () => api.showFileInExplorer(path) },
            { label: 'Copy song info', icon: 'text-align-start', onSelect: () => navigator.clipboard && navigator.clipboard.writeText([song.artist, song.title].filter(Boolean).join(' - ')).catch(() => {}) }
        ],
        point
    });
}

function openContextMenu(point) {
    if (state.view !== 'quick' || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    // A right-click on a drag area can arrive twice (from the page and from the main process): one menu.
    if (performance.now() - lastMenuAt < 500) return;
    lastMenuAt = performance.now();
    openMenu({ items: contextItems(), point });
}

// The Mini Player is dragged by the page (electron/window-manager.js, dragLightWindow): a press on anything that is not a control moves the window
// with the pointer. A drag area of the window would hide the pointer from the page (hovers and tooltips that never end, a second menu).
function mountMiniDrag() {
    if (typeof api.lightDrag !== 'function') return;
    let from = null;
    const interactive = 'button, a, input, .lp-slider, .volume-pop, .menu, .tooltip';
    document.addEventListener('pointerdown', (event) => {
        if (state.view !== 'mini' || event.button !== 0 || event.target.closest(interactive)) return;
        from = { id: event.pointerId, x: event.screenX, y: event.screenY };
        document.body.setPointerCapture(event.pointerId);
        api.lightDrag('start', 0, 0);
    });
    document.addEventListener('pointermove', (event) => {
        if (from && event.pointerId === from.id) api.lightDrag('move', event.screenX - from.x, event.screenY - from.y);
    });
    const end = (event) => {
        if (!from || event.pointerId !== from.id) return;
        from = null;
        api.lightDrag('end', 0, 0);
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
}

// The X of the Quick Player opens a menu: its own things first, then the full app's application menu entries that make sense from here (they open the
// full app and run there), then the window's. (The Mini Player's X goes straight back to the full app.)
function openLogoMenu() {
    openMenu({
        anchor: $('lp-logo'),
        items: [
            { label: 'Open in Xplayer', icon: 'app-window', onSelect: openInFull },
            { type: 'separator' },
            { label: 'Open files...', icon: 'plus', onSelect: openFiles },
            { label: 'Open folder...', icon: 'folder', onSelect: openFolder },
            { label: 'Play from URL...', icon: 'link', onSelect: () => openUrlDialog() },
            { type: 'separator' },
            {
                label: 'Xplayer',
                icon: 'app-window',
                items: [
                    { label: 'Home', onSelect: () => appAction('home') },
                    { label: 'Library', onSelect: () => appAction('library') },
                    { label: 'Search', onSelect: () => appAction('search') },
                    { label: 'Recently played', onSelect: () => appAction('recent') },
                    { type: 'separator' },
                    { label: 'Lyrics', onSelect: () => appAction('lyrics') },
                    { label: 'Metadata', onSelect: () => appAction('metadata') },
                    { type: 'separator' },
                    { label: 'Settings', onSelect: () => appAction('settings') },
                    { label: 'Keyboard shortcuts', onSelect: () => appAction('shortcuts') }
                ]
            },
            { type: 'separator' },
            { label: 'Keep on top', icon: 'pin', checked: state.pinned, onSelect: () => setPinned(!state.pinned) },
            { label: 'Mini Player', icon: PLAYER_ICONS.mini, onSelect: switchView },
            { type: 'separator' },
            { label: 'Close', icon: 'x', onSelect: closeWindow }
        ]
    });
}

function toggleRemaining() {
    state.remaining = !state.remaining;
    try {
        localStorage.setItem(REMAINING_KEY, state.remaining ? '1' : '0');
    } catch (e) {
        // It is just not remembered.
    }
    renderTime();
}

// Whether the pointer is over the window: the Mini Player shows its controls then (light.css). The main process reports it too, because a
// frameless window's drag areas give the page no mouse events.
function setActive(active) {
    document.body.toggleAttribute('data-active', active);
}

// ---- wiring ----------------------------------------------------------------------------------------------------------

function init() {
    $('lp-logo').innerHTML = logo('x', { size: 20 });
    $('lp-pin').innerHTML = icon('pin', { size: 16 });
    $('lp-min').innerHTML = icon('minus', { size: 16 });
    $('lp-close').innerHTML = icon('x', { size: 16 });
    $('lp-prev').innerHTML = icon('skip-back', { size: 18, filled: true });
    $('lp-next').innerHTML = icon('skip-forward', { size: 18, filled: true });
    $('lp-shuffle').innerHTML = icon('shuffle', { size: 18 });
    $('lp-repeat').innerHTML = icon('repeat', { size: 18 });
    $('lp-queue-toggle').innerHTML = icon('list-music', { size: 18 });
    showMaximized(false);
    state.remaining = readRemaining();
    showView(state.view);

    seekBar = createSlider($('lp-seek-bar'), {
        label: 'Position',
        keyStep: () => (Number.isFinite(totalTime()) && totalTime() > 0 ? SEEK_STEP_SECONDS / totalTime() : 0.02),
        valueText: () => `${formatTime(nowTime())} of ${formatTime(totalTime())}`,
        preview: (fraction) => formatTime(fraction * (Number.isFinite(totalTime()) ? totalTime() : 0)),
        onInput: (fraction) => {
            if (Number.isFinite(totalTime())) $('lp-cur').textContent = timeText(fraction * totalTime(), totalTime());
        },
        onChange: (fraction) => {
            if (Number.isFinite(totalTime())) seekTo(fraction * totalTime());
        }
    });
    volumeBar = createSlider($('lp-volume-bar'), {
        label: 'Volume',
        keyStep: VOLUME_KEY_STEP,
        valueText: (fraction) => `${Math.round(fraction * 100)}%`,
        onInput: (fraction) => setVolume(fraction)
    });
    seekBar.setDisabled(true);
    // The Mini Player's volume: the pop-up the full app shows in a narrow window, above the icon (the Quick Player has the inline bar)
    volumePop = createVolumePop({ icon: $('lp-mute'), position: () => state.position, setPosition: (position) => setVolume(position), enabled: () => state.view === 'mini' });

    // The tooltips are the app's own (components/tooltip.js): a name, a dim state, and the key. Toggles keep theirs open on a press, to show the new state.
    const on = (flag) => (flag ? 'On' : 'Off');
    attachTooltip($('lp-logo'), () => ({ name: state.view === 'quick' ? 'Xplayer menu' : 'Open in Xplayer' }));
    attachTooltip($('lp-pin'), () => ({ name: 'Keep on top', state: on(state.pinned) }), { stayOnPress: true });
    attachTooltip($('lp-view'), () => ({ name: PLAYER_NAMES[state.view === 'quick' ? 'mini' : 'quick'] }));
    attachTooltip($('lp-min'), () => ({ name: 'Minimize' }));
    attachTooltip($('lp-max'), () => ({ name: state.maximized ? 'Restore' : 'Maximize' }), { stayOnPress: true });
    attachTooltip($('lp-close'), () => ({ name: 'Close' }));
    attachTooltip($('lp-queue-toggle'), () => ({ name: 'Queue', state: on(document.body.dataset.queue === 'open'), shortcut: 'Q' }), { stayOnPress: true });
    attachTooltip($('lp-prev'), () => ({ name: 'Previous', shortcut: 'P' }));
    attachTooltip($('lp-play'), () => ({ name: isPlaying() ? 'Pause' : 'Play', shortcut: 'Space' }), { stayOnPress: true });
    attachTooltip($('lp-next'), () => ({ name: 'Next', shortcut: 'N' }));
    attachTooltip($('lp-shuffle'), () => ({ name: 'Shuffle', state: on(state.shuffle), shortcut: 'S' }), { stayOnPress: true });
    attachTooltip($('lp-repeat'), () => ({ name: 'Repeat', state: { off: 'Off', all: 'All', one: 'One' }[state.repeat], shortcut: 'R' }), { stayOnPress: true });
    attachTooltip($('lp-mute'), () => (state.view === 'mini' ? null : { name: state.position === 0 ? 'Unmute' : 'Mute', shortcut: 'M' })); // the Mini Player's pop-up opens there and says the level
    attachTooltip($('lp-cur'), () => ({ name: state.remaining ? 'Time left' : 'Time played', description: 'Click to switch' }), { stayOnPress: true });

    $('lp-logo').addEventListener('click', () => (state.view === 'quick' ? openLogoMenu() : openInFull()));
    $('lp-cur').addEventListener('click', toggleRemaining);
    mountMiniDrag();
    document.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        openContextMenu({ x: event.clientX, y: event.clientY });
    });
    if (typeof api.onLightContextMenu === 'function') api.onLightContextMenu(openContextMenu);
    $('lp-pin').addEventListener('click', () => setPinned(!state.pinned));
    $('lp-view').addEventListener('click', switchView);
    $('lp-min').addEventListener('click', () => windowAction('minimize'));
    $('lp-max').addEventListener('click', () => windowAction('toggle-maximize'));
    $('lp-close').addEventListener('click', closeWindow);
    $('lp-prev').addEventListener('click', previous);
    $('lp-next').addEventListener('click', () => next({ manual: true }));
    $('lp-play').addEventListener('click', togglePlay);
    $('lp-shuffle').addEventListener('click', toggleShuffle);
    $('lp-repeat').addEventListener('click', cycleRepeat);
    $('lp-queue-toggle').addEventListener('click', () => setQueueOpen(document.body.dataset.queue !== 'open'));
    $('lp-mute').addEventListener('click', toggleMute);
    // A press on a row plays it, as in the full app (playFromQueue); the three dots (and a right-click) open the row's menu instead.
    queueBody.addEventListener('click', (event) => {
        const row = event.target.closest('.lp-q-item');
        if (!row) return;
        if (event.target.closest('.more-info')) {
            const box = event.target.closest('.more-info').getBoundingClientRect();
            openRowMenu(Number(row.dataset.index), { x: box.right, y: box.bottom });
            return;
        }
        playQueueRow(Number(row.dataset.index));
    });
    queueBody.addEventListener('contextmenu', (event) => {
        const row = event.target.closest('.lp-q-item');
        if (!row) return;
        event.preventDefault();
        event.stopPropagation();
        openRowMenu(Number(row.dataset.index), { x: event.clientX, y: event.clientY });
    });
    queueBody.addEventListener('keydown', (event) => {
        const row = event.target instanceof Element ? event.target.closest('.lp-q-item') : null;
        if (!row || event.target.closest('.more-info') || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        event.stopPropagation(); // a space on a row plays that row, it does not pause the song
        playQueueRow(Number(row.dataset.index));
    });

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const onButton = event.target instanceof HTMLButtonElement; // Space on a button presses it
        const onSlider = event.target instanceof Element && event.target.closest('.lp-slider'); // a bar has its own arrow keys
        switch (event.key) {
            case ' ':
                if (onButton) return;
                event.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
                if (onSlider) return;
                event.preventDefault();
                seekBy(event.key === 'ArrowLeft' ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
                break;
            case 'ArrowUp':
            case 'ArrowDown':
                if (onSlider) return;
                event.preventDefault();
                setVolume(state.position + (event.key === 'ArrowUp' ? VOLUME_KEY_STEP : -VOLUME_KEY_STEP));
                break;
            case 'm':
            case 'M':
                toggleMute();
                break;
            case 'n':
            case 'N':
                next({ manual: true });
                break;
            case 'p':
            case 'P':
                previous();
                break;
            case 's':
            case 'S':
                toggleShuffle();
                break;
            case 'r':
            case 'R':
                cycleRepeat();
                break;
            case 'q':
            case 'Q':
                if (state.view === 'quick') setQueueOpen(document.body.dataset.queue !== 'open');
                break;
            case 'Escape':
                if (state.view === 'mini') closeWindow();
                else if (!queueCard.panel.hidden && !document.querySelector('.menu')) {
                    setQueueOpen(false); // like the full app's queue: Escape closes it and gives the focus back to its button
                    $('lp-queue-toggle').focus();
                }
                break;
            default:
        }
    });

    // A press outside the queue card closes it, as in the full app (a press in a menu does not: that menu may have been opened from a row).
    document.addEventListener('pointerdown', (event) => {
        if (queueCard.panel.hidden || queueCard.panel.contains(event.target) || $('lp-queue-toggle').contains(event.target)) return;
        if (event.target instanceof Element && event.target.closest('.menu, .tooltip, [role="menu"]')) return;
        setQueueOpen(false);
    });
    // The card sits right above the control bar, whatever size the window and the bar have.
    window.addEventListener('resize', placeQueue);
    if (typeof ResizeObserver === 'function') new ResizeObserver(placeQueue).observe(document.querySelector('.lp-bar'));

    // A music file dropped on the window replaces what is playing.
    document.addEventListener('dragover', (event) => event.preventDefault());
    document.addEventListener('drop', async (event) => {
        event.preventDefault();
        if (typeof api.lightScan !== 'function') return;
        const paths = Array.from((event.dataTransfer && event.dataTransfer.files) || [])
            .map((file) => (typeof api.getPathForFile === 'function' ? api.getPathForFile(file) : file.path))
            .filter(Boolean);
        if (paths.length === 0) return;
        try {
            applyOpened(await api.lightScan(paths));
        } catch (e) {
            showProblem('This file could not be opened');
        }
    });

    // The pointer over the window (see setActive)
    document.addEventListener('pointermove', () => setActive(true), { passive: true });
    if (typeof api.onLightHover === 'function') api.onLightHover(setActive); // the main process says when the pointer is away
    // Without that bridge the page's own pointerleave is all there is. With it, pointerleave is not trusted: moving from a button onto the
    // cover (a drag area, which takes the pointer from the page) fires it while the pointer is still over the window, and the controls went away.
    else document.documentElement.addEventListener('pointerleave', () => setActive(false));
    if (typeof api.onLightState === 'function') api.onLightState((window_) => window_ && showMaximized(Boolean(window_.maximized)));

    if ('mediaSession' in navigator) {
        const handlers = {
            play: () => { if (!isPlaying()) togglePlay(); },
            pause: () => { if (isPlaying()) togglePlay(); },
            previoustrack: previous,
            nexttrack: () => next({ manual: true }),
            seekto: (details) => { if (details && Number.isFinite(details.seekTime)) seekTo(details.seekTime); },
            seekbackward: () => seekBy(-SEEK_STEP_SECONDS),
            seekforward: () => seekBy(SEEK_STEP_SECONDS)
        };
        for (const [action, handler] of Object.entries(handlers)) {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (e) {
                // An action this browser does not know is left out.
            }
        }
    }

    const saved = readSavedVolume();
    state.restore = saved.restore;
    setVolume(saved.position, { save: false });
    setQueueOpen(readQueuePreference(), { save: false });
    renderSong(null);
    renderQueue();
    renderPlayState();
    renderTime();

    if (typeof api.onLightRemote === 'function') api.onLightRemote(applySnapshot);
    if (typeof api.onLightRemoteLost === 'function') api.onLightRemoteLost(() => leaveRemote());
    window.addEventListener('pagehide', () => {
        if (state.remote && typeof api.lightRemoteStop === 'function') api.lightRemoteStop();
    });
    if (typeof api.onLightOpen === 'function') api.onLightOpen(applyPayload);
    if (typeof api.lightTake === 'function') api.lightTake().then(applyPayload).catch(() => showProblem('This file could not be opened'));
}

init();
