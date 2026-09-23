// ==============================================================================
// TIME FORMATTING
// ==============================================================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function toggleTimeDisplay() {
    showRemainingTime = !showRemainingTime;
    updateTimeDisplay();
}

function updateTimeDisplay() {
    if (!audioElement.duration) return;

    if (showRemainingTime) {
        const remaining = audioElement.duration - audioElement.currentTime;
        currentTimeDisplay.textContent = '-' + formatTime(remaining);
    } else {
        currentTimeDisplay.textContent = formatTime(audioElement.currentTime);
    }
}

// ==============================================================================
// PLAYBACK CONTROL — PLAY BUTTON
// ==============================================================================
playButton.onclick = () => {
    temporarilySuppressTooltip(playButton);
    playOrResumeCurrentView();
};

