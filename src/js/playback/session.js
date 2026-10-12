// ==============================================================================
// PLAYBACK SESSION SAVE
// ==============================================================================

// Records the song that was playing into history / recents when playback moves on.

export function saveCurrentPlaybackState() {
    if (lastPlayedSong) {
        const playDuration = Date.now() - lastPlayedSongStartTime;
        saveToPlayHistory(lastPlayedSong, playDuration);

        if (shouldSaveToRecentlyPlayed(lastPlayedSong)) {
            saveToRecentlyPlayed(lastPlayedSong);
        }

        const songData = lastPlayedSong.song || lastPlayedSong;
        if (songData.isTemp && songData.tempFilePath && desktopApi.supports('files.deleteFile')) {
            const filePath = songData.tempFilePath;
            setTimeout(() => {
                desktopApi.files.deleteFile(filePath);
            }, 1000);
        }

        setLastPlayedSong(null);
        setLastPlayedSongStartTime(0);
    }
}

export function shouldSaveToRecentlyPlayed(song) {
    if (!lastPlayedSong) {
        return false;
    }

    if (lastPlayedSong.id !== song.id) {
        return false;
    }

    const playTime = Date.now() - lastPlayedSongStartTime;
    return playTime >= MIN_PLAY_TIME_TO_SAVE * 1000;
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        saveCurrentPlaybackState,
        shouldSaveToRecentlyPlayed
    });
}
