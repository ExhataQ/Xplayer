// ==============================================================================
// PLAYBACK - SONG PLAYBACK
// ==============================================================================
function playSongFromQueue(queueIndex) {
    if (queueIndex < 0 || queueIndex >= playbackQueue.length) return;

    saveCurrentPlaybackState();

    const previousQueueIndex = currentQueueIndex;
    currentQueueIndex = queueIndex;
    const queueItem = playbackQueue[queueIndex];
    const song = queueItem.song || queueItem;
    const listId = queueItem.listId || currentView;
    const ghostSlot = queueItem.ghostSlot !== undefined ? queueItem.ghostSlot : null;

    if (listId === 'search' && searchQuery) {
        queueItem.searchQuery = searchQuery;
    }

    const playbackSettings = getAudioPlaybackSettings();
    const previousSong = previousQueueIndex >= 0 && playbackQueue[previousQueueIndex]
        ? playbackQueue[previousQueueIndex].song || playbackQueue[previousQueueIndex]
        : null;
    const isTrackSwitch = !!audioElement.src && previousQueueIndex >= 0 && previousSong && previousSong.id !== song.id;
    const canCrossfade = isTrackSwitch && !audioElement.paused && !audioElement.ended;
    const isSameSong = previousSong && previousSong.id === song.id;

    if (isTrackSwitch && typeof cancelActiveAudioFade === 'function') {
        cancelActiveAudioFade();
    }

    if (playbackSettings.gaplessEnabled && isTrackSwitch) {
        if (typeof cancelPendingCrossfade === 'function') {
            cancelPendingCrossfade();
        }

        const usedPreloadedTrack = usePreloadedGaplessTrack(song);

        if (!usedPreloadedTrack) {
            audioElement.src = song.url;
            audioElement.currentTime = 0;
            audioElement.volume = getTargetTrackVolume(song);
            audioElement.play().catch(() => {});
        } else {
            audioElement.volume = getTargetTrackVolume(song);
            audioElement.play().catch(() => {});
        }
    } else if (playbackSettings.crossfadeEnabled && canCrossfade) {
        scheduleCrossfadeTransition(song);
    } else {
        audioElement.src = song.url;
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

    playButton.innerHTML = '<i class="fas fa-pause"></i>';
    playButton.setAttribute('aria-label', 'Pause');
    playButton.setAttribute('title', 'Pause');
    updateSubheroPlayButton(isCurrentViewPlaying());

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

        movePlayedItemToTop(currentListId);
        updatePlayingHighlight(currentSong.id, currentListId, currentGhostSlot);
    }

    if (playbackSettings.gaplessEnabled) {
        prepareGaplessNextTrack();
    }
}

function createQueueFromSongList(songList, startIndex = 0, listId = 'all-songs') {
    queueDisplayLimit = 50;
    playbackQueue = songList.map((song, idx) => ({
        song: song,
        listId: listId,
        ghostSlot: idx
    }));
    currentQueueIndex = startIndex;

    updateQueueDisplay();

    if (playbackQueue.length > 0 && currentQueueIndex >= 0 && currentQueueIndex < playbackQueue.length) {
        playSongFromQueue(currentQueueIndex);
    }
}

function playSongFromList(songId, listId = null, clickedIndex = null) {
    const activeListId = listId || currentView;
    lastPlaybackListId = activeListId;

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

    isPrevNavigation = false;
    isManualPlay = true;
    const song = getSongById(songId);
    if (!song) return;

    const songList = getSongsForList(activeListId);

    if (activeListId === 'search-items' || activeListId === 'search') {
        ghostLists['search-items'] = [];
        for (let i = 0; i < songList.length; i++) {
            ghostLists['search-items'].push(`SearchItem${String(i + 1).padStart(5, '0')}`);
        }
        nextSearchItemSlotId = songList.length + 1;
    } else if (activeListId === 'favorites') {
        ghostLists['favorites'] = [];
        for (let i = 0; i < songList.length; i++) {
            ghostLists['favorites'].push(`Favorites${String(i + 1).padStart(5, '0')}`);
        }
        nextFavoriteSlotId = songList.length + 1;
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

        playbackQueue = [
            {
                song: song,
                listId: activeListId,
                ghostSlot: ghostSlotIndex
            }
        ];

        currentQueueIndex = 0;
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
        playbackQueue = queueItems;
        currentQueueIndex = startIndex;

        updateQueueDisplay();

        if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
            playSongFromQueue(currentQueueIndex);
        }
    }

    movePlayedItemToTop(activeListId);
    updatePlayingHighlight(songId, activeListId, ghostSlotIndex);
}

