// ==============================================================================
// EXTENDED METADATA SETTINGS
// ==============================================================================
registerActions({
    toggleExtendedMetadataField,
    toggleHideRightPanelLyrics
});

export function getExtendedMetadataSettings() {
    try {
        const parsed = storageReadJson(STORAGE_KEYS.EXTENDED_METADATA_ENABLED, null);
        if (parsed) {
            const result = {};
            EXTENDED_METADATA_FIELDS.forEach((f) => {
                if (f.hidden) {
                    result[f.key] = false;
                    return;
                }
                result[f.key] = parsed[f.key] !== undefined ? !!parsed[f.key] : !!f.defaultOn;
            });
            return result;
        }
    } catch (e) {
        console.warn('[extendedMetadataEnabled] failed to parse saved value, using defaults', e);
    }
    const defaults = {};
    EXTENDED_METADATA_FIELDS.forEach((f) => {
        defaults[f.key] = f.hidden ? false : !!f.defaultOn;
    });
    return defaults;
}

export function saveExtendedMetadataSettings(settings) {
    storageWriteJson(STORAGE_KEYS.EXTENDED_METADATA_ENABLED, settings);
}

export function toggleExtendedMetadataField(fieldKey, enabled) {
    const settings = getExtendedMetadataSettings();
    settings[fieldKey] = !!enabled;
    saveExtendedMetadataSettings(settings);
    updateInfoButtonVisibility();
}

export function getHideRightPanelLyrics() {
    return storageReadBool(STORAGE_KEYS.HIDE_RIGHT_PANEL_LYRICS, false);
}

export function setHideRightPanelLyrics(value) {
    storageWriteBool(STORAGE_KEYS.HIDE_RIGHT_PANEL_LYRICS, !!value);
    if (typeof renderTrackLyricsBox === 'function') {
        renderTrackLyricsBox();
    }
}

export function toggleHideRightPanelLyrics(checked) {
    setHideRightPanelLyrics(!!checked);
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getExtendedMetadataSettings,
        saveExtendedMetadataSettings,
        toggleExtendedMetadataField,
        getHideRightPanelLyrics,
        setHideRightPanelLyrics,
        toggleHideRightPanelLyrics
    });
}
