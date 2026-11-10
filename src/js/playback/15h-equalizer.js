// ==============================================================================
// EQUALIZER
// ==============================================================================
// Ten bands (32 Hz to 16 kHz), a preamp, presets, one switch. The sound goes: player element -> preamp -> ten biquad filters -> speakers (Web Audio).
//
// Two things make it more than a few filters:
//
//  1. Web Audio is silent for media that is not same-origin or CORS-approved, and a file:// url is neither (the page runs with web security on).
//     So while the equalizer is on, a track is loaded through the media protocol instead (electron/media-protocol.js): assignAudioSource() below is
//     the ONE place that sets what an audio element plays, and it picks the url. Once an element has been routed through Web Audio it stays routed
//     (createMediaElementSource cannot be undone), so after the first time every source goes through the protocol, switch on or off.
//  2. The player has two physical audio elements (it swaps them for gapless play). Both feed the same chain, so a track change keeps the sound.
//
// "Off" is not a flat filter chain: the sources are connected straight to the speakers, so the sound is untouched. The element volume (the volume
// slider, fades, ReplayGain) acts before the chain, so all of that keeps working.
//
// THE BUS (for the audio visualizer, .agent/archive/visualizer/VISUALIZER-PLAN.md V1): sources -> the equalizer chain or a bypass -> `tap` -> speakers. `tap` is a
// plain unity gain, the one end of the bus. When the visualizer is on, an AnalyserNode is hung off `tap` as a SIDE branch (its output goes nowhere),
// so reading the sound can never change what is heard. With the visualizer off no analyser exists. Routing through the media protocol is needed
// when the equalizer is on, or the visualizer is on, or the elements were already routed (see needsProtocolFor).
//
// The pure parts (presets, clamping, the url) are exported and tested without a browser (tools/tests/equalizer.test.js).

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;

export const EQ_PRESETS = [
    { id: 'flat', label: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { id: 'bass', label: 'Bass boost', bands: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
    { id: 'treble', label: 'Treble boost', bands: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6] },
    { id: 'vocal', label: 'Vocal', bands: [-2, -2, -1, 1, 3, 3, 2, 1, 0, -1] },
    { id: 'rock', label: 'Rock', bands: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5] },
    { id: 'pop', label: 'Pop', bands: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2] },
    { id: 'jazz', label: 'Jazz', bands: [3, 2, 1, 2, -2, -2, 0, 1, 2, 3] },
    { id: 'classical', label: 'Classical', bands: [4, 3, 3, 2, -1, -1, 0, 2, 3, 4] },
    { id: 'electronic', label: 'Electronic', bands: [5, 4, 1, 0, -2, 2, 1, 1, 4, 5] },
    { id: 'loudness', label: 'Loudness', bands: [5, 3, 0, 0, -1, 0, 0, 0, 3, 5] }
];

export const DEFAULT_EQUALIZER_SETTINGS = {
    enabled: false,
    preset: 'flat',
    bands: EQ_FREQUENCIES.map(() => 0),
    preamp: 0,
    preventClipping: true
};

const MEDIA_SCHEME = 'xplayer-media:';

// ----- pure helpers -----

/** A gain in dB, on the half-dB grid of the sliders, inside the range. */
export function clampDb(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Math.round(number * 2) / 2));
}

/** The preset whose bands are exactly these, or 'custom'. */
export function detectPreset(bands) {
    const found = EQ_PRESETS.find((preset) => preset.bands.every((db, i) => db === bands[i]));
    return found ? found.id : 'custom';
}

export function normalizeEqualizerSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const bands = EQ_FREQUENCIES.map((_, i) => clampDb(Array.isArray(source.bands) ? source.bands[i] : 0));
    return {
        enabled: source.enabled === true,
        preset: detectPreset(bands),
        bands,
        preamp: clampDb(source.preamp),
        preventClipping: source.preventClipping !== false
    };
}

/** How far the loudest boost lifts the signal: the amount the preamp must come down to keep it from clipping. */
export function headroomDb(bands) {
    return Math.max(0, ...bands);
}

/** The gain the preamp really applies: the person's preamp, less the headroom when "prevent clipping" is on. */
export function effectivePreampDb(settings) {
    return settings.preamp - (settings.preventClipping ? headroomDb(settings.bands) : 0);
}

export const dbToGain = (db) => Math.pow(10, db / 20);