function playSongFromHistory(songId) {
    const song = getSongById(songId);
    if (!song || deletedSongIds.has(song.id)) return;

    if (isShuffled) {
        const currentListSongs = getActiveSongs();

        playbackQueue = [
            {
                song: song,
                listId: 'all-songs',
                ghostSlot: null
            }
        ];

        currentQueueIndex = 0;
        if (shuffleMode === 'smart') {
            resetSmartShuffle(currentListSongs, songId, 'all-songs');
        } else {
            resetShuffle(currentListSongs, songId, 'all-songs');
        }
        playSongFromQueue(0);
    } else {
        playbackQueue = SONGS_DATA.map((s, idx) => ({
            song: s,
            listId: 'all-songs',
            ghostSlot: idx
        }));
        currentQueueIndex = SONGS_DATA.findIndex((s) => s.id === songId);

        updateQueueDisplay();

        if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
            playSongFromQueue(currentQueueIndex);
        }
    }
}

function playAllFromCurrentView() {
    const currentItem =
        currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
    const currentListId = currentItem ? currentItem.listId || 'all-songs' : null;

    const nonPlayableViews = ['lyrics', 'online-lyrics', 'smart-lyrics', 'settings', 'search-history'];
    const isNonPlayableView = nonPlayableViews.includes(currentView);

    const isSameViewPaused = currentItem && currentListId === currentView && audioElement.paused;
    const isPausedInOtherView = currentItem && isNonPlayableView && audioElement.paused && audioElement.src;

    if (isSameViewPaused || isPausedInOtherView) {
        audioElement.play();
        return;
    }

    if (!audioElement.src && currentQueueIndex < 0 && lastPlaybackListId && lastPlaybackListId !== 'all-songs') {
        playCurrentViewFromStart(lastPlaybackListId);
        return;
    }

    playCurrentViewFromStart();
}

function playOrResumeCurrentView() {
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

function playCurrentViewFromStart(targetListId = currentView) {
    saveCurrentPlaybackState();
    queueDisplayLimit = 50;

    isPrevNavigation = false;
    isManualPlay = true;

    let songsToPlay = [];
    let listId = targetListId || currentView;
    const previousListId = lastPlaybackListId;
    lastPlaybackListId = listId;

    if (currentView === 'all-songs') {
        songsToPlay = [...SONGS_DATA];
    } else if (currentView === 'favorites') {
        const favorites = getFavorites();
        songsToPlay = favorites.map((id) => getSongById(id)).filter((s) => s);
    } else if (currentView === 'history') {
        const history = getPlayHistory();
        songsToPlay = history.map((entry) => getSongById(entry.id)).filter((s) => s);
    } else if (currentView === 'search-items' || currentView === 'search') {
        songsToPlay = getSongsForList('search-items');
    } else if (currentView && currentView.startsWith('playlist-')) {
        const playlistId = currentView.replace('playlist-', '');
        songsToPlay = getPlaylistSongs(playlistId);
    } else if (currentView && currentView.startsWith('a') && currentView.length === 13) {
        songsToPlay = getAlbumSongs(currentView);
    } else if (currentView && currentView.startsWith('r') && currentView.length === 13) {
        songsToPlay = getArtistSongs(currentView);
    } else if (lastPlaybackListId && lastPlaybackListId !== 'all-songs' && lastPlaybackListId !== 'lyrics') {
        listId = lastPlaybackListId;
        lastPlaybackListId = listId;
        songsToPlay = getSongsForList(listId);
    } else {
        songsToPlay = getActiveSongs();
    }

    if (songsToPlay.length === 0) {
        showNotification('No songs to play', 'warning', 2000);
        return;
    }

    if (repeatFunctionalityActive && repeatMode === 2) {
        isShuffled = false;
        shuffleButton.classList.remove('active');
        playbackQueue = [
            {
                song: songsToPlay[0],
                listId: listId,
                ghostSlot: 0
            }
        ];
        currentQueueIndex = 0;
        audioElement.loop = true;
    } else if (isShuffled) {
        let firstSong;
        let randomIndex = 0;

        if (shuffleMode === 'smart') {
            if (!resetSmartShuffle(songsToPlay, null, listId)) {
                showNotification('Smart Shuffle needs more than 50 songs in this list', 'warning', 3000);
                isShuffled = false;
                shuffleMode = 'normal';
                shuffleButton.classList.remove('active');
                updateSubheroShuffleButton();
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

        playbackQueue = [
            {
                song: firstSong,
                listId: listId,
                ghostSlot: randomIndex
            }
        ];
        currentQueueIndex = 0;
    } else {
        playbackQueue = songsToPlay.map((s, idx) => ({
            song: s,
            listId: listId,
            ghostSlot: idx
        }));
        currentQueueIndex = 0;
    }

    movePlayedItemToTop(listId);
    updateQueueDisplay();
    playSongFromQueue(0);
}

function isCurrentViewPlaying() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return false;
    const currentItem = playbackQueue[currentQueueIndex];
    const currentListId = currentItem.listId || 'all-songs';
    return currentListId === currentView && !audioElement.paused;
}

function togglePlayAllFromCurrentView() {
    const btn = document.getElementById('subhero-play-btn');
    if (btn) temporarilySuppressTooltip(btn);

    if (isCurrentViewPlaying()) {
        audioElement.pause();
    } else {
        playAllFromCurrentView();
    }
}
