// ==============================================================================
// LIVE SYNC WITH THE LIGHT WINDOW (the Mini Player and the Quick Player)
// ==============================================================================
// When the light window was opened from this app it only shows what this app plays and sends commands back: nothing is handed over, nothing
// pauses, and a change on either side shows on both. The main process relays and checks (electron/player-sync.js); the light window's side is
// src/ui-next/light/remote.js. This file publishes while the light window follows (the main process says so with `wanted`) and runs the commands.

const QUEUE_BEFORE = 100; // songs of the queue sent before the one that plays
const QUEUE_LIMIT = 300; // and at most this many in all, the same as a handoff (electron/light-handoff.js)
const SAFETY_CHECK_MS = 1000; // repeat and the queue have no event of their own in every case: looked at again at this interval while following

let syncWanted = false;
let queueRev = 0;
let queueKey = '';
let queueOffset = 0; // where the list the light window holds starts in the whole queue
let lastModes = '';
let flushPending = false;
let safetyTimer = null;

const shown = (song) => ({ id: song.id, url: song.url, title: song.title, artist: song.artist, album: song.album, cover: song.cover, largeCover: song.largeCover, duration: song.duration });
const songOf = (item) => (item ? item.song || item : null);
const repeatName = () => ['off', 'all', 'one'][repeatMode] || 'off';

// The part of the queue around the song that plays, and where it starts.
function queueWindow() {
    const start = Math.max(0, Math.min(currentQueueIndex - QUEUE_BEFORE, playbackQueue.length - QUEUE_LIMIT));
    return { start, songs: playbackQueue.slice(start, start + QUEUE_LIMIT).map(songOf).filter(Boolean) };
}

// The queue the player plays from, as the light window takes it when it cannot follow live (at most 300 songs, 100 of them before this one).
function queueForLightPlayer() {
    const { start, songs } = queueWindow();
    return { songs, index: currentQueueIndex - start, repeat: repeatName(), shuffle: isShuffled === true, synced: true };
}

function buildSnapshot(withQueue) {
    const { start, songs } = queueWindow();
    const song = currentQueueIndex >= 0 ? songOf(playbackQueue[currentQueueIndex]) : null;
    const snapshot = {
        song: song ? shown(song) : null,
        index: currentQueueIndex - start,
        position: audioElement.currentTime || 0,
        duration: Number.isFinite(audioElement.duration) ? audioElement.duration : 0,
        playing: !audioElement.paused && !audioElement.ended,
        volume: getVolumePosition(),
        repeat: repeatName(),
        shuffle: isShuffled === true
    };
    if (withQueue) {
        queueOffset = start;
        snapshot.queue = { songs: songs.map(shown), offset: start, total: playbackQueue.length, rev: queueRev };
    }
    return snapshot;
}

function publishNow(forceQueue = false) {
    flushPending = false;
    if (!syncWanted) return;
    const { start, songs } = queueWindow();
    const key = `${playbackQueue.length}:${start}:${songs.map((song) => song.id ?? song.url).join(',')}`;
    const queueChanged = forceQueue || key !== queueKey;
    if (queueChanged) {
        queueKey = key;
        queueRev += 1;
    }
    lastModes = `${repeatMode}:${isShuffled}`;
    desktopApi.window.lightPublish(buildSnapshot(queueChanged));
}

// Many events fire together (play, timeupdate, index): one publish for all of them.
function publishSoon() {
    if (!syncWanted || flushPending) return;
    flushPending = true;
    setTimeout(publishNow, 0);
}

function setWanted(wanted) {
    syncWanted = wanted;
    clearInterval(safetyTimer);
    if (!wanted) return;
    publishNow(true); // the light window needs the whole state, queue included
    safetyTimer = setInterval(() => {
        if (`${repeatMode}:${isShuffled}` !== lastModes) publishNow();
        else publishSoon();
    }, SAFETY_CHECK_MS);
}

const click = (id) => {
    const button = document.getElementById(id);
    if (button) button.click();
};

const COMMANDS = {
    toggle: () => click('play-btn'),
    play: () => {
        if (audioElement.paused) click('play-btn');
    },
    pause: () => {
        if (!audioElement.paused) click('play-btn');
    },
    next: () => click('next-btn'),
    previous: () => click('prev-btn'),
    seek: (command) => {
        audioElement.currentTime = command.value;
    },
    volume: (command) => updateVolume(command.value),
    mute: () => toggleMute(),
    // The shuffle button opens a menu of modes in this app; the light window only knows on and off, so it is set as the menu would.
    shuffle: () => selectShuffleMode(isShuffled ? 'off' : 'normal'),
    repeat: () => click('repeat-btn'),
    'play-url': (command) => playLinkFromLightWindow(command.url),
    jump: (command) => {
        if (command.rev !== queueRev) return; // the queue changed since the light window drew it
        const at = queueOffset + command.index;
        if (at >= 0 && at < playbackQueue.length) playSongFromQueue(at);
    }
};

function runCommand(command) {
    const run = command && COMMANDS[command.type];
    if (run) run(command);
    publishSoon(); // what it changed shows in the light window at once
}

if (typeof desktopApi !== 'undefined' && desktopApi.supports('window.onPlayerSyncWanted')) {
    desktopApi.window.onPlayerSyncWanted(setWanted);
    desktopApi.window.onPlayerSyncCommand(runCommand);
    for (const name of ['timeupdate', 'play', 'pause', 'seeked', 'durationchange', 'loadedmetadata', 'volumechange', 'ended', 'emptied']) {
        audioElement.addEventListener(name, publishSoon);
    }
    for (const name of ['queue:changed', 'queue:indexChanged', 'queue:songsChanged', 'shuffle:changed', 'playback:stateChanged']) on(name, publishSoon);
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        queueForLightPlayer
    });
}

export { buildSnapshot, queueForLightPlayer };
