// ==============================================================================
// FAVORITES & APP SETTINGS (smart shuffle, audio playback, window)
// (split out of 03-storage.js)
// ==============================================================================


// ==============================================================================
// FAVORITES
// ==============================================================================
export function getFavorites() {
    return storageReadJson(STORAGE_KEYS.FAVORITES, [], normalizeIdList);
}


export const DEFAULT_SMART_SHUFFLE_SETTINGS = {
    journeySize: 50,
    groupSize: 5,
    genreFlow: 'gentle',
    artistSeparation: 'normal',
    recentLimit: 50,
    favoriteWeight: 'neutral',
    discoveryWeight: 'neutral',
    durationVariety: true
};

export const DEFAULT_AUDIO_PLAYBACK_SETTINGS = {
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

export function getSmartShuffleSettings() {
    return {
        ...DEFAULT_SMART_SHUFFLE_SETTINGS,
        ...storageReadJson(STORAGE_KEYS.SMART_SHUFFLE_SETTINGS, {}, (v) => normalizeSettings(v, DEFAULT_SMART_SHUFFLE_SETTINGS))
    };
}


export function getAudioPlaybackSettings() {
    const settings = {
        ...DEFAULT_AUDIO_PLAYBACK_SETTINGS,
        ...storageReadJson(STORAGE_KEYS.AUDIO_PLAYBACK_SETTINGS, {}, (v) => normalizeSettings(v, DEFAULT_AUDIO_PLAYBACK_SETTINGS))
    };
    // Both modes control the same transition and cannot run together. Preserve
    // the gapless preference for settings saved by older builds with both on.
    if (settings.gaplessEnabled && settings.crossfadeEnabled) {
        settings.crossfadeEnabled = false;
    }
    return settings;
}


export function saveAudioPlaybackSettings(settings) {
    storageWriteJson(STORAGE_KEYS.AUDIO_PLAYBACK_SETTINGS, settings);
}


export function setAudioPlaybackSetting(key, value) {
    const settings = getAudioPlaybackSettings();
    settings[key] = value;

    if (key === 'gaplessEnabled' && value) settings.crossfadeEnabled = false;
    if (key === 'crossfadeEnabled' && value) settings.gaplessEnabled = false;

    saveAudioPlaybackSettings(settings);

    // Checkbox sync (gapless and crossfade are mutually exclusive, so changing one can
    // flip the other's checkbox) lives in 04m-playback-settings-events.js. Emitted at the
    // exact spot the inline DOM loop used to be, so it still runs after the save and
    // before the gapless/ReplayGain side effects below.
    emit('playbackSetting:changed', { key, value, settings });

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


export function getWindowSettings() {
    return {
        minimizeOnClose: storageReadBool(STORAGE_KEYS.MINIMIZE_ON_CLOSE)
    };
}


export function setMinimizeOnClose(enabled) {
    const value = Boolean(enabled);
    storageWriteBool(STORAGE_KEYS.MINIMIZE_ON_CLOSE, value);
    if (desktopApi.supports('window.setMinimizeOnClose')) {
        desktopApi.window.setMinimizeOnClose(value);
    }
}


export function saveSmartShuffleSetting(key, value) {
    const settings = getSmartShuffleSettings();
    settings[key] = value;
    storageWriteJson(STORAGE_KEYS.SMART_SHUFFLE_SETTINGS, settings);
}


export function saveFavorite(songId) {
    let favorites = getFavorites();
    if (!favorites.includes(songId)) {
        favorites.unshift(songId);
        storageWriteJson(STORAGE_KEYS.FAVORITES, favorites);
    }
}


export function removeFavorite(songId) {
    let favorites = getFavorites();
    favorites = favorites.filter((id) => id !== songId);
    storageWriteJson(STORAGE_KEYS.FAVORITES, favorites);
}


export function isFavorite(songId) {
    const favorites = getFavorites();
    return favorites.includes(songId);
}

// Classic scripts and inline handlers still call these by name; registered until the final flip.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getFavorites,
        getSmartShuffleSettings,
        getAudioPlaybackSettings,
        saveAudioPlaybackSettings,
        setAudioPlaybackSetting,
        getWindowSettings,
        setMinimizeOnClose,
        saveSmartShuffleSetting,
        saveFavorite,
        removeFavorite,
        isFavorite
    });
}
