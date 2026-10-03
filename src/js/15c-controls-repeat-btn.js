// ==============================================================================
// REPEAT BUTTON
// ==============================================================================
repeatButton.onclick = () => {
    temporarilySuppressTooltip(repeatButton);
    saveCurrentPlaybackState();

    if (isShuffled) {
        const newVisualState = (repeatVisualState + 1) % 3;
        setRepeatVisualState(newVisualState);
        setRepeatMode(newVisualState);

        repeatButton.classList.toggle('active', repeatVisualState > 0);
        repeatOneIndicator.style.display = repeatVisualState === 2 ? 'block' : 'none';

        const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
        repeatButton.setAttribute(
            'aria-label',
            labels[repeatVisualState] + (repeatVisualState === 2 ? ' (shuffle disabled)' : ' (visual only)')
        );

        setRepeatFunctionalityActive(repeatVisualState === 2);
        audioElement.loop = repeatFunctionalityActive;

        if (repeatVisualState !== 2) {
            if (isShuffled) {
                shuffleButton.setAttribute('aria-label', 'Shuffle on');

                if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
                    const currentItem = playbackQueue[currentQueueIndex];
                    const currentSong = currentItem.song || currentItem;
                    const songList = getSongsForList(currentView);

                    setPlaybackQueue([
                        {
                            song: currentSong,
                            listId: currentView,
                            ghostSlot: null
                        }
                    ]);
                    setCurrentQueueIndex(0);
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

        emit('repeat:listChanged');
        return;
    }

    setRepeatMode((repeatMode + 1) % 3);
    setRepeatVisualState(repeatMode);

    repeatButton.classList.toggle('active', repeatMode > 0);
    repeatOneIndicator.style.display = repeatMode === 2 ? 'block' : 'none';

    const labels = ['Repeat off', 'Repeat all', 'Repeat one'];
    repeatButton.setAttribute('aria-label', labels[repeatMode]);

    setRepeatFunctionalityActive(repeatMode > 0);
    audioElement.loop = repeatMode === 2;

    if (repeatMode !== 2 && !isShuffled) {
        if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
            const currentSong = playbackQueue[currentQueueIndex];

            const songList = getSongsForList(currentView);

            const newIndex = songList.findIndex((s) => s.id === currentSong.id);
            if (newIndex !== -1) {
                setPlaybackQueue([...songList]);
                setCurrentQueueIndex(newIndex);
            }
        }
        clearShuffle();
    }

    updateQueueDisplay();
};

