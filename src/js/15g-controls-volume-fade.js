// ==============================================================================
// VOLUME / GAIN / FADE HELPERS
// ==============================================================================
let activeAudioFadeFrame = null;
let pendingCrossfadeTimer = null;

function cancelActiveAudioFade() {
    if (!activeAudioFadeFrame) return;
    cancelAnimationFrame(activeAudioFadeFrame);
    activeAudioFadeFrame = null;
}

function clampVolume(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function getReplayGainMultiplier(song) {
    const settings = getAudioPlaybackSettings();
    if (!settings.replayGainEnabled || !song) return 1;

    const gainKey = settings.replayGainMode === 'album'
        ? 'replayGainAlbum'
        : 'replayGainTrack';
    const rawGainValue = song[gainKey] ?? song[`${gainKey}Gain`] ?? song[`${gainKey}Db`] ?? 0;
    const gainValue = typeof rawGainValue === 'string' ? parseFloat(rawGainValue) : Number(rawGainValue);

    if (!Number.isFinite(gainValue)) {
        return 1;
    }

    const adjustedGain = gainValue + Number(settings.replayGainTrimDb || 0);
    let gain = Math.pow(10, adjustedGain / 20);
    if (settings.replayGainLimiter) {
        gain = Math.min(gain, 1.6);
    }

    return clampVolume(gain);
}

function getTargetTrackVolume(song) {
    const baseVolume = Number.isFinite(window.lastVolume) ? window.lastVolume : 0.5;
    const baseLevel = clampVolume(baseVolume || 0.5);
    const gainMultiplier = getReplayGainMultiplier(song);
    return clampVolume(baseLevel * gainMultiplier);
}

function applyTrackVolume(song) {
    const userVolume = Number.isFinite(window.lastVolume) ? window.lastVolume : 0.5;
    if (userVolume <= 0) {
        audioElement.volume = 0;
        audioElement.muted = true;
        return;
    }
    audioElement.muted = false;
    audioElement.volume = getTargetTrackVolume(song);
}

function animateAudioVolume(from, to, durationMs, onComplete) {
    if (activeAudioFadeFrame) {
        cancelAnimationFrame(activeAudioFadeFrame);
        activeAudioFadeFrame = null;
    }

    const start = performance.now();
    const duration = Math.max(60, Number(durationMs) || 0);
    const startVolume = clampVolume(from);
    const endVolume = clampVolume(to);

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        audioElement.volume = clampVolume(startVolume + (endVolume - startVolume) * eased);

        if (progress < 1) {
            activeAudioFadeFrame = requestAnimationFrame(step);
        } else {
            audioElement.volume = endVolume;
            activeAudioFadeFrame = null;
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    }

    activeAudioFadeFrame = requestAnimationFrame(step);
}

function startFadeIn(song, durationMs) {
    const settings = getAudioPlaybackSettings();
    const target = getTargetTrackVolume(song);
    const duration = settings.fadeInEnabled ? Math.max(80, durationMs || settings.fadeInDuration * 1000) : 0;

    if (!settings.fadeInEnabled || duration <= 0) {
        audioElement.volume = target;
        return;
    }

    audioElement.volume = 0;
    animateAudioVolume(0, target, duration);
}

function startFadeOut(durationMs, onComplete) {
    const settings = getAudioPlaybackSettings();
    const duration = settings.fadeOutEnabled ? Math.max(80, durationMs || settings.fadeOutDuration * 1000) : 0;

    if (!settings.fadeOutEnabled || duration <= 0) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    const currentVolume = clampVolume(audioElement.volume);
    animateAudioVolume(currentVolume, 0, duration, onComplete);
}

function pausePlaybackWithFade() {
    if (!audioElement || audioElement.paused) return;

    const settings = getAudioPlaybackSettings();
    const fadingAudio = audioElement;
    const currentSong = typeof getCurrentSongForInfo === 'function' ? getCurrentSongForInfo() : null;
    const restoreVolume = currentSong ? getTargetTrackVolume(currentSong) : clampVolume(window.lastVolume || 0.5);

    if (!settings.fadeOutEnabled) {
        fadingAudio.pause();
        return;
    }

    startFadeOut((Number(settings.fadeOutDuration) || 1.25) * 1000, () => {
        if (audioElement !== fadingAudio) return;
        fadingAudio.pause();
        fadingAudio.volume = restoreVolume;
    });
}

function scheduleCrossfadeTransition(song) {
    const settings = getAudioPlaybackSettings();

    if (!settings.crossfadeEnabled || !audioElement.src || audioElement.paused || !song) {
        return false;
    }

    const fadeMs = Math.max(150, (Number(settings.crossfadeDuration) || 4) * 1000);
    const currentVolume = clampVolume(audioElement.volume);

    cancelPendingCrossfade();

    startFadeOut(fadeMs);

    pendingCrossfadeTimer = setTimeout(() => {
        audioElement.src = song.url;
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});

        const nextVolume = getTargetTrackVolume(song);
        audioElement.volume = 0;
        animateAudioVolume(0, nextVolume, fadeMs, () => {
            if (!audioElement.paused) {
                audioElement.play().catch(() => {});
            }
        });

        pendingCrossfadeTimer = null;
    }, Math.max(120, fadeMs * 0.6));

    return true;
}

