// ==============================================================================
// PLAYBACK SESSION SAVE
// ==============================================================================

// Records the song that was playing into history / recents when playback moves on.

function saveCurrentPlaybackState() {
    if (lastPlayedSong) {
        const playDuration = Date.now() - lastPlayedSongStartTime;
        saveToPlayHistory(lastPlayedSong, playDuration);

        if (shouldSaveToRecentlyPlayed(lastPlayedSong)) {
            saveToRecentlyPlayed(lastPlayedSong);
        }

        const songData = lastPlayedSong.song || lastPlayedSong;
        if (songData.isTemp && songData.tempFilePath && window.electronAPI && window.electronAPI.deleteFile) {
            const filePath = songData.tempFilePath;
            setTimeout(() => {
                window.electronAPI.deleteFile(filePath);
            }, 1000);
        }

        setLastPlayedSong(null);
        setLastPlayedSongStartTime(0);
    }
}

function shouldSaveToRecentlyPlayed(song) {
    if (!lastPlayedSong) {
        return false;
    }

    if (lastPlayedSong.id !== song.id) {
        return false;
    }

    const playTime = Date.now() - lastPlayedSongStartTime;
    return playTime >= MIN_PLAY_TIME_TO_SAVE * 1000;
}
