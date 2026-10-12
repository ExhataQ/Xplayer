// ==============================================================================
// STATE NOW PLAYING
// ==============================================================================
// What is playing now, how it started, and the audio elements.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

export function setLastPlayedSong(value) {
    lastPlayedSong = value;
}

export function setLastPlayedSongStartTime(value) {
    lastPlayedSongStartTime = value;
}

export function setIsManualPlay(value) {
    isManualPlay = value;
}

export function setIsPrevNavigation(value) {
    isPrevNavigation = value;
}

export function setLastPlaybackListId(value) {
    lastPlaybackListId = value;
}

export function setWasPlaying(value) {
    wasPlaying = value;
}

export function setShowRemainingTime(value) {
    showRemainingTime = value;
}

export function setAudioElement(value) {
    audioElement = value;
}

export function setGaplessAudioElement(value) {
    gaplessAudioElement = value;
}

export function setGaplessActiveElement(value) {
    gaplessActiveElement = value;
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        setLastPlayedSong,
        setLastPlayedSongStartTime,
        setIsManualPlay,
        setIsPrevNavigation,
        setLastPlaybackListId,
        setWasPlaying,
        setShowRemainingTime,
        setAudioElement,
        setGaplessAudioElement,
        setGaplessActiveElement
    });
}
