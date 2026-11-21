// ==============================================================================
// PLAYBACK - SONG PLAYBACK
// ==============================================================================
import { assignAudioSource } from './15h-equalizer.js';

// Set while the song saved at the last close is put back (startSongPaused below): it is loaded and shown, but not started.
// `restoredSongWaiting` stays true until something else starts playback, so the first press of Play resumes that song instead of
// starting the current view from its first song.
let pausedRestore = null;
let restoredSongWaiting = false;

// A song that was only listed (the other files of the folder of a file opened from outside, electron/open-router.js, bareEntry) has no tags or cover yet.
// It is read first, one file, through the main process, and then played the normal way by playSongFromQueue below. If it cannot be read it is played as
// it is (its title is its file name). The song before goes on until this one is read (a moment); if the queue changed meanwhile, nothing is started.
const readingListed = new Set();
function readListedThenPlay(queueItem, queueIndex) {
    const listed = queueItem.song || queueItem;
    if (readingListed.has(listed.url)) return;
    readingListed.add(listed.url);
    const canRead = typeof desktopApi !== 'undefined' && desktopApi.supports('files.resolveListedFile');
    Promise.resolve()
        .then(() => (canRead ? desktopApi.files.resolveListedFile(listed.url) : null))
        .then((answer) => (answer && answer.success && answer.song ? answer.song : null))
        .catch(() => null)
        .then((read) => {
            readingListed.delete(listed.url);
            if (playbackQueue[queueIndex] !== queueItem) return;
            if (read) {
                if (queueItem.song) queueItem.song = read;
                else playbackQueue[queueIndex] = read;
            } else {
                listed.bare = false;
            }
            updateQueueDisplay();
            playSongFromQueue(queueIndex);
        });
}

export function playSongFromQueue(queueIndex) {
    if (queueIndex < 0 || queueIndex >= playbackQueue.length) return;
    const wanted = playbackQueue[queueIndex];
    if (wanted && (wanted.song || wanted).bare === true) {
        readListedThenPlay(wanted, queueIndex);
        return;
    }

    saveCurrentPlaybackState();

    const previousQueueIndex = currentQueueIndex;
    setCurrentQueueIndex(queueIndex);
    const queueItem = playbackQueue[queueIndex];
    const song = queueItem.song || queueItem;
    const listId = queueItem.listId || currentView;

    if (listId === VIEWS.SEARCH && searchQuery) {
        queueItem.searchQuery = searchQuery;
    }

    const playbackSettings = getAudioPlaybackSettings();
    const previousSong = previousQueueIndex >= 0 && playbackQueue[previousQueueIndex]
        ? playbackQueue[previousQueueIndex].song || playbackQueue[previousQueueIndex]
        : null;
    const isTrackSwitch = !!audioElement.src && previousQueueIndex >= 0 && previousSong && previousSong.id !== song.id;
    const canCrossfade = isTrackSwitch && !audioElement.paused && !audioElement.ended;

    if (isTrackSwitch && typeof cancelActiveAudioFade === 'function') {
        cancelActiveAudioFade();
    }

    if (pausedRestore) {
        // Not started: the file is loaded and the position is put back once its length is known; it is not played, so no fade, no play history.
        assignAudioSource(audioElement, song.url);
        audioElement.volume = getTargetTrackVolume(song);
        const position = pausedRestore.position;
        if (position > 0) {
            audioElement.addEventListener('loadedmetadata', () => {
                const length = audioElement.duration;
                if (Number.isFinite(length) && position < length - 3) audioElement.currentTime = position; // near the end: start over
            }, { once: true });
        }
    } else if (playbackSettings.gaplessEnabled && isTrackSwitch) {
        if (typeof cancelPendingCrossfade === 'function') {
            cancelPendingCrossfade();
        }

        const usedPreloadedTrack = usePreloadedGaplessTrack(song);

        if (!usedPreloadedTrack) {
            assignAudioSource(audioElement, song.url);
            audioElement.currentTime = 0;
            audioElement.volume = getTargetTrackVolume(song);
            audioElement.play().catch(() => {});
        } else {
            audioElement.volume = getTargetTrackVolume(song);
            noteGaplessPlayRequested(song);
            audioElement.play().catch(() => {});
        }
    } else if (playbackSettings.crossfadeEnabled && canCrossfade) {
        scheduleCrossfadeTransition(song);
    } else {
        assignAudioSource(audioElement, song.url);
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
        startFadeIn(song, (Number(playbackSettings.fadeInDuration) || 1) * 1000);
    }

    pushToHistoryStack(song);

    document.querySelector('.player-song-info').classList.add('has-song');
    document.getElementById('player-title').textContent = song.title;
    document.getElementById('player-artist').innerHTML = buildPlayerArtistHTML(song.artist);
    const songCover = typeof song.cover === 'string' && song.cover.trim() !== '' ? song.cover : PLACEHOLDER_IMAGE;
    document.getElementById('player-cover').src = songCover;
    document.getElementById('player-cover').alt = `Cover for ${song.title}`;

    if (!pausedRestore) {
        restoredSongWaiting = false;
        playButton.innerHTML = '<i class="fas fa-pause"></i>';
        playButton.setAttribute('aria-label', 'Pause');
        playButton.setAttribute('title', 'Pause');
    }
    emit('playback:stateChanged', { playing: isCurrentViewPlaying() });

    const lyricsToggleBtnEl = document.getElementById('lyrics-toggle-btn');
    if (lyricsToggleBtnEl) {
        const hasPlainLyrics = typeof getLyricsForSong === 'function' && String(getLyricsForSong(song) || '').trim() !== '';
        const hasSyncedLyrics = typeof getSyncedLyricsForSong === 'function' && String(getSyncedLyricsForSong(song) || '').trim() !== '';
        const hasLyrics = hasPlainLyrics || hasSyncedLyrics;
        lyricsToggleBtnEl.disabled = false;
        lyricsToggleBtnEl.setAttribute('data-original-title', hasLyrics ? 'Lyrics' : 'No lyrics for this song');
    }

    const progressBar = document.getElementById('progress-bar');
    const progressKnob = document.getElementById('progress-knob');
    if (progressBar) progressBar.style.width = '0%';
    if (progressKnob) progressKnob.style.left = '0%';

    totalTimeDisplay.textContent = song.duration;
    updateTimeDisplay();

    updateAlbumArt();

    if (isShuffled) {
        while (playbackQueue.length - currentQueueIndex < 20) {
            const nextSong = getNextShuffledSong();
            if (nextSong) {
                playbackQueue.push(nextSong);
            } else {
                break;
            }
        }
        cleanupPlaybackQueue();
    }

    updateQueueDisplay();

    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const currentItem = playbackQueue[currentQueueIndex];
        const currentSong = currentItem.song || currentItem;
        const currentListId = currentItem.listId || currentView;
        const currentGhostSlot = currentItem.ghostSlot !== undefined ? currentItem.ghostSlot : null;

        if (!pausedRestore) movePlayedItemToTop(currentListId);
        updatePlayingHighlight(currentSong.id, currentListId, currentGhostSlot);
    }

    if (playbackSettings.gaplessEnabled) {
        prepareGaplessNextTrackSoon(); // not while this track is starting: see 10c-playback-queue.js
    }
}

