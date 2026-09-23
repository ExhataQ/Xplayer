// ==============================================================================
// AUDIO EVENT HANDLERS
// ==============================================================================
function refreshCurrentRowIndicator() {
    const row = document.querySelector('.song-item.playing');
    document.querySelectorAll('.left-panel-main-item.playing').forEach((leftPlaying) => {
        leftPlaying.classList.toggle('paused', audioElement.paused);
    });
    if (!row) return;
    const cell = row.querySelector('.song-number-item');
    if (!cell) return;
    if (audioElement.paused) {
        row.classList.add('paused-song');
        const idxStr = cell.getAttribute('data-song-index');
        const idx = parseInt(idxStr, 10);
        cell.innerHTML = !isNaN(idx) ? String(idx + 1) : '';
    } else {
        row.classList.remove('paused-song');
        paintEqOnNumberCell(row);
    }
}

function handleNumberCellClick(songId, listId, index) {
    const clickedSong = getSongById(songId);
    if (!clickedSong) return;

    const currentItem =
        currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
    const currentSong = currentItem ? currentItem.song || currentItem : null;
    const currentListId = currentItem ? currentItem.listId || 'all-songs' : null;

    const isSameSong =
        !!currentSong && !!audioElement.src && currentSong.url === clickedSong.url && currentSong.id === clickedSong.id;

    const isSameList = listId === null || listId === undefined || currentListId === listId;

    if (isSameSong && isSameList) {
        if (audioElement.paused) {
            audioElement.play();
        } else {
            pausePlaybackWithFade();
        }
        return;
    }

    playSongFromList(songId, listId, index);
}

function syncPlayPauseButtons() {
    const isPaused = audioElement.paused;

    if (window.electronAPI && window.electronAPI.updateThumbarPlayState) {
        window.electronAPI.updateThumbarPlayState(!isPaused);
    }

    if (playButton) {
        playButton.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
        playButton.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
        playButton.setAttribute('title', isPaused ? 'Play' : 'Pause');
    }

    updateSubheroPlayButton(!isPaused);

    document.querySelectorAll('.left-panel-cover-play-btn').forEach((btn) => {
        const btnViewId = btn.getAttribute('data-view');
        const currentPlayingViewId =
            currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]
                ? playbackQueue[currentQueueIndex].listId || 'all-songs'
                : null;
        const shouldPause = currentPlayingViewId && btnViewId === currentPlayingViewId && !isPaused;
        btn.classList.toggle('is-pause', shouldPause);
        btn.setAttribute('aria-label', shouldPause ? 'Pause' : 'Play');
    });

    refreshCurrentRowIndicator();
}

function resetProgressUI() {
    const progressBar = document.getElementById('progress-bar');
    const progressKnob = document.getElementById('progress-knob');
    if (progressBar) progressBar.style.width = '0%';
    if (progressKnob) progressKnob.style.left = '0%';
    if (currentTimeDisplay) currentTimeDisplay.textContent = '0:00';
}

function updateAudioProgress(audio) {
    if (audio !== audioElement || !audio.duration || !Number.isFinite(audio.duration)) return;

    const progress = Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100));
    const progressBar = document.getElementById('progress-bar');
    const progressKnob = document.getElementById('progress-knob');
    if (progressBar) progressBar.style.width = progress + '%';
    if (progressKnob) progressKnob.style.left = progress + '%';

    updateTimeDisplay();

    if (totalTimeDisplay.textContent === '0:00') {
        totalTimeDisplay.textContent = formatTime(audio.duration);
    }

    if (currentView === 'lyrics' && syncedLyricsState.entries) {
        updateSyncedLyricsHighlight(audio.currentTime);
    }

    if (typeof updateTrackLyricsHighlight === 'function') {
        updateTrackLyricsHighlight(audio.currentTime);
    }
}

