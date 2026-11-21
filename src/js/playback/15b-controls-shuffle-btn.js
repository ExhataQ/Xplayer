// ==============================================================================
// SHUFFLE BUTTON
// ==============================================================================
export function toggleNormalShuffle() {
    temporarilySuppressTooltip(shuffleButton);
    setIsShuffled(!isShuffled);
    shuffleButton.classList.toggle('active', isShuffled);
    emit('shuffle:changed', { isShuffled });
    shuffleButton.setAttribute('aria-label', isShuffled ? 'Disable shuffle' : 'Enable shuffle');

    if (isShuffled) {
        if (repeatMode === 2) {
            shuffleButton.classList.add('active');
            shuffleButton.setAttribute('aria-label', 'Shuffle on (disabled in repeat one mode)');

            setRepeatFunctionalityActive(true);
            audioElement.loop = true;

            updateQueueDisplay();

            emit('shuffle:listChanged', { isShuffled });
            return;
        }

        setRepeatVisualState(repeatMode);

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

        let currentSongData = null;

        if (currentSongId !== null) {
            currentSongData = currentListSongs.find((s) => s.id === currentSongId);
        }

        if (currentSongData) {
            setPlaybackQueue([
                {
                    song: currentSongData,
                    listId: currentView,
                    ghostSlot: null
                }
            ]);
            setCurrentQueueIndex(0);
            resetShuffle(currentListSongs, currentSongData.id, currentView);
        } else {
            resetShuffle(currentListSongs, null, currentView);
            setPlaybackQueue([]);
            setCurrentQueueIndex(-1);
        }

        while (playbackQueue.length < 20) {
            const nextSong = getNextShuffledSong();
            if (!nextSong) break;
            playbackQueue.push(nextSong);
        }

        updateQueueDisplay();
    } else {
        if (repeatMode === 2) {
            shuffleButton.classList.remove('active');
            shuffleButton.setAttribute('aria-label', 'Shuffle off');

            setRepeatFunctionalityActive(true);
            audioElement.loop = true;

            updateQueueDisplay();

            emit('shuffle:listChanged', { isShuffled });
            return;
        }

        if (repeatVisualState > 0) {
            setRepeatMode(repeatVisualState);
            repeatButton.classList.toggle('active', repeatMode > 0);
            repeatOneIndicator.style.display = repeatMode === 2 ? 'block' : 'none';

            const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
            repeatButton.setAttribute('aria-label', labels[repeatMode]);

            audioElement.loop = repeatMode === 2;
        }

        const currentListSongs = getSongsForList(currentView);

        setPlaybackQueue(currentListSongs.map((s, idx) => ({
            song: s,
            listId: currentView,
            ghostSlot: idx
        })));

        if (currentQueueIndex >= 0 && playbackQueue.length > 0) {
            const currentSong = document.getElementById('player-title').textContent;
            const currentArtist = document.getElementById('player-artist').textContent;

            const newIndex = playbackQueue.findIndex((item) => {
                const s = item.song || item;
                return s.title === currentSong && s.artist === currentArtist;
            });

            setCurrentQueueIndex(newIndex !== -1 ? newIndex : 0);
        } else {
            setCurrentQueueIndex(-1);
        }

        clearShuffle();
        updateQueueDisplay();
    }
}

export function selectShuffleMode(mode) {
    if (mode === 'off') {
        if (isShuffled) {
            setShuffleMode('normal');
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
            setIsShuffled(false);
            clearShuffle();
        }
        setShuffleMode('normal');
        toggleNormalShuffle();
        return;
    }

    if (isShuffled) {
        setIsShuffled(false);
        clearShuffle();
    }
    startSmartShuffleFromCurrentView();
}

registerActions({ selectShuffleMode });

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        toggleNormalShuffle,
        selectShuffleMode // the shuffle menu of the interface picks a mode through it
    });
}
