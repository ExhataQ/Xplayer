// ==============================================================================
// STATE NOW PLAYING
// ==============================================================================
// What is playing now, how it started, and the audio elements.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

function setLastPlayedSong(value) {
    lastPlayedSong = value;
}

function setLastPlayedSongStartTime(value) {
    lastPlayedSongStartTime = value;
}

function setIsManualPlay(value) {
    isManualPlay = value;
}

function setIsPrevNavigation(value) {
    isPrevNavigation = value;
}

function setLastPlaybackListId(value) {
    lastPlaybackListId = value;
}

function setWasPlaying(value) {
    wasPlaying = value;
}

function setShowRemainingTime(value) {
    showRemainingTime = value;
}

function setAudioElement(value) {
    audioElement = value;
}

function setGaplessAudioElement(value) {
    gaplessAudioElement = value;
}

function setGaplessActiveElement(value) {
    gaplessActiveElement = value;
}
