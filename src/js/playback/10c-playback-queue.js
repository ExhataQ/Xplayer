// ==============================================================================
// PLAYBACK - QUEUE MANAGEMENT
// ==============================================================================
// True while the queue has songs past the ones drawn; set by updateQueueDisplay, read when the queue is scrolled to its end.
import { assignAudioSource } from './15h-equalizer.js';
import { peekTrackEdges } from './10e-gapless-edges.js';

let queueHasMoreItems = false;
const QUEUE_LOAD_MARGIN_PX = 160;
const QUEUE_DISPLAY_START = 50; // the same starting size createQueueFromSongList uses

export function updateQueueDisplay() {
    const queueList = document.getElementById('queue-list');
    queueHasMoreItems = false;

    if (typeof updateTrackNextBox === 'function') {
        updateTrackNextBox();
    }

    if (repeatFunctionalityActive && repeatMode === 2 && currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const currentSong = playbackQueue[currentQueueIndex];
        queueList.innerHTML = `
                                <div class="queue-lables"><span>Now Playing</span></div>
                                ${renderRightPanelItem(currentSong, {
                                    isNowPlaying: true,
                                    action: ['playFromQueue', [currentQueueIndex]],
                                    menuArgs: [currentSong.id, { queueIndex: currentQueueIndex }]
                                })}
                                <div class="empty-queue">
                                        <i class="fas fa-infinity"></i>
                                        <p>Repeating this song only</p>
                                        <small>Switch to repeat all to see queue</small>
                                </div>`;
        return;
    }

    if (!playbackQueue || playbackQueue.length === 0) {
        queueList.innerHTML = `
                                <div class="empty-queue">
                                        <i class="fas fa-music"></i>
                                        <p>Queue is empty</p>
                                        <small>Play songs to build your queue</small>
                                </div>`;
        return;
    }

    const maxDisplay = queueDisplayLimit;
    const windowStart = currentQueueIndex + 1;
    const upcomingSongs = playbackQueue.slice(windowStart);
    const manualQueueSongs = upcomingSongs.filter((item) => item.source === 'manual' || item.addedManually === true);
    const autoQueueSongs = upcomingSongs.filter((item) => !(item.source === 'manual' || item.addedManually === true));

    const manualWindowEnd = Math.min(manualQueueSongs.length, maxDisplay);
    const autoWindowEnd = Math.min(autoQueueSongs.length, maxDisplay - manualWindowEnd);

    let queueHTML = '';

    if (currentQueueIndex >= 0 && currentQueueIndex < playbackQueue.length) {
        const queueItem = playbackQueue[currentQueueIndex];
        const currentSong = queueItem.song || queueItem;
        queueHTML += `<div class="queue-lables"><span>Now Playing</span></div>`;
        queueHTML += renderRightPanelItem(currentSong, {
            isNowPlaying: true,
            action: ['playFromQueue', [currentQueueIndex]],
            menuArgs: [currentSong.id, { queueIndex: currentQueueIndex }]
        });
    }

    if (manualQueueSongs.length > 0) {
        queueHTML += `<div class="added-to-queue-section">
                                <div class="queue-lables"><span>Added to Queue</span></div>`;

        const displayManualSongs = manualQueueSongs.slice(0, manualWindowEnd);
        displayManualSongs.forEach((queueItem) => {
            const song = queueItem.song || queueItem;
            const originalIndex = playbackQueue.indexOf(queueItem);

            queueHTML += `
                                ${renderRightPanelItem(song, {
                                    action: ['playFromQueue', [originalIndex]],
                                    menuArgs: [song.id, { queueIndex: originalIndex }]
                                })}`;
        });

        if (manualWindowEnd < manualQueueSongs.length) {
            const remainingCount = manualQueueSongs.length - manualWindowEnd;
            queueHTML += `
                                        <div class="empty-queue" style="padding: 10px; margin: 5px 0;">
                                                <small>${remainingCount} more added song${
                remainingCount !== 1 ? 's' : ''
            }</small>
                                        </div>`;
        }

        queueHTML += `</div>`;
    }

    if (autoQueueSongs.length > 0) {
        queueHTML += `<div class="next-songs-section">
                                <div class="queue-lables"><span>Next Songs</span></div>`;

        const displayAutoSongs = autoQueueSongs.slice(0, autoWindowEnd);
        displayAutoSongs.forEach((queueItem, displayIndex) => {
            const song = queueItem.song || queueItem;
            const originalIndex = playbackQueue.indexOf(queueItem);
            const isNext = manualQueueSongs.length === 0 && displayIndex === 0;

            queueHTML += `
                                ${renderRightPanelItem(song, {
                                    action: ['playFromQueue', [originalIndex]],
                                    menuArgs: [song.id, { queueIndex: originalIndex }],
                                    extraClass: isNext ? 'next-in-queue' : ''
                                })}`;
        });

        queueHTML += `</div>`;

        if (autoWindowEnd < autoQueueSongs.length) {
            const remainingCount = autoQueueSongs.length - autoWindowEnd;
            queueHTML += `
                                        <div class="empty-queue" style="padding: 15px; margin-top: 10px;">
                                                <i class="fas fa-ellipsis-h"></i>
                                                <p>${remainingCount} more song${remainingCount !== 1 ? 's' : ''}</p>
                                                <small>Scroll down to see more</small>
                                        </div>`;
        }
    }

    if (manualQueueSongs.length === 0 && autoQueueSongs.length === 0 && currentQueueIndex >= 0) {
        queueHTML += `
                                <div class="next-songs-section">
                                        <div class="empty-queue">
                                                <i class="fas fa-forward"></i>
                                                <p>No more songs in queue</p>
                                                <small>Add more songs to continue</small>
                                        </div>
                                </div>`;
    }

    // No button: the queue grows as its scroller reaches the end (see watchQueueEnd).
    // When nothing is left upcoming the queue is finished: the limit goes back to its starting size for the next queue.
    if (manualQueueSongs.length === 0 && autoQueueSongs.length === 0) setQueueDisplayLimit(QUEUE_DISPLAY_START);
    queueHasMoreItems =
        (isShuffled && shuffleIndex < shuffleOrder.length) ||
        (!isShuffled && manualQueueSongs.length + autoQueueSongs.length > maxDisplay);

    queueList.innerHTML = queueHTML;
    updateScrollbarById('right-panel-content');
    watchQueueEnd(queueList);
}

