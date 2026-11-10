// ==============================================================================
// VOLUME / GAIN / FADE HELPERS
// ==============================================================================
// One volume state: window.lastVolume is the slider POSITION (0 to 1, what the person sees and what is saved). The audio gain
// (audioElement.volume) is always worked out from it by positionToGain() in volume-curve.js, times the track's ReplayGain. Nothing
// else keeps a volume, and nothing reads audioElement.volume back as if it were the slider.
import { assignAudioSource } from './15h-equalizer.js';
import { positionToGain, clampPosition, nudgePosition, normalizeSavedVolume, volumeLevel, DEFAULT_VOLUME_POSITION, VOLUME_KEY_STEP } from './volume-curve.js';

let activeAudioFadeFrame = null;
let pendingCrossfadeTimer = null;

export function cancelActiveAudioFade() {
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

// The slider position now, as a number from 0 to 1 (the default before anything has been set).
export function getVolumePosition() {
    return Number.isFinite(window.lastVolume) ? clampPosition(window.lastVolume) : DEFAULT_VOLUME_POSITION;
}

// The gain for a track: the slider through the curve, times ReplayGain, never above 1 (no boost past the file's own level).
export function getTargetTrackVolume(song) {
    return clampVolume(positionToGain(getVolumePosition()) * getReplayGainMultiplier(song));
}

export function applyTrackVolume(song) {
    applyOutputVolume(getTargetTrackVolume(song), getVolumePosition() <= 0);
}

// ---- smoothing ---------------------------------------------------------------------------------------------------------------------
// A new gain is not written in one jump (a step in the signal can click, most audibly when muting or when the slider is clicked far
// from where it was). The gain moves to the new value along an exponential curve with a time constant of 18 ms: about 80 ms from start to
// finish, and fast enough that dragging feels immediate. It ends exactly on the target, and exactly on silence for a mute.
// While a fade (fade in, fade out, crossfade) is running the fade owns audioElement.volume and asks getTargetTrackVolume() every frame,
// so a change made then needs no smoothing of its own. A hidden window gets no animation frames, so there the value is set at once.
const SMOOTH_TAU_MS = 18;
const SMOOTH_DONE_ABS = 0.0002; // -74 dB: close enough to snap to the target
const SMOOTH_DONE_REL = 0.01; // 1 %, about 0.09 dB
let smoothFrame = null;
let smoothTarget = null;
let smoothMuted = false;
let smoothLast = 0;

function stopSmoothing() {
    if (smoothFrame) cancelAnimationFrame(smoothFrame);
    smoothFrame = null;
    smoothTarget = null;
}

function stepSmoothing(now) {
    smoothFrame = null;
    if (smoothTarget === null) return;
    if (activeAudioFadeFrame) {
        // A fade started: it takes over the gain. Keep the mute flag the person asked for.
        audioElement.muted = smoothMuted;
        smoothTarget = null;
        return;
    }
    const dt = Math.max(0, Math.min(64, now - smoothLast));
    smoothLast = now;
    const current = audioElement.volume;
    const next = current + (smoothTarget - current) * (1 - Math.exp(-dt / SMOOTH_TAU_MS));
    if (Math.abs(smoothTarget - next) <= Math.max(SMOOTH_DONE_ABS, smoothTarget * SMOOTH_DONE_REL)) {
        audioElement.volume = smoothTarget;
        audioElement.muted = smoothMuted;
        smoothTarget = null;
        return;
    }
    audioElement.volume = next;
    smoothFrame = requestAnimationFrame(stepSmoothing);
}

// Sets the output: the gain to reach, and whether the element is muted once it is there (a mute ramps down first, then mutes).
function applyOutputVolume(target, muted) {
    const gain = clampVolume(target);
    const smooth = !activeAudioFadeFrame && !document.hidden && typeof requestAnimationFrame === 'function' && Boolean(audioElement.src);
    if (!smooth) {
        stopSmoothing();
        audioElement.volume = gain;
        audioElement.muted = muted;
        return;
    }
    if (!muted) audioElement.muted = false; // unmuting starts the ramp up from silence, it does not wait
    smoothTarget = gain;
    smoothMuted = muted;
    if (!smoothFrame) {
        smoothLast = performance.now();
        smoothFrame = requestAnimationFrame(stepSmoothing);
    }
}

// `to` is a volume or, for a fade-in, a function returning the volume to reach. A fade-in asks again on every frame, so a volume the
// person sets while the track fades in is where the fade ends (D17: it used to be overwritten with the volume from the track's start).
function animateAudioVolume(from, to, durationMs, onComplete) {
    stopSmoothing(); // the fade owns the gain from here
    if (activeAudioFadeFrame) {
        cancelAnimationFrame(activeAudioFadeFrame);
        activeAudioFadeFrame = null;
    }

    const start = performance.now();
    const duration = Math.max(60, Number(durationMs) || 0);
    const startVolume = clampVolume(from);
    const endOf = () => clampVolume(typeof to === 'function' ? to() : to);

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const endVolume = endOf();
        audioElement.volume = clampVolume(startVolume + (endVolume - startVolume) * eased);

        if (progress < 1) {
            activeAudioFadeFrame = requestAnimationFrame(step);
        } else {
            audioElement.volume = endOf();
            activeAudioFadeFrame = null;
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    }

    activeAudioFadeFrame = requestAnimationFrame(step);
}

export function startFadeIn(song, durationMs) {
    const settings = getAudioPlaybackSettings();
    const target = getTargetTrackVolume(song);
    const duration = settings.fadeInEnabled ? Math.max(80, durationMs || settings.fadeInDuration * 1000) : 0;

    if (!settings.fadeInEnabled || duration <= 0) {
        audioElement.volume = target;
        return;
    }

    audioElement.volume = 0;
    animateAudioVolume(0, () => getTargetTrackVolume(song), duration);
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

export function pausePlaybackWithFade() {
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

export function scheduleCrossfadeTransition(song) {
    const settings = getAudioPlaybackSettings();

    if (!settings.crossfadeEnabled || !audioElement.src || audioElement.paused || !song) {
        return false;
    }

    const fadeMs = Math.max(150, (Number(settings.crossfadeDuration) || 4) * 1000);

    cancelPendingCrossfade();

    startFadeOut(fadeMs);

    pendingCrossfadeTimer = setTimeout(() => {
        assignAudioSource(audioElement, song.url);
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});

        audioElement.volume = 0;
        animateAudioVolume(0, () => getTargetTrackVolume(song), fadeMs, () => {
            if (!audioElement.paused) {
                audioElement.play().catch(() => {});
            }
        });

        pendingCrossfadeTimer = null;
    }, Math.max(120, fadeMs * 0.6));

    return true;
}

// This one doesn't fit the shared debounce() helper — the delay is
// computed per-call from the user's crossfade-duration setting (Math.max(120, fadeMs * 0.6)),
// not a fixed constant, and debounce() only supports a fixed delay set once at creation.
// Forcing it in would have meant baking in a wrong delay. Instead, just gave the cross-file
// cancellation (10d-playback-song.js was reaching directly into this file's raw timer
// variable) a proper named function, so 10d calls cancelPendingCrossfade() instead of
// poking pendingCrossfadeTimer directly. Same behavior, better encapsulation.
export function cancelPendingCrossfade() {
    if (pendingCrossfadeTimer) {
        clearTimeout(pendingCrossfadeTimer);
        pendingCrossfadeTimer = null;
    }
}

export function setVolume(e) {
    // Called through data-action, where e.currentTarget is document (core/LEGACY.md, point 2).
    const slider = document.getElementById('volume-slider');
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    const progress = (e.clientX - rect.left) / rect.width;
    updateVolume(progress);
}

// What survives a restart: the slider position and the last audible position (what unmute goes back to). Written a moment after the
// last change, so a drag is one write, and at once when the window closes.
let saveVolumeTimer = null;
function saveVolumeNow() {
    clearTimeout(saveVolumeTimer);
    saveVolumeTimer = null;
    storageWriteJson(STORAGE_KEYS.VOLUME, { position: getVolumePosition(), restore: window.lastMutedVolume || getVolumePosition() });
}
function saveVolumeSoon() {
    clearTimeout(saveVolumeTimer);
    saveVolumeTimer = setTimeout(saveVolumeNow, 250);
}
window.addEventListener('pagehide', () => {
    if (saveVolumeTimer) saveVolumeNow();
});

// `percentage` is the slider position, 0 to 1 (the name is old). Everything that sets the volume comes through here: the slider
// (a click or a drag), the keyboard, the sync editor's own slider, unmute, the saved value at start-up.
// What the person sees for each level: the icon (Font Awesome names; the new interface draws the same names with its own icons) and the
// accessible name of the button. Every audible level has at least one curved bar: whisper and low share the one-wave icon (the fill is
// dimmer at whisper), high has two. The icon never moves: when its shape changes the new one fades in (CSS, class vol-fade).
const VOLUME_ICONS = {
    mute: { icon: 'fa-volume-mute', label: 'Unmute' },
    whisper: { icon: 'fa-volume-down', label: 'Mute' },
    low: { icon: 'fa-volume-down', label: 'Mute' },
    high: { icon: 'fa-volume-up', label: 'Mute' }
};
const BUBBLE_MS = 900;
let bubbleTimer = null;

// The small number above the knob while the volume is being changed (a drag, the keyboard, a click). It stays while the mouse is held
// and for a moment after the last change. `quiet` (start-up) shows nothing.
function showVolumeBubble(volume) {
    const slider = document.getElementById('volume-slider');
    if (!slider) return;
    let bubble = document.getElementById('volume-bubble');
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'volume-bubble';
        bubble.className = 'volume-bubble';
        bubble.setAttribute('aria-hidden', 'true'); // the slider and the button already say it
        slider.appendChild(bubble);
    }
    bubble.textContent = volume === 0 ? 'Muted' : Math.round(volume * 100) + '%';
    bubble.style.left = volume * 100 + '%';
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), BUBBLE_MS);
}

