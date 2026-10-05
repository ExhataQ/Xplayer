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

// Classic scripts and inline handlers still call these by name; registered until the final flip.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        saveCurrentPlaybackState,
        shouldSaveToRecentlyPlayed
    });
}
