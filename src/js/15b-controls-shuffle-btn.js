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