function paintVolumeIcon(volume, quiet) {
    const icon = document.getElementById('volume-icon');
    const slider = document.getElementById('volume-slider');
    const level = volumeLevel(volume);
    if (slider) slider.dataset.level = level; // the fill is drawn brighter the louder it is (CSS)
    icon.dataset.level = level;
    const { icon: glyph, label } = VOLUME_ICONS[level];
    icon.setAttribute('aria-label', label);
    icon.setAttribute('title', label);
    if (icon.dataset.glyph === glyph) return; // the same shape: leave it alone (no flicker while dragging)
    const first = icon.dataset.glyph === undefined;
    icon.dataset.glyph = glyph;
    // fa-fw: every shape has the same width, so the icon and the slider next to it stay where they are
    icon.innerHTML = '<i class="fas fa-fw ' + glyph + (first || quiet ? '' : ' vol-fade') + '"></i>';
}

// `percentage` is the slider position, 0 to 1 (the name is old). Everything that sets the volume comes through here: the slider
// (a click or a drag), the keyboard, the sync editor's own slider, unmute, the saved value at start-up.
// Options: `save` false does not write the value down; `quiet` true shows no bubble and no icon fade (start-up).
export function updateVolume(percentage, { save = true, quiet = false } = {}) {
    const volume = clampPosition(percentage);

    // Remember the last non-zero level so unmute can restore it.
    if (volume > 0) {
        window.lastMutedVolume = volume;
    }
    window.lastVolume = volume;

    const currentSong = getCurrentSongForInfo();
    applyOutputVolume(currentSong ? getTargetTrackVolume(currentSong) : positionToGain(volume), volume === 0);
    if (save) saveVolumeSoon();

    const volumePercent = volume * 100 + '%';
    document.getElementById('volume-fill').style.width = volumePercent;
    document.getElementById('volume-knob').style.left = volumePercent;
    paintVolumeIcon(volume, quiet);
    if (!quiet) showVolumeBubble(volume);
}