function loadMoreQueueItems() {
    setQueueDisplayLimit(queueDisplayLimit + queueDisplayPageSize);

    if (isShuffled) {
        const desiredUpcoming = queueDisplayLimit;
        let upcomingCount = 0;

        for (let i = currentQueueIndex + 1; i < playbackQueue.length; i++) {
            const item = playbackQueue[i];
            if (!(item.source === 'manual' || item.addedManually === true)) {
                upcomingCount++;
            }
        }

        while (upcomingCount < desiredUpcoming) {
            const nextSong = getNextShuffledSong();
            if (!nextSong) break;
            playbackQueue.push(nextSong);
            upcomingCount++;
        }
    }

    updateQueueDisplay();
}

// The scroller is the nearest ancestor that scrolls: the drawer body in the new screen, the right panel's content in the old one.
const queueWatched = new WeakSet();

function scrollerOf(node) {
    for (let n = node.parentElement; n && n !== document.body; n = n.parentElement) {
        const overflow = getComputedStyle(n).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') return n;
    }
    return null;
}

// Loads the next page when the scroller is near its end. It also runs after each draw, so a queue too short to scroll fills
// the panel and can be scrolled at all.
function loadQueueIfNearEnd(scroller) {
    if (!queueHasMoreItems) return;
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - QUEUE_LOAD_MARGIN_PX) loadMoreQueueItems();
}

function watchQueueEnd(queueList) {
    const scroller = scrollerOf(queueList);
    if (!scroller) return;
    if (!queueWatched.has(scroller)) {
        queueWatched.add(scroller);
        scroller.addEventListener('scroll', () => loadQueueIfNearEnd(scroller), { passive: true });
    }
    requestAnimationFrame(() => loadQueueIfNearEnd(scroller));
}

registerActions({ loadMoreQueueItems });

