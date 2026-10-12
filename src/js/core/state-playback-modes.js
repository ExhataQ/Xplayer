// ==============================================================================
// STATE PLAYBACK MODES
// ==============================================================================
// Shuffle, smart shuffle and repeat modes.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

export function setIsShuffled(value) {
    isShuffled = value;
}

export function setShuffleMode(value) {
    shuffleMode = value;
}

export function setRepeatMode(value) {
    repeatMode = value;
}

export function setRepeatFunctionalityActive(value) {
    repeatFunctionalityActive = value;
}

export function setRepeatVisualState(value) {
    repeatVisualState = value;
}

export function setSmartShuffleSourceId(value) {
    smartShuffleSourceId = value;
}

export function setSmartShufflePreviousSong(value) {
    smartShufflePreviousSong = value;
}

export function setSmartShuffleJourney(value) {
    smartShuffleJourney = value;
}

export function setSmartShuffleJourneyIndex(value) {
    smartShuffleJourneyIndex = value;
}

export function setShuffleIndex(value) {
    shuffleIndex = value;
}

export function setShuffleOrder(value) {
    shuffleOrder = value;
}

export function setShuffleSourceId(value) {
    shuffleSourceId = value;
}

// Names other files call or read by name (inline handlers, other modules).
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        setIsShuffled,
        setShuffleMode,
        setRepeatMode,
        setRepeatFunctionalityActive,
        setRepeatVisualState,
        setSmartShuffleSourceId,
        setSmartShufflePreviousSong,
        setSmartShuffleJourney,
        setSmartShuffleJourneyIndex,
        setShuffleIndex
    });
}
