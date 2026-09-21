// ==============================================================================
// TIME FORMATTING
// ==============================================================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function toggleTimeDisplay() {
    showRemainingTime = !showRemainingTime;
    updateTimeDisplay();
}

function updateTimeDisplay() {
    if (!audioElement.duration) return;

    if (showRemainingTime) {
        const remaining = audioElement.duration - audioElement.currentTime;
        currentTimeDisplay.textContent = '-' + formatTime(remaining);
    } else {
        currentTimeDisplay.textContent = formatTime(audioElement.currentTime);
    }
}

// ==============================================================================
// PLAYBACK CONTROL — PLAY BUTTON
// ==============================================================================
playButton.onclick = () => {
    temporarilySuppressTooltip(playButton);
    playOrResumeCurrentView();
};

// ==============================================================================
// SHUFFLE BUTTON
// ==============================================================================
function toggleNormalShuffle() {
    temporarilySuppressTooltip(shuffleButton);
    isShuffled = !isShuffled;
    shuffleButton.classList.toggle('active', isShuffled);
    updateSubheroShuffleButton();
    shuffleButton.setAttribute('aria-label', isShuffled ? 'Disable shuffle' : 'Enable shuffle');

    if (isShuffled) {
        if (repeatMode === 2) {
            shuffleButton.classList.add('active');
            shuffleButton.setAttribute('aria-label', 'Shuffle on (disabled in repeat one mode)');

            repeatFunctionalityActive = true;
            audioElement.loop = true;

            updateQueueDisplay();

            if (currentView === 'all-songs') {
                renderSongsList(SONGS_DATA, 'all-songs');
            } else if ((currentView === 'search' || currentView === 'search-items') && searchQuery) {
                const filteredSongs = getSearchResults(searchQuery);
                renderSongsList(filteredSongs, 'search-items');
            }
            return;
        }

        repeatVisualState = repeatMode;

        repeatButton.classList.toggle('active', repeatVisualState > 0);
        repeatOneIndicator.style.display = repeatVisualState === 2 ? 'block' : 'none';

        const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
        const currentLabel = labels[repeatVisualState] + ' (disabled in shuffle)';
        repeatButton.setAttribute('aria-label', currentLabel);

        audioElement.loop = false;

        const currentListSongs = getSongsForList(currentView);

        const currentSongId =
            currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]
                ? playbackQueue[currentQueueIndex].song
                    ? playbackQueue[currentQueueIndex].song.id
                    : playbackQueue[currentQueueIndex].id
                : null;

        let remainingSongs;
        let currentSongData = null;

        if (currentSongId !== null) {
            currentSongData = currentListSongs.find((s) => s.id === currentSongId);
            remainingSongs = currentListSongs.filter((s) => s.id !== currentSongId);
        } else {
            remainingSongs = [...currentListSongs];
        }

        if (currentSongData) {
            playbackQueue = [
                {
                    song: currentSongData,
                    listId: currentView,
                    ghostSlot: null
                }
            ];
            currentQueueIndex = 0;
            resetShuffle(currentListSongs, currentSongData.id, currentView);

            while (playbackQueue.length < 20) {
                const nextSong = getNextShuffledSong();
                if (!nextSong) break;
                playbackQueue.push(nextSong);
            }
        } else {
            resetShuffle(currentListSongs, null, currentView);
            playbackQueue = [];
            currentQueueIndex = -1;

            while (playbackQueue.length < 20) {
                const nextSong = getNextShuffledSong();
                if (!nextSong) break;
                playbackQueue.push(nextSong);
            }
        }

        updateQueueDisplay();
    } else {
        if (repeatMode === 2) {
            shuffleButton.classList.remove('active');
            shuffleButton.setAttribute('aria-label', 'Shuffle off');

            repeatFunctionalityActive = true;
            audioElement.loop = true;

            updateQueueDisplay();

            if (currentView === 'recent') {
                renderRecentlyPlayed();
            } else if (currentView === 'all-songs') {
                renderSongsList(SONGS_DATA, 'all-songs');
            } else if ((currentView === 'search' || currentView === 'search-items') && searchQuery) {
                const filteredSongs = getSearchResults(searchQuery);
                renderSongsList(filteredSongs, 'search-items');
            }
            return;
        }

        if (repeatVisualState > 0) {
            repeatMode = repeatVisualState;
            repeatButton.classList.toggle('active', repeatMode > 0);
            repeatOneIndicator.style.display = repeatMode === 2 ? 'block' : 'none';

            const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
            repeatButton.setAttribute('aria-label', labels[repeatMode]);

            audioElement.loop = repeatMode === 2;
        }

        const currentListSongs = getSongsForList(currentView);

        playbackQueue = currentListSongs.map((s, idx) => ({
            song: s,
            listId: currentView,
            ghostSlot: idx
        }));

        if (currentQueueIndex >= 0 && playbackQueue.length > 0) {
            const currentSong = document.getElementById('player-title').textContent;
            const currentArtist = document.getElementById('player-artist').textContent;

            const newIndex = playbackQueue.findIndex((item) => {
                const s = item.song || item;
                return s.title === currentSong && s.artist === currentArtist;
            });

            currentQueueIndex = newIndex !== -1 ? newIndex : 0;
        } else {
            currentQueueIndex = -1;
        }

        clearShuffle();
        updateQueueDisplay();
    }
}

