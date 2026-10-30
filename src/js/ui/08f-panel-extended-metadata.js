// ==============================================================================
// EXTENDED METADATA SETTINGS
// ==============================================================================
registerActions({
    toggleExtendedMetadataField
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

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getExtendedMetadataSettings,
        toggleExtendedMetadataField
    });
}
