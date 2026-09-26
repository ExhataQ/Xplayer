// ==============================================================================
// FAVORITES & APP SETTINGS (smart shuffle, audio playback, window)
// (split out of 03-storage.js, Phase 2 Checkpoint 5)
// ==============================================================================


// ==============================================================================
// FAVORITES
// ==============================================================================
function getFavorites() {
    return getStoredJson(STORAGE_KEYS.FAVORITES, []);
}


const DEFAULT_SMART_SHUFFLE_SETTINGS = {
    journeySize: 50,
    groupSize: 5,
    genreFlow: 'gentle',
    artistSeparation: 'normal',
    recentLimit: 50,
    favoriteWeight: 'neutral',
    discoveryWeight: 'neutral',
    durationVariety: true
};

const DEFAULT_AUDIO_PLAYBACK_SETTINGS = {
    crossfadeEnabled: false,
    crossfadeDuration: 4,
    gaplessEnabled: true,
    fadeInEnabled: true,
    fadeInDuration: 1,
    fadeOutEnabled: true,
    fadeOutDuration: 1.25,
    replayGainEnabled: true,
    replayGainMode: 'track',
    replayGainTrimDb: 0,
    replayGainLimiter: true
};

function getSmartShuffleSettings() {
    return {
        ...DEFAULT_SMART_SHUFFLE_SETTINGS,
        ...getStoredJson(STORAGE_KEYS.SMART_SHUFFLE_SETTINGS, {})
    };
}


function getAudioPlaybackSettings() {
    const settings = {
        ...DEFAULT_AUDIO_PLAYBACK_SETTINGS,
        ...getStoredJson(STORAGE_KEYS.AUDIO_PLAYBACK_SETTINGS, {})
    };
    // Both modes control the same transition and cannot run together. Preserve
    // the gapless preference for settings saved by older builds with both on.
    if (settings.gaplessEnabled && settings.crossfadeEnabled) {
        settings.crossfadeEnabled = false;
    }
    return settings;
}


function saveAudioPlaybackSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.AUDIO_PLAYBACK_SETTINGS, JSON.stringify(settings));
}


function setAudioPlaybackSetting(key, value) {
    const settings = getAudioPlaybackSettings();
    settings[key] = value;

    if (key === 'gaplessEnabled' && value) settings.crossfadeEnabled = false;
    if (key === 'crossfadeEnabled' && value) settings.gaplessEnabled = false;

    saveAudioPlaybackSettings(settings);

    if (typeof document !== 'undefined') {
        document.querySelectorAll('[data-playback-setting]').forEach((input) => {
            const settingKey = input.getAttribute('data-playback-setting');
            if (input.type === 'checkbox' && settingKey in settings) {
                input.checked = Boolean(settings[settingKey]);
            }
        });
    }

    if (key === 'gaplessEnabled' || key === 'crossfadeEnabled') {
        if (settings.gaplessEnabled && typeof prepareGaplessNextTrack === 'function') {
            prepareGaplessNextTrack();
        } else if (typeof clearGaplessPreload === 'function') {
            clearGaplessPreload();
        }
    }

    if (
        ['replayGainEnabled', 'replayGainMode', 'replayGainTrimDb', 'replayGainLimiter'].includes(key) &&
        typeof applyTrackVolume === 'function' &&
        typeof getCurrentSongForInfo === 'function'
    ) {
        applyTrackVolume(getCurrentSongForInfo());
    }

    return settings;
}


function getWindowSettings() {
    return {
        minimizeOnClose: localStorage.getItem(STORAGE_KEYS.MINIMIZE_ON_CLOSE) === 'true'
    };
}


function setMinimizeOnClose(enabled) {
    const value = Boolean(enabled);
    localStorage.setItem(STORAGE_KEYS.MINIMIZE_ON_CLOSE, String(value));
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.setMinimizeOnClose) {
        window.electronAPI.setMinimizeOnClose(value);
    }
}


function saveSmartShuffleSetting(key, value) {
    const settings = getSmartShuffleSettings();
    settings[key] = value;
    localStorage.setItem(STORAGE_KEYS.SMART_SHUFFLE_SETTINGS, JSON.stringify(settings));
}


function saveFavorite(songId) {
    let favorites = getFavorites();
    if (!favorites.includes(songId)) {
        favorites.unshift(songId);
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    }
}


function removeFavorite(songId) {
    let favorites = getFavorites();
    favorites = favorites.filter((id) => id !== songId);
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
}


function isFavorite(songId) {
    const favorites = getFavorites();
    return favorites.includes(songId);
}