export function playFromQueue(queueIndex) {
    if (queueIndex >= 0 && queueIndex < playbackQueue.length) {
        playSongFromQueue(queueIndex);
    }
}

export function removeFromQueue(queueIndex) {
    if (queueIndex >= 0 && queueIndex < playbackQueue.length) {
        // The rows only depend on the queue through the song that is playing, so removing another one needs no redraw of the lists.
        const removedPlaying = queueIndex === currentQueueIndex;
        if (removedPlaying) {
            saveCurrentPlaybackState();

            const nextIndex = queueIndex < playbackQueue.length - 1 ? queueIndex : queueIndex - 1;
            playbackQueue.splice(queueIndex, 1);

            if (playbackQueue.length > 0 && nextIndex >= 0) {
                playSongFromQueue(nextIndex);
            } else {
                audioElement.pause();
                audioElement.src = '';
                setCurrentQueueIndex(-1);
                playButton.innerHTML = '<i class="fas fa-play"></i>';
                playButton.setAttribute('title', 'Play');
                document.querySelector('.player-song-info').classList.remove('has-song');
                document.getElementById('player-title').textContent = 'No song selected';
                document.getElementById('player-artist').textContent = '—';
            }
        } else {
            if (queueIndex < currentQueueIndex) {
                setCurrentQueueIndex(currentQueueIndex - 1);
            }
            playbackQueue.splice(queueIndex, 1);
        }

        updateQueueDisplay();
        if (removedPlaying) emit('queue:songsChanged');
    }
}

export function cleanupPlaybackQueue() {
    if (playbackQueue.length > 50) {
        const keepFrom = Math.max(0, currentQueueIndex);
        setPlaybackQueue(playbackQueue.slice(keepFrom));
        setCurrentQueueIndex(0);
    }
}

export function addSongToQueueNext(songId) {
    const song = getSongById(songId);
    if (!song || deletedSongIds.has(song.id)) return;

    let insertPosition = currentQueueIndex + 1;
    if (currentQueueIndex === -1) {
        insertPosition = 0;
    }

    const queueItem = {
        song: song,
        listId: currentView,
        ghostSlot: null,
        source: 'manual',
        addedManually: true
    };

    playbackQueue.splice(insertPosition, 0, queueItem);

    updateQueueDisplay();

    const addButton = document.querySelector(`.add-to-queue-btn[data-song-id="${songId}"]`);

    if (addButton) {
        addButton.classList.add('adding');

        setTimeout(() => {
            addButton.classList.remove('adding');
        }, 300);
    }
}

export function addToQueueNextFromMenu() {
    if (currentContextSongId !== null) {
        addSongToQueueNext(currentContextSongId);
    }
}

export function addPlaylistToQueue(playlistId) {
    const songs = getPlaylistSongs(playlistId);
    if (songs.length === 0) {
        showNotification('Playlist is empty', 'warning', 2000);
        return;
    }
    const insertAt = currentQueueIndex >= 0 ? currentQueueIndex + 1 : 0;
    songs.forEach((song, i) => {
        playbackQueue.splice(insertAt + i, 0, {
            song: song,
            listId: `playlist-${playlistId}`,
            ghostSlot: null,
            source: 'manual',
            addedManually: true
        });
    });
    updateQueueDisplay();
    showNotification(`Added ${songs.length} song(s) to queue`, 'success', 2000);
}

export function addAlbumToQueue(albumId) {
    const songs = getAlbumSongs(albumId);
    if (songs.length === 0) {
        showNotification('Album is empty', 'warning', 2000);
        return;
    }
    const insertAt = currentQueueIndex >= 0 ? currentQueueIndex + 1 : 0;
    songs.forEach((song, i) => {
        playbackQueue.splice(insertAt + i, 0, {
            song: song,
            listId: albumId,
            ghostSlot: null,
            source: 'manual',
            addedManually: true
        });
    });
    updateQueueDisplay();
    showNotification(`Added ${songs.length} song(s) to queue`, 'success', 2000);
}

