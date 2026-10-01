// ==============================================================================
// STATE PLAYBACK MODES
// ==============================================================================
// Shuffle, smart shuffle and repeat modes.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

function setIsShuffled(value) {
    isShuffled = value;
}

function setShuffleMode(value) {
    shuffleMode = value;
}

function setRepeatMode(value) {
    repeatMode = value;
}

function setRepeatFunctionalityActive(value) {
    repeatFunctionalityActive = value;
}

function setRepeatVisualState(value) {
    repeatVisualState = value;
}

function setSmartShuffleSourceId(value) {
    smartShuffleSourceId = value;
}

function setSmartShufflePreviousSong(value) {
    smartShufflePreviousSong = value;
}

function setSmartShuffleJourney(value) {
    smartShuffleJourney = value;
}

function setSmartShuffleJourneyIndex(value) {
    smartShuffleJourneyIndex = value;
}

function setShuffleIndex(value) {
    shuffleIndex = value;
}
