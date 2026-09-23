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

