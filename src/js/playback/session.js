// ==============================================================================
// PLAYBACK SESSION SAVE
// ==============================================================================

// Records the song that was playing into history / recents when playback moves on, and keeps the song that is current (with its
// position) so the next start of the app shows it again, paused, in the player bar.

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

// ---- the song that was playing when the app was closed ---------------------------------------------------------------------------
// Written about every two seconds while something changes (the id, its list, the position), and when the window closes. Read once at
// start-up. It is never written for a song that is not in the library (a file opened from outside, a stream), so the last library
// song stays remembered after one of those.

const LAST_SONG_CHECK_MS = 2000;
let lastSongWritten = '';

function currentLastSong() {
    const item = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
    const song = item && (item.song || item);
    if (!song || song.isTemp || !getSongById(song.id)) return null;
    if (audioElement.readyState < 1) return null; // the file is not loaded yet: its position is not known (a restored song still loading)
    return { id: song.id, listId: (item.listId || lastPlaybackListId || '') + '', position: Math.round((audioElement.currentTime || 0) * 10) / 10 };
}

export function saveLastSong() {
    const now = currentLastSong();
    if (!now) return;
    const key = now.id + '|' + now.listId + '|' + Math.floor(now.position);
    if (key === lastSongWritten) return;
    if (storageWriteJson(STORAGE_KEYS.LAST_SONG, now)) lastSongWritten = key;
}

// Puts the saved song back as the current one, paused. Does nothing when there is none, it left the library, or something already plays.
export function restoreLastSong() {
    const saved = storageReadJson(STORAGE_KEYS.LAST_SONG, null, normalizeLastSong);
    if (!saved || !getSongById(saved.id) || audioElement.src || currentQueueIndex >= 0) return false;
    const lists = [saved.listId, VIEWS.ALL_SONGS].filter((id, i, all) => id && all.indexOf(id) === i); // the list may be gone: then all songs
    for (const listId of lists) {
        try {
            if (startSongPaused(saved.id, listId, saved.position)) return true;
        } catch (error) {
            console.warn('[session] could not restore the last song:', error);
        }
    }
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    restoreLastSong();
    setInterval(saveLastSong, LAST_SONG_CHECK_MS);
});
window.addEventListener('pagehide', saveLastSong);

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        saveCurrentPlaybackState,
        shouldSaveToRecentlyPlayed,
        saveLastSong,
        restoreLastSong
    });
}
