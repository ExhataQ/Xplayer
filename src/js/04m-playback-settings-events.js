// ==============================================================================
// PLAYBACK SETTINGS - UI REACTIONS
// ==============================================================================
// Subscribes to 'playbackSetting:changed' from setAudioPlaybackSetting() in
// 03f-favorites-settings.js. Keeps every playback-setting checkbox in sync with the
// saved settings - needed because gapless and crossfade are mutually exclusive, so
// turning one on can flip the other's checkbox off. Moved verbatim from the inline
// loop that used to sit in setAudioPlaybackSetting() (minus its
// `typeof document !== 'undefined'` guard: this file only exists in a page with a DOM).

on('playbackSetting:changed', (e) => {
    const { settings } = e.detail;
    document.querySelectorAll('[data-playback-setting]').forEach((input) => {
        const settingKey = input.getAttribute('data-playback-setting');
        if (input.type === 'checkbox' && settingKey in settings) {
            input.checked = Boolean(settings[settingKey]);
        }
    });
});