export function addArtistToQueue(artistId) {
    const songs = getArtistSongs(artistId);
    if (songs.length === 0) {
        showNotification('Artist has no songs', 'warning', 2000);
        return;
    }
    const insertAt = currentQueueIndex >= 0 ? currentQueueIndex + 1 : 0;
    songs.forEach((song, i) => {
        playbackQueue.splice(insertAt + i, 0, {
            song: song,
            listId: artistId,
            ghostSlot: null,
            source: 'manual',
            addedManually: true
        });
    });
    updateQueueDisplay();
    showNotification(`Added ${songs.length} song(s) to queue`, 'success', 2000);
}

export function addSongToQueueAt(songId, insertIndex) {
    const song = getSongById(songId);
    if (!song || deletedSongIds.has(song.id)) return false;

    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > playbackQueue.length) insertIndex = playbackQueue.length;

    const queueItem = {
        song: song,
        listId: currentView,
        ghostSlot: null,
        source: 'manual',
        addedManually: true
    };

    playbackQueue.splice(insertIndex, 0, queueItem);

    if (insertIndex <= currentQueueIndex) {
        setCurrentQueueIndex(currentQueueIndex + 1);
    }

    updateQueueDisplay();
    return true;
}

let gaplessPreloadedSongId = null;
let gaplessPreloadedUrl = null;

// GAPLESS, THE EARLY START. Waiting for the 'ended' event always leaves a gap: the event comes after the last sample, and play() on the spare
// element then needs tens of milliseconds to turn into sound. So the next track is started a little BEFORE the current one ends, by the time
// play() has been seen to take (learned from every swap, starting from a guess). The current track is not cut: it plays out its last
// milliseconds on its own element (the "outgoing" element) while the next one comes in.
const GAPLESS_LEAD_START_MS = 35; // where a format starts before anything is measured: real changes took 16 to 30 ms (MP3) and 21 to 70 ms (FLAC)
const GAPLESS_LEAD_MIN_MS = 8;
const GAPLESS_LEAD_MAX_MS = 300;
const GAPLESS_LEAD_SAFETY_MS = 6; // a tiny overlap is less audible than a tiny gap, so the start errs early, but only by this much
const GAPLESS_EDGES_MAX_MS = 120; // the most the silent edges (10e-gapless-edges.js) can move the start by, whatever was measured
const GAPLESS_READY_STATE = 3; // HAVE_FUTURE_DATA: the spare element can play on without waiting
const GAPLESS_LEAD_SAMPLES = 5; // how many recent measurements a format's lead is the median of
const GAPLESS_PRELOAD_DELAY_MS = 1200; // the next-but-one track is loaded this long after a track has started, not while it is starting
const gaplessLeadByFormat = new Map(); // file extension -> its recent measured start-up times (ms): a FLAC takes a different time to start than an MP3
let gaplessPreloadTimer = null;
let gaplessLeadTimer = null;
let gaplessEarlyAdvance = false;
let gaplessSoundTimer = null;
let gaplessOutgoingElement = null;
let gaplessOutgoingTimer = null;

/** How long to wait before the early start fires: 0 or less means it is time now. Pure, so it can be tested. */
export function gaplessWaitMs(remainingSeconds, playbackRate, leadMs) {
    const rate = Number(playbackRate) > 0 ? Number(playbackRate) : 1;
    return (remainingSeconds / rate) * 1000 - leadMs;
}

/**
 * The lead to use from recent measured play()-to-sound times: their median, so one slow start (the main thread was busy, a file was cold) or one
 * fast one does not move it much. Measurements that cannot be right are ignored; null when none is usable. Pure.
 */
export function gaplessLeadFromSamples(samples) {
    const usable = (samples || []).filter((ms) => Number.isFinite(ms) && ms >= 5 && ms <= 600).sort((a, b) => a - b);
    if (usable.length === 0) return null;
    const middle = usable.length >> 1;
    const median = usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
    return Math.min(GAPLESS_LEAD_MAX_MS, Math.max(GAPLESS_LEAD_MIN_MS, median));
}

export function cancelGaplessLead() {
    if (gaplessLeadTimer) {
        clearTimeout(gaplessLeadTimer);
        gaplessLeadTimer = null;
    }
}

/** The file extension of a song ('flac', 'mp3', ...), lower case, or '' when its url has none. Pure. */
export function gaplessFormatOf(song) {
    const match = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(String(song && song.url ? song.url : ''));
    return match ? match[1].toLowerCase() : '';
}

