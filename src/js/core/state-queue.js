// ==============================================================================
// STATE QUEUE
// ==============================================================================
// Queue: what is queued and where playback is in it.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

export function setPlaybackQueue(value) {
    playbackQueue = value;
    emit('queue:changed', { queue: value });
}

export function setCurrentQueueIndex(value) {
    currentQueueIndex = value;
    emit('queue:indexChanged', { index: value });
}

export function setQueueDisplayLimit(value) {
    queueDisplayLimit = value;
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        setPlaybackQueue,
        setCurrentQueueIndex,
        setQueueDisplayLimit
    });
}