function bindPlaybackAudioEvents(audio) {
    audio.ontimeupdate = () => updateAudioProgress(audio);
    audio.onloadedmetadata = () => {
        if (audio !== audioElement || !audio.duration || !Number.isFinite(audio.duration)) return;
        totalTimeDisplay.textContent = formatTime(audio.duration);
        updateAudioProgress(audio);
    };

    audio.onplay = () => {
        if (audio !== audioElement) return;

        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            lastPlayedSong = playbackQueue[currentQueueIndex];
            lastPlayedSongStartTime = Date.now();
        }

        syncPlayPauseButtons();
    };

    audio.onpause = () => {
        if (audio !== audioElement) return;

        cancelActiveAudioFade();

        syncPlayPauseButtons();
    };

    audio.onended = () => {
        if (audio !== audioElement) return;

        saveCurrentPlaybackState();

        if (repeatFunctionalityActive && repeatMode === 2) {
            if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
                saveToRecentlyPlayed(playbackQueue[currentQueueIndex]);
            }

            if (currentView === 'recent') {
                renderRecentlyPlayed();
            }

            const recentPanel = document.getElementById('recently-played-content');
            if (recentPanel && recentPanel.classList.contains('active')) {
                renderPortableRecentlyPlayed();
            }

            audioElement.currentTime = 0;
            audioElement.play();

            if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
                lastPlayedSong = playbackQueue[currentQueueIndex];
                lastPlayedSongStartTime = Date.now();
            }

            if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
                const currentItem = playbackQueue[currentQueueIndex];
                const song = currentItem.song || currentItem;
                const listId = currentItem.listId || lastPlaybackListId || 'all-songs';
                updatePlayingHighlight(song.id, listId, currentItem.ghostSlot ?? null);
                updateAlbumArt();
            }

            return;
        }

        const recentPanel = document.getElementById('recently-played-content');
        if (recentPanel && recentPanel.classList.contains('active')) {
            renderPortableRecentlyPlayed();
        }

        if (playbackQueue.length === 0) return;

        if (isShuffled) {
            if (currentQueueIndex < playbackQueue.length - 1) {
                playSongFromQueue(currentQueueIndex + 1);
            } else {
                const nextSong = getNextShuffledSong();

                if (nextSong) {
                    playbackQueue.push(nextSong);
                    playSongFromQueue(currentQueueIndex + 1);
                } else {
                    audioElement.pause();
                    audioElement.src = '';
                    clearGaplessPreload();

                    currentQueueIndex = -1;
                    resetProgressUI();
                    playButton.innerHTML = '<i class="fas fa-play"></i>';
                    updateSubheroPlayButton(isCurrentViewPlaying());
                    playButton.setAttribute('title', 'Play');
                }
            }
        } else {
            if (currentQueueIndex < playbackQueue.length - 1) {
                playSongFromQueue(currentQueueIndex + 1);
            } else if (currentQueueIndex === playbackQueue.length - 1 && repeatMode === 1) {
                playSongFromQueue(0);
            } else {
                audioElement.pause();
                audioElement.src = '';
                clearGaplessPreload();

                currentQueueIndex = -1;
                resetProgressUI();
                playButton.innerHTML = '<i class="fas fa-play"></i>';
                updateSubheroPlayButton(isCurrentViewPlaying());

                document.querySelector('.player-song-info').classList.remove('has-song');
                document.getElementById('player-title').textContent = 'No song selected';
                document.getElementById('player-artist').innerHTML = '—';

                const stoppingRow =
                    document.querySelector('#song-list .song-item.playing');

                if (stoppingRow) {
                    stoppingRow.classList.remove('playing');
                    stoppingRow.classList.remove('paused-song');
                    unpaintEqOnNumberCell(stoppingRow);
                }

                playbackHistoryStack = [];
                historyNavigationIndex = -1;

                const lyricsToggleBtnEl =
                    document.getElementById('lyrics-toggle-btn');

                if (lyricsToggleBtnEl) {
                    lyricsToggleBtnEl.disabled = true;
                    lyricsToggleBtnEl.setAttribute(
                        'data-original-title',
                        'Lyrics'
                    );
                    lyricsToggleBtnEl.classList.remove('active');
                }

                if (currentView === 'lyrics') {
                    const restoreView = (lyricsPreView && lyricsPreView !== 'lyrics') ? lyricsPreView : (lastPlaybackListId || currentView || 'all-songs');
                    const endedQueueItem = currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
                    const endedSong = endedQueueItem ? endedQueueItem.song || endedQueueItem : null;
                    const endedListId = endedQueueItem ? endedQueueItem.listId || restoreView : restoreView;
                    const endedSongIndex = endedSong && endedListId && endedListId !== 'all-songs'
                        ? getSongsForList(endedListId).findIndex((song) => song.id === endedSong.id)
                        : -1;

                    if (typeof teardownLyricsView === 'function') {
                        teardownLyricsView();
                    }

                    document.body.classList.remove('in-lyrics-view');
                    lyricsPreView = null;
                    lyricsPreScrollTop = 0;

                    if (endedSong && restoreView && restoreView !== 'lyrics' && restoreView !== 'all-songs' && endedSongIndex >= 0) {
                        switchToViewAndScroll(restoreView, endedSongIndex, endedSong.id, endedListId);
                    } else {
                        switchView(restoreView);
                    }
                }
            }
        }
    };
}

if (window.electronAPI && window.electronAPI.onThumbarPrev) {
    window.electronAPI.onThumbarPrev(() => {
        const prevBtn = document.getElementById('prev-btn');
        if (prevBtn) prevBtn.click();
    });
    window.electronAPI.onThumbarPlayPause(() => {
        playOrResumeCurrentView();
    });
    window.electronAPI.onThumbarNext(() => {
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.click();
    });
}

let isWindowMaximized = false;
let maximizeIconDebounce = null;

if (window.electronAPI && window.electronAPI.onWindowMaximize) {
    window.electronAPI.onWindowMaximize((isMax) => {
        if (maximizeIconDebounce) {
            clearTimeout(maximizeIconDebounce);
            maximizeIconDebounce = null;
        }
        maximizeIconDebounce = setTimeout(() => {
            maximizeIconDebounce = null;
            isWindowMaximized = isMax;
            if (typeof updateMaximizeIcon === 'function') {
                updateMaximizeIcon(isMax);
            }
        }, 80);
    });
    if (window.electronAPI.getWindowMaximized) {
        window.electronAPI.getWindowMaximized().then((isMax) => {
            isWindowMaximized = isMax;
            if (typeof updateMaximizeIcon === 'function') {
                updateMaximizeIcon(isMax);
            }
        });
    }
}

bindPlaybackAudioEvents(audioElement);
bindPlaybackAudioEvents(gaplessAudioElement);