// Phase 2 Checkpoint 2: this one doesn't fit the shared debounce() helper — the delay is
// computed per-call from the user's crossfade-duration setting (Math.max(120, fadeMs * 0.6)),
// not a fixed constant, and debounce() only supports a fixed delay set once at creation.
// Forcing it in would have meant baking in a wrong delay. Instead, just gave the cross-file
// cancellation (10d-playback-song.js was reaching directly into this file's raw timer
// variable) a proper named function, so 10d calls cancelPendingCrossfade() instead of
// poking pendingCrossfadeTimer directly. Same behavior, better encapsulation.
function cancelPendingCrossfade() {
    if (pendingCrossfadeTimer) {
        clearTimeout(pendingCrossfadeTimer);
        pendingCrossfadeTimer = null;
    }
}

function setVolume(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const progress = (e.clientX - rect.left) / rect.width;
    updateVolume(progress);
}

function updateVolume(percentage) {
    const volume = Math.max(0, Math.min(1, percentage));

    // Remember the last non-zero level so unmute can restore it.
    if (volume > 0) {
        window.lastMutedVolume = volume;
    }
    window.lastVolume = volume;

    const currentSong = getCurrentSongForInfo();
    const targetVolume = currentSong ? getTargetTrackVolume(currentSong) : volume;
    audioElement.volume = targetVolume;
    audioElement.muted = volume === 0;

    const volumePercent = volume * 100 + '%';
    document.getElementById('volume-fill').style.width = volumePercent;
    document.getElementById('volume-knob').style.left = volumePercent;

    const icon = document.getElementById('volume-icon');
    if (volume === 0) {
        icon.innerHTML = '<i class="fas fa-volume-mute"></i>';
        icon.setAttribute('aria-label', 'Unmute');
        icon.setAttribute('title', 'Unmute');
    } else {
        icon.innerHTML = '<i class="fas fa-volume-up"></i>';
        icon.setAttribute('aria-label', 'Mute');
        icon.setAttribute('title', 'Mute');
    }
}

function toggleMute() {
    const userVolume = Number.isFinite(window.lastVolume) ? window.lastVolume : 0.5;
    if (userVolume > 0) {
        window.lastVolume = userVolume;
        updateVolume(0);
    } else {
        const restoreVolume = window.lastMutedVolume || 0.5;
        updateVolume(restoreVolume);
    }
}

const volumeSlider = document.getElementById('volume-slider');
let isDraggingVolume = false;

volumeSlider.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    document.body.classList.add('no-select');
    volumeSlider.classList.add('dragging');

    const rect = volumeSlider.getBoundingClientRect();
    const progress = (e.clientX - rect.left) / rect.width;
    updateVolume(progress);
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) {
        const rect = volumeSlider.getBoundingClientRect();
        const progress = (e.clientX - rect.left) / rect.width;
        updateVolume(progress);
    }
});

document.addEventListener('mouseup', () => {
    if (isDraggingVolume) {
        document.body.classList.remove('no-select');
        volumeSlider.classList.remove('dragging');
    }
    isDraggingVolume = false;
});