// The song that is playing was edited (its tags or cover): paint the new title, artist and cover into the player bar, the track panel and the
// queue, without restarting the song. playSongFromQueue above is the only other place that writes them, and it runs when a song STARTS.
export function refreshPlayingSongView() {
    const item = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
    const song = item && (item.song || item);
    if (!song) return;
    const title = document.getElementById('player-title');
    const artist = document.getElementById('player-artist');
    const cover = document.getElementById('player-cover');
    if (title) title.textContent = song.title;
    if (artist) artist.innerHTML = buildPlayerArtistHTML(song.artist);
    if (cover) {
        cover.src = typeof song.cover === 'string' && song.cover.trim() !== '' ? song.cover : PLACEHOLDER_IMAGE;
        cover.alt = `Cover for ${song.title}`;
    }
    updateAlbumArt();
    updateQueueDisplay();
    emit('queue:songsChanged'); // the small player window follows this one
}

export function createQueueFromSongList(songList, startIndex = 0, listId = VIEWS.ALL_SONGS) {
    setQueueDisplayLimit(50);
    setPlaybackQueue(songList.map((song, idx) => ({
        song: song,
        listId: listId,
        ghostSlot: idx
    })));
    setCurrentQueueIndex(startIndex);

    updateQueueDisplay();

    if (playbackQueue.length > 0 && currentQueueIndex >= 0 && currentQueueIndex < playbackQueue.length) {
        playSongFromQueue(currentQueueIndex);
    }
}