/** The url the media protocol serves for a file:// or https:// url; any other url is returned as it is (a blob: url is same-origin already). */
export function toMediaUrl(url) {
    if (typeof url !== 'string' || !/^(file:\/\/|https:\/\/)/i.test(url)) return url;
    return `xplayer-media://media/${encodeURIComponent(url)}`;
}

export function isMediaUrl(url) {
    return typeof url === 'string' && url.toLowerCase().startsWith(MEDIA_SCHEME);
}

/** Whether tracks must go through the media protocol: the protocol is available and (the equalizer is on, or the visualizer is on, or an element is already routed). */
export function needsProtocolFor({ available, equalizerOn, visualizerOn, routed }) {
    return Boolean(available) && Boolean(equalizerOn || visualizerOn || routed);
}

// ----- the person's settings -----

let cached = null;

export function getEqualizerSettings() {
    if (!cached) cached = storageReadJson(STORAGE_KEYS.EQUALIZER_SETTINGS, DEFAULT_EQUALIZER_SETTINGS, normalizeEqualizerSettings);
    return cached;
}

function saveEqualizerSettings(settings) {
    cached = normalizeEqualizerSettings(settings);
    storageWriteJson(STORAGE_KEYS.EQUALIZER_SETTINGS, cached);
    return cached;
}

/** True in the desktop app, which serves the music through the media protocol. In a plain browser the equalizer is not available. */
export function equalizerAvailable() {
    return typeof desktopApi !== 'undefined' && desktopApi.supports('files.mediaProtocolAvailable') && desktopApi.files.mediaProtocolAvailable() === true;
}

// ----- the audio chain -----

let graph = null; // { context, input, filters, tap, sources: Map<audio element, MediaElementAudioSourceNode> }
let visualizerOn = false;
let analyser = null; // exists only while the visualizer is on

function resumeContext() {
    if (graph && graph.context.state === 'suspended') graph.context.resume().catch(() => {});
}

function ensureGraph() {
    if (graph) return graph;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Web Audio is not available');
    const context = new Context({ latencyHint: 'playback' });
    const input = context.createGain();
    const last = EQ_FREQUENCIES.length - 1;
    const filters = EQ_FREQUENCIES.map((frequency, i) => {
        const filter = context.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === last ? 'highshelf' : 'peaking';
        filter.frequency.value = frequency;
        if (filter.type === 'peaking') filter.Q.value = 1.41; // about one octave wide: the bands meet without gaps
        return filter;
    });
    const tap = context.createGain(); // the end of the bus: unity gain, then the speakers
    tap.connect(context.destination);
    input.connect(filters[0]);
    filters.forEach((filter, i) => (i < last ? filter.connect(filters[i + 1]) : filter.connect(tap)));
    graph = { context, input, filters, tap, sources: new Map() };
    return graph;
}

/** Puts an audio element into the chain (once; it cannot be taken out again). */
function attach(element) {
    const chain = ensureGraph();
    if (chain.sources.has(element)) return;
    const source = chain.context.createMediaElementSource(element);
    chain.sources.set(element, source);
    element.addEventListener('play', resumeContext);
    connectSource(source);
}

function connectSource(source) {
    source.connect(getEqualizerSettings().enabled ? graph.input : graph.tap);
}

function applyGains() {
    if (!graph) return;
    const settings = getEqualizerSettings();
    const now = graph.context.currentTime;
    graph.filters.forEach((filter, i) => filter.gain.setTargetAtTime(settings.bands[i], now, 0.015)); // a short glide: no clicks while a slider moves
    graph.input.gain.setTargetAtTime(dbToGain(effectivePreampDb(settings)), now, 0.015);
}

function route() {
    if (!graph) return;
    for (const source of graph.sources.values()) {
        try {
            source.disconnect();
        } catch (_) {
            /* not connected yet */
        }
        connectSource(source);
    }
    applyGains();
}

function needsProtocol() {
    return needsProtocolFor({ available: equalizerAvailable(), equalizerOn: getEqualizerSettings().enabled, visualizerOn, routed: graph !== null });
}

/**
 * The ONE place that sets what an audio element plays. With the equalizer on (or once an element has been routed through it) the track
 * is loaded through the media protocol and the element is put in the chain first, so it is never heard unrouted. Otherwise it is a plain assignment.
 */