function gaplessLeadFor(song) {
    const learned = gaplessLeadFromSamples(gaplessLeadByFormat.get(gaplessFormatOf(song)));
    return learned === null ? GAPLESS_LEAD_START_MS : learned;
}

function gaplessNextSong() {
    const nextItem = playbackQueue[getGaplessNextQueueIndex()];
    return nextItem ? nextItem.song || nextItem : null;
}

/** The silence at the end of the track playing plus the silence at the start of the next one: the next track has to start that much earlier still. */
function gaplessEdgesMs() {
    const currentItem = playbackQueue[currentQueueIndex];
    const tail = peekTrackEdges(currentItem && (currentItem.song || currentItem));
    const head = peekTrackEdges(gaplessNextSong());
    return Math.min(GAPLESS_EDGES_MAX_MS, (tail ? tail.tailMs : 0) + (head ? head.headMs : 0));
}

function gaplessTotalLeadMs() {
    return gaplessLeadFor(gaplessNextSong()) + GAPLESS_LEAD_SAFETY_MS + gaplessEdgesMs();
}

/** Why the early start cannot happen now ('' when it can). The first two are normal and silent; the others are logged near the end of a track. */
function gaplessBlocker() {
    if (gaplessOutgoingElement) return 'outgoing';
    if (repeatFunctionalityActive && repeatMode === 2) return 'repeat-one';
    const nextIndex = getGaplessNextQueueIndex();
    if (nextIndex === -1) return 'last-track';
    const nextItem = playbackQueue[nextIndex];
    const nextSong = nextItem && (nextItem.song || nextItem);
    if (!nextSong || gaplessPreloadedSongId !== nextSong.id || gaplessPreloadedUrl !== nextSong.url) return 'next track not preloaded';
    if (gaplessAudioElement.readyState < GAPLESS_READY_STATE) return `next track not buffered yet (readyState ${gaplessAudioElement.readyState})`;
    return '';
}

function isGaplessNextReady() {
    return gaplessBlocker() === '';
}

let gaplessBlockedLoggedFor = '';

// Said once per track, in the last 4 seconds, so a missing early start can be explained from the console instead of guessed at.
function noteGaplessBlocked(audio, blocker) {
    if (!blocker || blocker === 'outgoing' || blocker === 'repeat-one' || blocker === 'last-track') return;
    if (audio.duration - audio.currentTime > 4) return;
    const key = `${currentQueueIndex}:${blocker}`;
    if (key === gaplessBlockedLoggedFor) return;
    gaplessBlockedLoggedFor = key;
    console.info(`[gapless] no early start for this change: ${blocker}`);
}

/** Called on every progress tick, seek, rate change and play of the active element: works out when the early start is due and sets one timer for it. */
export function armGaplessLead(audio) {
    if (audio !== audioElement) return; // the outgoing element's own ticks must not cancel the timer of the track that is starting
    cancelGaplessLead();
    if (audio.paused || audio.ended) return;
    if (!getAudioPlaybackSettings().gaplessEnabled) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const blocker = gaplessBlocker();
    if (blocker) {
        noteGaplessBlocked(audio, blocker);
        return;
    }

    const waitMs = gaplessWaitMs(audio.duration - audio.currentTime, audio.playbackRate, gaplessTotalLeadMs());
    if (waitMs > 30) {
        // Sleep to just short of the moment, then work it out again from the real position: sleeping the whole way would trust a clock that seeks and stalls move.
        gaplessLeadTimer = setTimeout(() => armGaplessLead(audio), Math.min(waitMs - 25, 1000));
        return;
    }
    pollGaplessStart(audio);
}

// The last 30 ms: look at the real position every 2 ms instead of trusting one timer, so the start lands within a couple of ms of the moment.
function pollGaplessStart(audio) {
    gaplessLeadTimer = setTimeout(() => {
        gaplessLeadTimer = null;
        if (audio !== audioElement || audio.paused || audio.ended) return;
        const waitNow = gaplessWaitMs(audio.duration - audio.currentTime, audio.playbackRate, gaplessTotalLeadMs());
        if (waitNow <= 1) startGaplessEarly(audio);
        else if (waitNow > 30) armGaplessLead(audio); // the position jumped (a seek, a stall): work it out afresh
        else pollGaplessStart(audio);
    }, 2);
}