export function playSongFromList(songId, listId = null, clickedIndex = null) {
    const activeListId = listId || currentView;
    setLastPlaybackListId(activeListId);

    const existingItem =
        currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
    const existingSong = existingItem ? existingItem.song || existingItem : null;
    if (existingSong && existingSong.id === songId && audioElement.src) {
        if (audioElement.paused) {
            audioElement.play();
        }
        return;
    }

    saveCurrentPlaybackState();

    setIsPrevNavigation(false);
    setIsManualPlay(true);
    const song = getSongById(songId);
    if (!song) return;

    const songList = getSongsForList(activeListId);

    if (activeListId === VIEWS.SEARCH_ITEMS || activeListId === VIEWS.SEARCH) {
        ghostLists[VIEWS.SEARCH_ITEMS] = [];
        for (let i = 0; i < songList.length; i++) {
            ghostLists[VIEWS.SEARCH_ITEMS].push(`SearchItem${String(i + 1).padStart(5, '0')}`);
        }
        setNextSearchItemSlotId(songList.length + 1);
    } else if (activeListId === VIEWS.FAVORITES) {
        ghostLists[VIEWS.FAVORITES] = [];
        for (let i = 0; i < songList.length; i++) {
            ghostLists[VIEWS.FAVORITES].push(`Favorites${String(i + 1).padStart(5, '0')}`);
        }
        setNextFavoriteSlotId(songList.length + 1);
    } else if (activeListId && activeListId.startsWith('playlist-')) {
        const playlistId = activeListId.replace('playlist-', '');
        initGhostSlots(activeListId, songList, `Playlist${playlistId}`);
    } else if (activeListId && activeListId.startsWith('a') && activeListId.length === 13) {
        initGhostSlots(activeListId, songList, `Album-${activeListId}`);
    } else if (activeListId && activeListId.startsWith('r') && activeListId.length === 13) {
        initGhostSlots(activeListId, songList, `Artist-${activeListId}`);
    }

    const startIndex = songList.findIndex((s) => s.id === songId);
    if (startIndex === -1) return;

    const ghostSlotIndex = clickedIndex !== null ? clickedIndex : startIndex;

    if (isShuffled) {
        const currentListSongs = getSongsForList(activeListId);

        setPlaybackQueue([
            {
                song: song,
                listId: activeListId,
                ghostSlot: ghostSlotIndex
            }
        ]);

        setCurrentQueueIndex(0);
        if (shuffleMode === 'smart') {
            resetSmartShuffle(currentListSongs, song.id, activeListId);
        } else {
            resetShuffle(currentListSongs, song.id, activeListId);
        }

        while (playbackQueue.length < 20) {
            const nextSong = getNextShuffledSong();
            if (!nextSong) break;
            playbackQueue.push(nextSong);
        }

        playSongFromQueue(0);
    } else {
        const queueItems = songList.map((s, idx) => ({
            song: s,
            listId: activeListId,
            ghostSlot: idx
        }));
        setPlaybackQueue(queueItems);
        setCurrentQueueIndex(startIndex);

        updateQueueDisplay();

        if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
            playSongFromQueue(currentQueueIndex);
        }
    }

    if (!pausedRestore) movePlayedItemToTop(activeListId);
    updatePlayingHighlight(songId, activeListId, ghostSlotIndex);
}

/**
 * Puts a song back as the current one without playing it: the player bar shows it, the queue is its list, Play starts it at `position`
 * (seconds). Used once at start-up for the song that was playing when the app was closed (session.js). Returns true when it is loaded;
 * false (nothing changed) when `listId` no longer holds the song.
 */
export function startSongPaused(songId, listId, position = 0) {
    pausedRestore = { position: Number.isFinite(position) && position > 0 ? position : 0 };
    try {
        playSongFromList(songId, listId);
    } finally {
        pausedRestore = null;
    }
    const item = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
    const loaded = Boolean(item && (item.song || item).id === songId);
    restoredSongWaiting = loaded;
    return loaded;
}

function playAllFromCurrentView() {
    const currentItem =
        currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
    const currentListId = currentItem ? currentItem.listId || VIEWS.ALL_SONGS : null;

    const nonPlayableViews = [VIEWS.LYRICS, VIEWS.ONLINE_LYRICS, VIEWS.SMART_LYRICS, VIEWS.SETTINGS, VIEWS.SEARCH_HISTORY];
    const isNonPlayableView = nonPlayableViews.includes(currentView);

    const isSameViewPaused = currentItem && currentListId === currentView && audioElement.paused;
    const isPausedInOtherView = currentItem && isNonPlayableView && audioElement.paused && audioElement.src;

    if (isSameViewPaused || isPausedInOtherView) {
        audioElement.play();
        return;
    }

    if (!audioElement.src && currentQueueIndex < 0 && lastPlaybackListId && lastPlaybackListId !== VIEWS.ALL_SONGS) {
        playCurrentViewFromStart(lastPlaybackListId);
        return;
    }

    playCurrentViewFromStart();
}

export function playOrResumeCurrentView() {
    if (restoredSongWaiting && audioElement.src && audioElement.paused && currentQueueIndex >= 0) {
        restoredSongWaiting = false;
        audioElement.play().catch(() => {});
        return;
    }
    if (audioElement.src && !audioElement.paused) {
        if (typeof pausePlaybackWithFade === 'function') {
            pausePlaybackWithFade();
        } else {
            audioElement.pause();
        }
        return;
    }

    playAllFromCurrentView();
}

