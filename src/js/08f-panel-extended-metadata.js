// ==============================================================================
// EXTENDED METADATA SETTINGS
// ==============================================================================
function getExtendedMetadataSettings() {
    try {
        const saved = localStorage.getItem('extendedMetadataEnabled');
        if (saved) {
            const parsed = JSON.parse(saved);
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
    } catch (e) {}
    const defaults = {};
    EXTENDED_METADATA_FIELDS.forEach((f) => {
        defaults[f.key] = f.hidden ? false : !!f.defaultOn;
    });
    return defaults;
}

function saveExtendedMetadataSettings(settings) {
    localStorage.setItem('extendedMetadataEnabled', JSON.stringify(settings));
}

function toggleExtendedMetadataField(fieldKey, enabled) {
    const settings = getExtendedMetadataSettings();
    settings[fieldKey] = !!enabled;
    saveExtendedMetadataSettings(settings);
    updateInfoButtonVisibility();
}

function getHideRightPanelLyrics() {
    return localStorage.getItem('hideRightPanelLyrics') === 'true';
}

function setHideRightPanelLyrics(value) {
    localStorage.setItem('hideRightPanelLyrics', value ? 'true' : 'false');
    if (typeof renderTrackLyricsBox === 'function') {
        renderTrackLyricsBox();
    }
}

function toggleHideRightPanelLyrics(checked) {
    setHideRightPanelLyrics(!!checked);
}
