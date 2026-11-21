// ==============================================================================
// TIME FORMATTING
// ==============================================================================
import { formatTime } from '../core/format-time.js';
export { formatTime };

export function toggleTimeDisplay() {
    setShowRemainingTime(!showRemainingTime);
    updateTimeDisplay();
}

export function updateTimeDisplay() {
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

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        formatTime,
        toggleTimeDisplay,
        updateTimeDisplay
    });
}