export function playCurrentViewFromStart(targetListId = currentView) {
    saveCurrentPlaybackState();
    setQueueDisplayLimit(50);

    setIsPrevNavigation(false);
    setIsManualPlay(true);

    let songsToPlay = [];
    let listId = targetListId || currentView;
    setLastPlaybackListId(listId);

    if (currentView === VIEWS.ALL_SONGS) {
        songsToPlay = [...SONGS_DATA];
    } else if (currentView === VIEWS.FAVORITES) {
        const favorites = getFavorites();
        songsToPlay = favorites.map((id) => getSongById(id)).filter((s) => s);
    } else if (currentView === VIEWS.HISTORY) {
        const history = getPlayHistory();
        songsToPlay = history.map((entry) => getSongById(entry.id)).filter((s) => s);
    } else if (currentView === VIEWS.SEARCH_ITEMS || currentView === VIEWS.SEARCH) {
        songsToPlay = getSongsForList(VIEWS.SEARCH_ITEMS);
    } else if (currentView && currentView.startsWith('playlist-')) {
        const playlistId = currentView.replace('playlist-', '');
        songsToPlay = getPlaylistSongs(playlistId);
    } else if (currentView && currentView.startsWith('a') && currentView.length === 13) {
        songsToPlay = getAlbumSongs(currentView);
    } else if (currentView && currentView.startsWith('r') && currentView.length === 13) {
        songsToPlay = getArtistSongs(currentView);
    } else if (lastPlaybackListId && lastPlaybackListId !== VIEWS.ALL_SONGS && lastPlaybackListId !== VIEWS.LYRICS) {
        listId = lastPlaybackListId;
        setLastPlaybackListId(listId);
        songsToPlay = getSongsForList(listId);
    } else {
        songsToPlay = getActiveSongs();
    }

    if (songsToPlay.length === 0) {
        showNotification('No songs to play', 'warning', 2000);
        return;
    }

    if (repeatFunctionalityActive && repeatMode === 2) {
        setIsShuffled(false);
        shuffleButton.classList.remove('active');
        setPlaybackQueue([
            {
                song: songsToPlay[0],
                listId: listId,
                ghostSlot: 0
            }
        ]);
        setCurrentQueueIndex(0);
        audioElement.loop = true;
    } else if (isShuffled) {
        let firstSong;
        let randomIndex = 0;

        if (shuffleMode === 'smart') {
            if (!resetSmartShuffle(songsToPlay, null, listId)) {
                showNotification('Smart Shuffle needs more than 50 songs in this list', 'warning', 3000);
                setIsShuffled(false);
                setShuffleMode('normal');
                shuffleButton.classList.remove('active');
                emit('shuffle:changed', { isShuffled });
                return;
            }
            const firstItem = getNextSmartShuffledSong();
            if (!firstItem) return;
            firstSong = firstItem.song;
            randomIndex = songsToPlay.findIndex((song) => song.id === firstSong.id);
        } else {
            randomIndex = Math.floor(Math.random() * songsToPlay.length);
            firstSong = songsToPlay[randomIndex];
            resetShuffle(songsToPlay, firstSong.id, listId);
        }

        setPlaybackQueue([
            {
                song: firstSong,
                listId: listId,
                ghostSlot: randomIndex
            }
        ]);
        setCurrentQueueIndex(0);
    } else {
        setPlaybackQueue(songsToPlay.map((s, idx) => ({
            song: s,
            listId: listId,
            ghostSlot: idx
        })));
        setCurrentQueueIndex(0);
    }

    movePlayedItemToTop(listId);
    updateQueueDisplay();
    playSongFromQueue(0);
}

export function isCurrentViewPlaying() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return false;
    const currentItem = playbackQueue[currentQueueIndex];
    const currentListId = currentItem.listId || VIEWS.ALL_SONGS;
    return currentListId === currentView && !audioElement.paused;
}

export function togglePlayAllFromCurrentView() {
    const btn = document.getElementById('subhero-play-btn');
    if (btn) temporarilySuppressTooltip(btn);

    if (isCurrentViewPlaying()) {
        audioElement.pause();
    } else {
        playAllFromCurrentView();
    }
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        refreshPlayingSongView,
        playSongFromQueue,
        createQueueFromSongList,
        playSongFromList,
        startSongPaused,
        playOrResumeCurrentView,
        playCurrentViewFromStart,
        isCurrentViewPlaying,
        togglePlayAllFromCurrentView
    });
}