export function assignAudioSource(element, url) {
    if (!element) return;
    let source = url;
    if (url && needsProtocol()) {
        try {
            attach(element);
            source = toMediaUrl(url);
        } catch (error) {
            turnOffAfterFailure(error);
        }
    }
    if (isMediaUrl(source)) element.crossOrigin = 'anonymous';
    else element.removeAttribute('crossorigin');
    element.src = source;
}

function turnOffAfterFailure(error) {
    console.warn('Equalizer could not start', error);
    saveEqualizerSettings({ ...getEqualizerSettings(), enabled: false });
    route();
    if (typeof showNotification === 'function') showNotification('The equalizer could not start, so it was turned off', 'error', 4000);
    syncUi();
}

/** An element that already plays a plain url: loads the same track through the protocol and carries on from the same moment. */
function moveToProtocol(element) {
    const current = element.getAttribute('src');
    if (!current || isMediaUrl(current)) {
        attach(element);
        return;
    }
    const time = element.currentTime;
    const wasPlaying = !element.paused && !element.ended;
    assignAudioSource(element, current);
    element.addEventListener(
        'loadedmetadata',
        () => {
            try {
                element.currentTime = time;
            } catch (_) {
                /* not seekable yet */
            }
            if (wasPlaying) element.play().catch(() => {});
        },
        { once: true }
    );
}

function physicalElements() {
    return [...new Set([typeof audioElement !== 'undefined' ? audioElement : null, typeof gaplessAudioElement !== 'undefined' ? gaplessAudioElement : null].filter(Boolean))];
}

function syncUi() {
    if (typeof syncEqualizerUi === 'function') syncEqualizerUi();
}

// ----- what the settings page calls -----

export function setEqualizerEnabled(on) {
    if (on && !equalizerAvailable()) {
        if (typeof showNotification === 'function') showNotification('The equalizer is only available in the desktop app', 'warning', 3000);
        syncUi();
        return false;
    }
    saveEqualizerSettings({ ...getEqualizerSettings(), enabled: Boolean(on) });
    if (on) {
        try {
            ensureGraph();
            physicalElements().forEach(moveToProtocol);
            resumeContext();
        } catch (error) {
            turnOffAfterFailure(error);
            return false;
        }
    }
    route();
    syncUi();
    return true;
}

// ----- the visualizer's tap -----

/** The analyser to read, or null while the visualizer is off (or could not start). The renderer polls this; it never creates anything. */
export function getVisualizerAnalyser() {
    return analyser;
}

/** Switches the analyser on or off. Returns true when the state asked for is now in effect. Off removes the analyser; the chain itself stays (it cannot be undone). */
export function setVisualizerActive(on) {
    if (!on) {
        visualizerOn = false;
        if (analyser && graph) {
            try {
                graph.tap.disconnect(analyser);
            } catch (_) {
                /* already apart */
            }
        }
        analyser = null;
        return true;
    }
    if (!equalizerAvailable()) return false;
    try {
        ensureGraph();
        visualizerOn = true;
        physicalElements().forEach(moveToProtocol);
        resumeContext();
        if (!analyser) {
            analyser = graph.context.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0; // the renderer smooths with its own fast attack and slow fall
            graph.tap.connect(analyser); // a side branch: the analyser's output is not connected to anything
        }
        return true;
    } catch (error) {
        console.warn('Visualizer could not start', error);
        visualizerOn = false;
        analyser = null;
        return false;
    }
}

function change(patch) {
    saveEqualizerSettings({ ...getEqualizerSettings(), ...patch });
    applyGains();
    syncUi();
}

export function setEqualizerPreset(id) {
    const preset = EQ_PRESETS.find((p) => p.id === id);
    if (preset) change({ bands: preset.bands });
}

export function setEqualizerBand(index, value) {
    const bands = [...getEqualizerSettings().bands];
    if (!(index >= 0 && index < bands.length)) return;
    bands[index] = clampDb(value);
    change({ bands });
}

export function setEqualizerPreamp(value) {
    change({ preamp: clampDb(value) });
}

export function setEqualizerPreventClipping(on) {
    change({ preventClipping: Boolean(on) });
}

export function resetEqualizer() {
    change({ bands: DEFAULT_EQUALIZER_SETTINGS.bands, preamp: 0 });
}

// Names other files call or read by name.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        getEqualizerSettings,
        setEqualizerEnabled,
        setEqualizerPreset,
        setEqualizerBand,
        setEqualizerPreamp,
        setEqualizerPreventClipping,
        resetEqualizer,
        equalizerAvailable,
        setVisualizerActive,
        getVisualizerAnalyser
    });
}
