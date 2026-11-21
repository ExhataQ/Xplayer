// ==============================================================================
// SETTINGS - EQUALIZER SECTION
// ==============================================================================
// The Equalizer section of the settings page: a switch, a preset menu, ten vertical band sliders, a preamp, "prevent clipping" and a reset.
// The engine (playback/15h-equalizer.js) does the sound; this draws the controls and keeps them in step with the saved settings, whichever way
// they were changed (a preset moves all ten sliders). The markup is plain HTML with the same data-action attributes as the rest of the page.

import {
    EQ_FREQUENCIES,
    EQ_LABELS,
    EQ_PRESETS,
    EQ_MIN_DB,
    EQ_MAX_DB,
    getEqualizerSettings,
    equalizerAvailable,
    headroomDb,
    setEqualizerEnabled,
    setEqualizerPreset,
    setEqualizerBand,
    setEqualizerPreamp,
    setEqualizerPreventClipping,
    resetEqualizer
} from '../playback/15h-equalizer.js';

const SECTION_ID = 'equalizer-section';
const signed = (db) => `${db > 0 ? '+' : ''}${db} dB`;

export function buildEqualizerSection() {
    const settings = getEqualizerSettings();
    const available = equalizerAvailable();
    const bands = EQ_FREQUENCIES.map(
        (frequency, i) => `
                            <div class="eq-band">
                                <span class="eq-band-db" data-eq-db="${i}">${signed(settings.bands[i])}</span>
                                <span class="eq-slider-slot"><input type="range" class="eq-slider" min="${EQ_MIN_DB}" max="${EQ_MAX_DB}" step="0.5" value="${settings.bands[i]}" data-eq-band="${i}" data-action-input="equalizerBandInput" data-args-input='["$this"]' aria-label="${frequency >= 1000 ? frequency / 1000 + ' kHz' : frequency + ' Hz'}" aria-valuetext="${signed(settings.bands[i])}"></span>
                                <span class="eq-band-freq">${EQ_LABELS[i]}</span>
                            </div>`
    ).join('');
    const presets = [...EQ_PRESETS, { id: 'custom', label: 'Custom' }]
        .map((preset) => `<option value="${preset.id}"${preset.id === settings.preset ? ' selected' : ''}${preset.id === 'custom' ? ' disabled' : ''}>${preset.label}</option>`)
        .join('');
    return `
                    <div class="settings-section eq-section" id="${SECTION_ID}" data-enabled="${settings.enabled}" data-available="${available}">
                        <div class="settings-section-title">Equalizer</div>
                        <label class="settings-toggle-row"><input type="checkbox" data-eq="enabled" ${settings.enabled ? 'checked' : ''} ${available ? '' : 'disabled'} data-action-change="equalizerEnabledChanged" data-args-change='["$checked"]'><span>Enable equalizer</span></label>
                        <div class="settings-threshold-hint eq-unavailable">The equalizer works in the desktop app.</div>
                        <div class="eq-body">
                            <div class="settings-threshold-row"><span>Preset</span><select data-eq="preset" aria-label="Equalizer preset" data-action-change="equalizerPresetChanged" data-args-change='["$this"]'>${presets}</select></div>
                            <div class="eq-bands" role="group" aria-label="Equalizer bands">${bands}
                            </div>
                            <div class="settings-threshold-row"><span>Preamp</span><input type="range" min="${EQ_MIN_DB}" max="${EQ_MAX_DB}" step="0.5" value="${settings.preamp}" data-eq="preamp" data-action-input="equalizerPreampInput" data-args-input='["$this"]' aria-label="Equalizer preamp"><span data-eq-preamp-label>${signed(settings.preamp)}</span></div>
                            <label class="settings-toggle-row"><input type="checkbox" data-eq="preventClipping" ${settings.preventClipping ? 'checked' : ''} data-action-change="equalizerClippingChanged" data-args-change='["$checked"]'><span>Prevent clipping</span></label>
                            <div class="settings-threshold-hint" data-eq-headroom></div>
                            <div class="settings-threshold-row"><span></span><button type="button" class="settings-action-btn" data-action="equalizerReset"><span>Reset to flat</span></button></div>
                        </div>
                    </div>`;
}

/** Brings the controls in line with the saved settings (a preset moves all ten sliders). Safe to call when the page is not open. */
export function syncEqualizerUi() {
    const root = document.getElementById(SECTION_ID);
    if (!root) return;
    const settings = getEqualizerSettings();
    root.dataset.enabled = String(settings.enabled);
    const enabled = root.querySelector('[data-eq="enabled"]');
    if (enabled) enabled.checked = settings.enabled;
    const preset = root.querySelector('[data-eq="preset"]');
    if (preset) preset.value = settings.preset;
    root.querySelectorAll('[data-eq-band]').forEach((slider) => {
        const i = Number(slider.dataset.eqBand);
        if (document.activeElement !== slider) slider.value = String(settings.bands[i]); // the slider being dragged already shows its value
        slider.setAttribute('aria-valuetext', signed(settings.bands[i]));
        slider.dispatchEvent(new CustomEvent('rangefillupdate', { bubbles: true })); // the page redraws the filled part of the track
        const label = root.querySelector(`[data-eq-db="${i}"]`);
        if (label) label.textContent = signed(settings.bands[i]);
    });
    const preamp = root.querySelector('[data-eq="preamp"]');
    if (preamp && document.activeElement !== preamp) preamp.value = String(settings.preamp);
    if (preamp) preamp.dispatchEvent(new CustomEvent('rangefillupdate', { bubbles: true }));
    const preampLabel = root.querySelector('[data-eq-preamp-label]');
    if (preampLabel) preampLabel.textContent = signed(settings.preamp);
    const clipping = root.querySelector('[data-eq="preventClipping"]');
    if (clipping) clipping.checked = settings.preventClipping;
    const headroom = root.querySelector('[data-eq-headroom]');
    if (headroom) {
        const lowered = settings.preventClipping ? headroomDb(settings.bands) : 0;
        headroom.textContent = lowered > 0 ? `The volume is lowered by ${lowered} dB so the loudest boost cannot clip.` : 'No boost is set, so nothing is lowered.';
    }
}

if (typeof registerActions === 'function') {
    registerActions({
        equalizerEnabledChanged: (checked) => setEqualizerEnabled(Boolean(checked)),
        equalizerPresetChanged: (select) => setEqualizerPreset(select.value),
        equalizerBandInput: (slider) => setEqualizerBand(Number(slider.dataset.eqBand), slider.value),
        equalizerPreampInput: (slider) => setEqualizerPreamp(slider.value),
        equalizerClippingChanged: (checked) => setEqualizerPreventClipping(Boolean(checked)),
        equalizerReset: () => resetEqualizer()
    });
}

if (typeof registerLegacyGlobals === 'function') registerLegacyGlobals({ syncEqualizerUi });