function startGaplessEarly(audio) {
    if (audio !== audioElement || audio.paused || audio.ended || !isGaplessNextReady()) return;
    const nextIndex = getGaplessNextQueueIndex();
    console.info(`[gapless] early start with ${Math.round((audio.duration - audio.currentTime) * 1000)} ms left; lead ${Math.round(gaplessLeadFor(gaplessNextSong()))} ms (${gaplessFormatOf(gaplessNextSong()) || '?'}) + safety ${GAPLESS_LEAD_SAFETY_MS} ms + silent edges ${Math.round(gaplessEdgesMs())} ms`);
    emit('playback:recentPanelChanged'); // what the 'ended' handler does before it moves on
    gaplessEarlyAdvance = true;
    try {
        playSongFromQueue(nextIndex);
    } finally {
        gaplessEarlyAdvance = false;
    }
}

/**
 * playSong calls this just before play() on a preloaded element. The 'playing' event comes before the first audio reaches the speakers, so it is
 * not used: the start-up time is taken as the moment the element's own clock begins to run, found by looking every 2 ms, and learned for this
 * file format.
 */
export function noteGaplessPlayRequested(song) {
    if (gaplessSoundTimer) clearTimeout(gaplessSoundTimer);
    const audio = audioElement;
    const format = gaplessFormatOf(song);
    const startedAt = performance.now();
    const look = () => {
        gaplessSoundTimer = null;
        if (audio !== audioElement) return;
        const waited = performance.now() - startedAt;
        if (audio.currentTime >= 0.003) {
            const measured = waited - 3; // the clock had already run 3 ms when it was seen
            const recent = (gaplessLeadByFormat.get(format) || []).concat(measured).slice(-GAPLESS_LEAD_SAMPLES);
            gaplessLeadByFormat.set(format, recent);
            console.info(`[gapless] ${format || 'this format'} took ${Math.round(measured)} ms from play() to sound; the lead for it is now ${Math.round(gaplessLeadFor(song))} ms`);
            return;
        }
        if (waited < 800) gaplessSoundTimer = setTimeout(look, 2);
    };
    gaplessSoundTimer = setTimeout(look, 2);
}

function holdGaplessOutgoing(element) {
    gaplessOutgoingElement = element;
    element.addEventListener('ended', finishGaplessOutgoing, { once: true });
    const remainingMs = Number.isFinite(element.duration)
        ? ((element.duration - element.currentTime) / (element.playbackRate || 1)) * 1000
        : 0;
    // The 'ended' event is the normal end; this timer only makes sure a stalled element cannot hold the spare slot for good.
    gaplessOutgoingTimer = setTimeout(finishGaplessOutgoing, Math.min(3000, Math.max(0, remainingMs) + 300));
}

function finishGaplessOutgoing() {
    if (gaplessOutgoingTimer) {
        clearTimeout(gaplessOutgoingTimer);
        gaplessOutgoingTimer = null;
    }
    const element = gaplessOutgoingElement;
    if (!element) return;
    gaplessOutgoingElement = null;
    element.removeEventListener('ended', finishGaplessOutgoing);
    if (element === gaplessAudioElement) {
        element.pause();
        element.removeAttribute('src');
        element.load();
    }
    prepareGaplessNextTrackSoon(); // the spare element was busy; now the track after the one that just started can load into it
}

export function clearGaplessPreload() {
    if (!gaplessAudioElement) return;

    if (gaplessOutgoingTimer) {
        clearTimeout(gaplessOutgoingTimer);
        gaplessOutgoingTimer = null;
    }
    gaplessOutgoingElement = null;
    cancelGaplessLead();
    if (gaplessPreloadTimer) {
        clearTimeout(gaplessPreloadTimer);
        gaplessPreloadTimer = null;
    }

    gaplessAudioElement.pause();
    gaplessAudioElement.removeAttribute('src');
    gaplessAudioElement.load();

    gaplessPreloadedSongId = null;
    gaplessPreloadedUrl = null;
}