function closeShuffleModeDialog() {
    const overlay = document.querySelector('.shuffle-mode-overlay');
    if (overlay) overlay.remove();
}

function selectShuffleMode(mode) {
    closeShuffleModeDialog();

    if (mode === 'off') {
        if (isShuffled) {
            shuffleMode = 'normal';
            toggleNormalShuffle();
        }
        return;
    }

    if (mode === 'normal') {
        if (isShuffled && shuffleMode === 'normal') {
            toggleNormalShuffle();
            return;
        }
        if (isShuffled) {
            isShuffled = false;
            clearShuffle();
        }
        shuffleMode = 'normal';
        toggleNormalShuffle();
        return;
    }

    if (isShuffled) {
        isShuffled = false;
        clearShuffle();
    }
    startSmartShuffleFromCurrentView();
}

function openShuffleModeDialog() {
    temporarilySuppressTooltip(shuffleButton);
    const { modal, overlay } = createModal('playlist-modal shuffle-mode-modal', 'playlist-modal-overlay shuffle-mode-overlay', closeShuffleModeDialog);
    modal.onclick = (event) => event.stopPropagation();
    const smartAvailable = getSongsForList(currentView).length > 50;

    modal.innerHTML = `
        <h3 class="playlist-modal-title">Shuffle mode</h3>
        <p style="color: var(--text-secondary); font-size: 13px; margin: 0 0 18px; line-height: 1.5;">Choose how this view should play.</p>
        <div style="display: grid; gap: 10px;">
            <button class="playlist-modal-create-btn" onclick="selectShuffleMode('normal')">Normal Shuffle</button>
            <button class="playlist-modal-create-btn" ${smartAvailable ? '' : 'disabled'} onclick="selectShuffleMode('smart')">Smart Shuffle v1${smartAvailable ? '' : ' — needs more than 50 songs'}</button>
            ${isShuffled ? '<button class="playlist-modal-cancel-btn" onclick="selectShuffleMode(\'off\')">Turn Shuffle Off</button>' : ''}
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

shuffleButton.onclick = openShuffleModeDialog;

// ==============================================================================
// REPEAT BUTTON
// ==============================================================================
repeatButton.onclick = () => {
    temporarilySuppressTooltip(repeatButton);
    saveCurrentPlaybackState();

    if (isShuffled) {
        const newVisualState = (repeatVisualState + 1) % 3;
        repeatVisualState = newVisualState;
        repeatMode = newVisualState;

        repeatButton.classList.toggle('active', repeatVisualState > 0);
        repeatOneIndicator.style.display = repeatVisualState === 2 ? 'block' : 'none';

        const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
        repeatButton.setAttribute(
            'aria-label',
            labels[repeatVisualState] + (repeatVisualState === 2 ? ' (shuffle disabled)' : ' (visual only)')
        );

        repeatFunctionalityActive = repeatVisualState === 2;
        audioElement.loop = repeatFunctionalityActive;

        if (repeatVisualState !== 2) {
            if (isShuffled) {
                shuffleButton.setAttribute('aria-label', 'Shuffle on');

                if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
                    const currentItem = playbackQueue[currentQueueIndex];
                    const currentSong = currentItem.song || currentItem;
                    const songList = getSongsForList(currentView);

                    playbackQueue = [
                        {
                            song: currentSong,
                            listId: currentView,
                            ghostSlot: null
                        }
                    ];
                    currentQueueIndex = 0;
                    resetShuffle(songList, currentSong.id, currentView);

                    while (playbackQueue.length < 20) {
                        const nextSong = getNextShuffledSong();
                        if (!nextSong) break;
                        playbackQueue.push(nextSong);
                    }
                }
            }
        }

        updateQueueDisplay();

        if (currentView === 'recent') {
            renderRecentlyPlayed();
        } else if (currentView === 'all-songs') {
            renderSongsList(SONGS_DATA);
        } else if ((currentView === 'search' || currentView === 'search-items') && searchQuery) {
            const filteredSongs = getSearchResults(searchQuery);
            renderSongsList(filteredSongs, 'search-items');
        }
        return;
    }

    repeatMode = (repeatMode + 1) % 3;
    repeatVisualState = repeatMode;

    repeatButton.classList.toggle('active', repeatMode > 0);
    repeatOneIndicator.style.display = repeatMode === 2 ? 'block' : 'none';

    const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
    repeatButton.setAttribute('aria-label', labels[repeatMode]);

    repeatFunctionalityActive = repeatMode > 0;
    audioElement.loop = repeatMode === 2;

    if (repeatMode !== 2 && !isShuffled) {
        if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
            const currentSong = playbackQueue[currentQueueIndex];

            const songList = getSongsForList(currentView);

            const newIndex = songList.findIndex((s) => s.id === currentSong.id);
            if (newIndex !== -1) {
                playbackQueue = [...songList];
                currentQueueIndex = newIndex;
            }
        }
        clearShuffle();
    }

    updateQueueDisplay();
};

// ==============================================================================
// TRACK NAVIGATION — NEXT / PREV
// ==============================================================================
document.getElementById('next-btn').onclick = () => {
    temporarilySuppressTooltip(document.getElementById('next-btn'));
    if (playbackQueue.length === 0) return;

    saveCurrentPlaybackState();

    if (repeatFunctionalityActive && repeatMode === 2 && currentQueueIndex >= 0) {
        if (lastPlayedSong && shouldSaveToRecentlyPlayed(lastPlayedSong)) {
            saveToRecentlyPlayed(lastPlayedSong);
        }

        if (currentView === 'recent') {
            renderRecentlyPlayed();
        }

        audioElement.currentTime = 0;
        audioElement.play();

        if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
            lastPlayedSong = playbackQueue[currentQueueIndex];
            lastPlayedSongStartTime = Date.now();
        }
        return;
    }

    if (isShuffled) {
        if (!(repeatFunctionalityActive && repeatMode === 2)) {
            if (currentQueueIndex < playbackQueue.length - 1) {
                isManualPlay = false;
                playSongFromQueue(currentQueueIndex + 1);
            } else {
                const nextSong = getNextShuffledSong();
                if (nextSong) {
                    playbackQueue.push(nextSong);
                    isManualPlay = false;
                    playSongFromQueue(currentQueueIndex + 1);
                }
            }
        }
        return;
    } else {
        if (currentQueueIndex === -1) {
            isManualPlay = false;
            playSongFromQueue(0);
        } else if (currentQueueIndex < playbackQueue.length - 1) {
            isManualPlay = false;
            playSongFromQueue(currentQueueIndex + 1);
        } else if (currentQueueIndex === playbackQueue.length - 1 && repeatMode === 1) {
            isManualPlay = false;
            playSongFromQueue(0);
        }
    }
};

let prevRestartTimeout = null;

document.getElementById('prev-btn').onclick = () => {
    temporarilySuppressTooltip(document.getElementById('prev-btn'));
    if (playbackQueue.length === 0) return;

    const PREV_RESTART_THRESHOLD = 3;

    if (currentQueueIndex >= 0 && audioElement.currentTime > PREV_RESTART_THRESHOLD) {
        if (prevRestartTimeout) {
            clearTimeout(prevRestartTimeout);
        }

        audioElement.currentTime = 0;
        audioElement.pause();

        prevRestartTimeout = setTimeout(() => {
            audioElement.play();
            prevRestartTimeout = null;

            if (lastPlayedSong) {
                lastPlayedSongStartTime = Date.now();
            }
        }, 500);

        return;
    }

    saveCurrentPlaybackState();

    let prevIndex = currentQueueIndex - 1;

    if (prevIndex >= 0) {
        playSongFromQueue(prevIndex);
    } else if (repeatMode === 1) {
        playSongFromQueue(playbackQueue.length - 1);
    }
};

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
    const clickedSong = SONGS_DATA.find((s) => s.id === songId);
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
            audioElement.pause();
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

        if (getAudioPlaybackSettings().fadeOutEnabled && !audioElement.ended) {
            startFadeOut(
                (Number(getAudioPlaybackSettings().fadeOutDuration) || 1.25) * 1000,
                () => {
                    if (audio === audioElement) {
                        audioElement.volume = 0;
                    }
                }
            );
        }

        syncPlayPauseButtons();
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

audioElement.onended = () => {
    if (audioElement !== audioElement) return;

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

// ==============================================================================
// PROGRESS BAR SEEKING
// ==============================================================================
let isSeeking = false;

const progressContainer = document.querySelector('.progress-container');
if (progressContainer) {
    progressContainer.addEventListener('mouseenter', showProgressTooltip);
    progressContainer.addEventListener('mouseleave', hideProgressTooltip);
}
let seekAnimationId = null;

function startSeek(e) {
    if (!audioElement.duration) return;

    isSeeking = true;
    wasPlaying = !audioElement.paused;

    if (wasPlaying) {
        audioElement.pause();
    }

    window.originalTimeUpdate = audioElement.ontimeupdate;
    audioElement.ontimeupdate = null;

    e.currentTarget.classList.add('dragging');
    document.body.classList.add('dragging-progress');
    document.body.classList.add('no-select');

    updateSeekPosition(e.clientX);
    updateProgressTooltip(e);

    document.addEventListener('mousemove', doSeekGlobal);
    document.addEventListener('mouseup', stopSeekGlobal);
}

function doSeekGlobal(e) {
    if (!isSeeking) return;

    if (seekAnimationId) {
        cancelAnimationFrame(seekAnimationId);
    }

    seekAnimationId = requestAnimationFrame(() => {
        updateSeekPosition(e.clientX);
        updateProgressTooltip(e);
    });
}

function stopSeekGlobal() {
    isSeeking = false;

    if (seekAnimationId) {
        cancelAnimationFrame(seekAnimationId);
        seekAnimationId = null;
    }

    if (progressTooltip) {
        progressTooltip.remove();
        progressTooltip = null;
    }

    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
        progressContainer.classList.remove('dragging');
    }
    document.body.classList.remove('dragging-progress');
    document.body.classList.remove('no-select');

    document.removeEventListener('mousemove', doSeekGlobal);
    document.removeEventListener('mouseup', stopSeekGlobal);

    if (window.originalTimeUpdate) {
        audioElement.ontimeupdate = window.originalTimeUpdate;
        window.originalTimeUpdate = null;
    }

    if (wasPlaying) {
        audioElement.play().catch((e) => {});
    }
    wasPlaying = false;
}

function updateSeekPosition(clientX) {
    if (!audioElement.duration) return;

    const progressContainer = document.querySelector('.progress-container');
    if (!progressContainer) return;

    const rect = progressContainer.getBoundingClientRect();
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    const progress = x / rect.width;

    audioElement.currentTime = progress * audioElement.duration;

    const progressPercent = progress * 100 + '%';
    document.getElementById('progress-bar').style.width = progressPercent;
    document.getElementById('progress-knob').style.left = progressPercent;

    updateTimeDisplay();
}

let progressTooltip = null;

function createProgressTooltip() {
    const el = document.createElement('div');
    el.className = 'custom-tooltip progress-tooltip';
    return el;
}

function updateProgressTooltip(e) {
    const progressContainer = document.querySelector('.progress-container');
    if (!progressContainer) return;

    const rect = progressContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    const progress = x / rect.width;
    const time = audioElement.duration ? progress * audioElement.duration : 0;

    if (!progressTooltip) {
        progressTooltip = createProgressTooltip();
        document.body.appendChild(progressTooltip);
    }

    progressTooltip.textContent = formatTime(time);

    let left = rect.left + x;
    let top = rect.top - 2;

    const tooltipRect = progressTooltip.getBoundingClientRect();

    if (left < rect.left) {
        left = rect.left;
    }
    if (left > rect.right) {
        left = rect.right;
    }
    if (top - tooltipRect.height < 6) {
        top = rect.bottom + 6;
        progressTooltip.style.transform = 'translate(-50%, 0)';
    } else {
        progressTooltip.style.transform = 'translate(-50%, -100%)';
    }

    progressTooltip.style.left = left + 'px';
    progressTooltip.style.top = top + 'px';
}

function showProgressTooltip() {
    const progressContainer = document.querySelector('.progress-container');
    if (!progressContainer) return;
    progressContainer.addEventListener('mousemove', updateProgressTooltip);
}

function hideProgressTooltip() {
    if (isSeeking) return;
    if (progressTooltip) {
        progressTooltip.remove();
        progressTooltip = null;
    }
}

// ==============================================================================
// VOLUME / GAIN / FADE HELPERS
// ==============================================================================
let activeAudioFadeFrame = null;
let pendingCrossfadeTimer = null;

function clampVolume(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function getReplayGainMultiplier(song) {
    const settings = getAudioPlaybackSettings();
    if (!settings.replayGainEnabled || !song) return 1;

    const gainKey = settings.replayGainMode === 'album'
        ? 'replayGainAlbum'
        : 'replayGainTrack';
    const rawGainValue = song[gainKey] ?? song[`${gainKey}Gain`] ?? song[`${gainKey}Db`] ?? 0;
    const gainValue = typeof rawGainValue === 'string' ? parseFloat(rawGainValue) : Number(rawGainValue);

    if (!Number.isFinite(gainValue)) {
        return 1;
    }

    const adjustedGain = gainValue + Number(settings.replayGainTrimDb || 0);
    let gain = Math.pow(10, adjustedGain / 20);
    if (settings.replayGainLimiter) {
        gain = Math.min(gain, 1.6);
    }

    return clampVolume(gain);
}

function getTargetTrackVolume(song) {
    const baseVolume = Number.isFinite(window.lastVolume) ? window.lastVolume : 0.5;
    const baseLevel = clampVolume(baseVolume || 0.5);
    const gainMultiplier = getReplayGainMultiplier(song);
    return clampVolume(baseLevel * gainMultiplier);
}

function applyTrackVolume(song) {
    const targetVolume = getTargetTrackVolume(song);
    if (audioElement.paused && !audioElement.src) {
        audioElement.volume = targetVolume;
        return;
    }

    if (audioElement.volume === 0 && Number(window.lastVolume || 0) === 0) {
        audioElement.volume = 0;
        return;
    }

    audioElement.volume = targetVolume;
}

function animateAudioVolume(from, to, durationMs, onComplete) {
    if (activeAudioFadeFrame) {
        cancelAnimationFrame(activeAudioFadeFrame);
        activeAudioFadeFrame = null;
    }

    const start = performance.now();
    const duration = Math.max(60, Number(durationMs) || 0);
    const startVolume = clampVolume(from);
    const endVolume = clampVolume(to);

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        audioElement.volume = clampVolume(startVolume + (endVolume - startVolume) * eased);

        if (progress < 1) {
            activeAudioFadeFrame = requestAnimationFrame(step);
        } else {
            audioElement.volume = endVolume;
            activeAudioFadeFrame = null;
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    }

    activeAudioFadeFrame = requestAnimationFrame(step);
}

function startFadeIn(song, durationMs) {
    const settings = getAudioPlaybackSettings();
    const target = getTargetTrackVolume(song);
    const duration = settings.fadeInEnabled ? Math.max(80, durationMs || settings.fadeInDuration * 1000) : 0;

    if (!settings.fadeInEnabled || duration <= 0) {
        audioElement.volume = target;
        return;
    }

    audioElement.volume = 0;
    animateAudioVolume(0, target, duration);
}

function startFadeOut(durationMs, onComplete) {
    const settings = getAudioPlaybackSettings();
    const duration = settings.fadeOutEnabled ? Math.max(80, durationMs || settings.fadeOutDuration * 1000) : 0;

    if (!settings.fadeOutEnabled || duration <= 0) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    const currentVolume = clampVolume(audioElement.volume);
    animateAudioVolume(currentVolume, 0, duration, onComplete);
}

function scheduleCrossfadeTransition(song) {
    const settings = getAudioPlaybackSettings();

    if (!settings.crossfadeEnabled || !audioElement.src || audioElement.paused || !song) {
        return false;
    }

    const fadeMs = Math.max(150, (Number(settings.crossfadeDuration) || 4) * 1000);
    const currentVolume = clampVolume(audioElement.volume);

    if (pendingCrossfadeTimer) {
        clearTimeout(pendingCrossfadeTimer);
        pendingCrossfadeTimer = null;
    }

    startFadeOut(fadeMs);

    pendingCrossfadeTimer = setTimeout(() => {
        audioElement.src = song.url;
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});

        const nextVolume = getTargetTrackVolume(song);
        audioElement.volume = 0;
        animateAudioVolume(0, nextVolume, fadeMs, () => {
            if (!audioElement.paused) {
                audioElement.play().catch(() => {});
            }
        });

        pendingCrossfadeTimer = null;
    }, Math.max(120, fadeMs * 0.6));

    return true;
}

function setVolume(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const progress = (e.clientX - rect.left) / rect.width;
    updateVolume(progress);
}

function updateVolume(percentage) {
    const volume = Math.max(0, Math.min(1, percentage));
    window.lastVolume = volume;

    const currentSong = getCurrentSongForInfo();
    const targetVolume = currentSong ? getTargetTrackVolume(currentSong) : volume;
    audioElement.volume = targetVolume;

    const volumePercent = volume * 100 + '%';
    document.getElementById('volume-fill').style.width = volumePercent;
    document.getElementById('volume-knob').style.left = volumePercent;

    const icon = document.getElementById('volume-icon');
    if (volume === 0) {
        icon.innerHTML = '<i class="fas fa-volume-mute"></i>';
        icon.setAttribute('aria-label', 'Unmute');
        icon.setAttribute('title', 'Unmute');
    } else {
        icon.innerHTML = '<i class="fas fa-volume-up"></i>';
        icon.setAttribute('aria-label', 'Mute');
        icon.setAttribute('title', 'Mute');
    }
}

function toggleMute() {
    const currentVolume = Number(window.lastVolume ?? audioElement.volume ?? 0.5);
    if (currentVolume > 0) {
        window.lastVolume = currentVolume;
        audioElement.volume = 0;
        updateVolume(0);
    } else {
        const restoreVolume = window.lastVolume || 0.5;
        audioElement.volume = restoreVolume;
        updateVolume(restoreVolume);
    }
}

const volumeSlider = document.getElementById('volume-slider');
let isDraggingVolume = false;

volumeSlider.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    document.body.classList.add('no-select');
    volumeSlider.classList.add('dragging');

    const rect = volumeSlider.getBoundingClientRect();
    const progress = (e.clientX - rect.left) / rect.width;
    updateVolume(progress);
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) {
        const rect = volumeSlider.getBoundingClientRect();
        const progress = (e.clientX - rect.left) / rect.width;
        updateVolume(progress);
    }
});

document.addEventListener('mouseup', () => {
    if (isDraggingVolume) {
        document.body.classList.remove('no-select');
        volumeSlider.classList.remove('dragging');
    }
    isDraggingVolume = false;
});