// Ctrl+Up / Ctrl+Down: a step of the slider (2.5 dB), through the same updateVolume as a drag. From mute it starts at the first step.
export function nudgeVolume(direction) {
    updateVolume(nudgePosition(getVolumePosition(), (direction < 0 ? -1 : 1) * VOLUME_KEY_STEP));
}

// At start-up: the saved volume, or the default on a first run. Does not write it back.
export function restoreSavedVolume() {
    const saved = storageReadJson(STORAGE_KEYS.VOLUME, null, normalizeSavedVolume);
    const position = saved ? saved.position : DEFAULT_VOLUME_POSITION;
    window.lastMutedVolume = saved ? saved.restore : DEFAULT_VOLUME_POSITION;
    window.lastVolume = position;
    updateVolume(position, { save: false, quiet: true }); // at position 0 this leaves lastMutedVolume as set above: what unmute returns to
}

export function toggleMute() {
    const userVolume = getVolumePosition();
    if (userVolume > 0) {
        window.lastVolume = userVolume;
        updateVolume(0);
    } else {
        const restoreVolume = window.lastMutedVolume || DEFAULT_VOLUME_POSITION;
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

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        cancelActiveAudioFade,
        getTargetTrackVolume,
        applyTrackVolume,
        startFadeIn,
        pausePlaybackWithFade,
        scheduleCrossfadeTransition,
        cancelPendingCrossfade,
        setVolume,
        updateVolume,
        nudgeVolume,
        restoreSavedVolume,
        getVolumePosition,
        toggleMute
    });
}