function getGaplessNextQueueIndex() {
    if (playbackQueue.length === 0 || currentQueueIndex < 0) {
        return -1;
    }

    if (currentQueueIndex < playbackQueue.length - 1) {
        return currentQueueIndex + 1;
    }

    if (repeatMode === 1 && playbackQueue.length > 0) {
        return 0;
    }

    return -1;
}

function preloadGaplessSong(song) {
    if (!getAudioPlaybackSettings().gaplessEnabled || !song || !song.url) {
        clearGaplessPreload();
        return;
    }

    if (
        gaplessPreloadedSongId === song.id &&
        gaplessPreloadedUrl === song.url
    ) {
        return;
    }

    gaplessAudioElement.pause();
    assignAudioSource(gaplessAudioElement, song.url);
    gaplessAudioElement.preload = 'auto';
    gaplessAudioElement.load();

    gaplessPreloadedSongId = song.id;
    gaplessPreloadedUrl = song.url;
}

/**
 * Loads the next track into the spare element a little after the current one has started. Doing it at once, as a track begins, makes the file
 * read and decoder set-up of the next (large, for FLAC) file compete with the start-up of the track that is just beginning.
 */
export function prepareGaplessNextTrackSoon() {
    if (gaplessPreloadTimer) clearTimeout(gaplessPreloadTimer);
    gaplessPreloadTimer = setTimeout(() => {
        gaplessPreloadTimer = null;
        prepareGaplessNextTrack();
    }, GAPLESS_PRELOAD_DELAY_MS);
}

export function prepareGaplessNextTrack() {
    if (!getAudioPlaybackSettings().gaplessEnabled) {
        clearGaplessPreload();
        return;
    }

    if (repeatFunctionalityActive && repeatMode === 2) {
        clearGaplessPreload();
        return;
    }

    if (gaplessOutgoingElement) return; // the spare element is still playing the last of the old track; finishGaplessOutgoing loads the next one

    const nextQueueIndex = getGaplessNextQueueIndex();

    if (nextQueueIndex === -1) {
        clearGaplessPreload();
        return;
    }

    const nextQueueItem = playbackQueue[nextQueueIndex];
    const nextSong = nextQueueItem?.song || nextQueueItem;

    if (!nextSong) {
        clearGaplessPreload();
        return;
    }

    preloadGaplessSong(nextSong);
}

export function usePreloadedGaplessTrack(song) {
    if (
        !song ||
        gaplessPreloadedSongId !== song.id ||
        gaplessPreloadedUrl !== song.url
    ) {
        return false;
    }

    const oldActiveAudio = audioElement;
    const nextAudio = gaplessAudioElement;
    // Started early: the old element has not ended yet, and is left to play its last milliseconds instead of being cut off here.
    const keepOutgoing = gaplessEarlyAdvance && !oldActiveAudio.paused && !oldActiveAudio.ended;

    cancelGaplessLead();
    setGaplessActiveElement(nextAudio);
    setAudioElement(nextAudio);

    audioElement.volume = getTargetTrackVolume(song);
    if (audioElement.currentTime > 0) audioElement.currentTime = 0; // a seek throws away what is buffered, so a fresh element is not seeked

    setGaplessAudioElement(oldActiveAudio);

    if (keepOutgoing) {
        holdGaplessOutgoing(oldActiveAudio);
    } else {
        gaplessAudioElement.pause();
        gaplessAudioElement.removeAttribute('src');
        gaplessAudioElement.load();
    }

    gaplessPreloadedSongId = null;
    gaplessPreloadedUrl = null;

    return true;
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        updateQueueDisplay,
        playFromQueue,
        removeFromQueue,
        cleanupPlaybackQueue,
        addSongToQueueNext,
        addToQueueNextFromMenu,
        addPlaylistToQueue,
        addAlbumToQueue,
        addArtistToQueue,
        addSongToQueueAt,
        clearGaplessPreload,
        prepareGaplessNextTrack,
        prepareGaplessNextTrackSoon,
        usePreloadedGaplessTrack,
        armGaplessLead,
        cancelGaplessLead,
        noteGaplessPlayRequested
    });
}
