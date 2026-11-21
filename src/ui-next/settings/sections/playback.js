// Playback: how songs start, end and sound, and what the player bar shows.
//   Transitions   crossfade, gapless, fade in, fade out
//   Loudness      ReplayGain
//   Equalizer     (drawn by the engine; settings/adopt.js)
//   Player bar    waveform, visualizer
//   Smart Shuffle
import { engineCall, engineAction } from '../../adapter/engine-api.js';
import { isWaveformOn, setWaveformOn, watchWaveform } from '../../views/playback/waveform-setting.js';
import { isVisualizerOn, setVisualizerOn, watchVisualizer, getVisualizerWidth, setVisualizerWidth, watchVisualizerWidth, getVisualizerSongInfo, setVisualizerSongInfo, watchVisualizerSongInfo } from '../../views/playback/visualizer-setting.js';
import { takeAdopted } from '../adopt.js';

const audio = () => engineCall('getAudioPlaybackSettings') || {};
const setAudio = (key, value) => engineAction('setAudioPlaybackSetting', key, value);
const seconds = (v) => `${v}s`;
const decibels = (v) => `${v > 0 ? '+' : ''}${v} dB`;

// A switch for `${name}Enabled` with its length slider under it.
function fade({ id, label, name, min, max, step, fallback }) {
    return {
        id,
        type: 'toggle',
        label,
        get: () => audio()[`${name}Enabled`] === true,
        set: (value) => setAudio(`${name}Enabled`, value),
        children: [
            {
                id: `${id}-length`,
                type: 'slider',
                label: 'Length',
                min,
                max,
                step,
                format: seconds,
                get: () => Number(audio()[`${name}Duration`]) || fallback,
                set: (value) => setAudio(`${name}Duration`, value)
            }
        ]
    };
}

// The equalizer: the engine's own section, moved here without its title. It keeps its ids, so the engine keeps it in step.
function equalizerRow() {
    return {
        id: 'equalizer',
        type: 'custom',
        render: () => {
            const node = takeAdopted('equalizer');
            if (!node) return { el: document.createElement('div') };
            node.classList.remove('settings-section');
            node.querySelector(':scope > .settings-section-title')?.remove();
            // The number beside a slider follows it while it is dragged (the engine redraws it only after it has saved the value).
            const signed = (db) => `${db > 0 ? '+' : ''}${db} dB`;
            node.addEventListener('input', (event) => {
                const slider = event.target;
                if (!slider || !slider.dataset) return;
                const label = slider.dataset.eq === 'preamp' ? node.querySelector('[data-eq-preamp-label]') : slider.dataset.eqBand !== undefined ? node.querySelector(`[data-eq-db="${slider.dataset.eqBand}"]`) : null;
                if (label) label.textContent = signed(Number(slider.value));
            });
            return { el: node };
        }
    };
}

export const playback = {
    id: 'playback',
    label: 'Playback',
    icon: 'volume-2',
    order: 20,
    parts: [
        {
            id: 'transitions',
            title: 'Transitions',
            rows: [
                fade({ id: 'crossfade', label: 'Crossfade', name: 'crossfade', min: 0.5, max: 10, step: 0.5, fallback: 4 }),
                { id: 'gapless', type: 'toggle', label: 'Gapless playback', get: () => audio().gaplessEnabled === true, set: (value) => setAudio('gaplessEnabled', value) },
                fade({ id: 'fade-in', label: 'Fade in', name: 'fadeIn', min: 0.2, max: 5, step: 0.1, fallback: 1 }),
                fade({ id: 'fade-out', label: 'Fade out', name: 'fadeOut', min: 0.2, max: 5, step: 0.1, fallback: 1.25 })
            ]
        },
        {
            id: 'loudness',
            title: 'Loudness',
            rows: [
                {
                    id: 'replaygain',
                    type: 'toggle',
                    label: 'Normalize loudness (ReplayGain)',
                    get: () => audio().replayGainEnabled === true,
                    set: (value) => setAudio('replayGainEnabled', value),
                    children: [
                        {
                            id: 'replaygain-mode',
                            type: 'choice',
                            label: 'Based on',
                            options: [
                                { value: 'track', label: 'Track' },
                                { value: 'album', label: 'Album' }
                            ],
                            get: () => (audio().replayGainMode === 'album' ? 'album' : 'track'),
                            set: (value) => setAudio('replayGainMode', value)
                        },
                        { id: 'replaygain-trim', type: 'slider', label: 'Trim', min: -6, max: 6, step: 0.5, format: decibels, get: () => Number(audio().replayGainTrimDb) || 0, set: (value) => setAudio('replayGainTrimDb', value) }
                    ]
                }
            ]
        },
        { id: 'equalizer', title: 'Equalizer', rows: [equalizerRow()] },
        {
            id: 'player-bar',
            title: 'Player bar',
            rows: [
                {
                    id: 'waveform',
                    type: 'toggle',
                    label: 'Waveform seek bar',
                    hint: 'Songs over 10 minutes use the plain bar.',
                    get: isWaveformOn,
                    set: setWaveformOn,
                    subscribe: (cb) => watchWaveform(cb)
                },
                {
                    id: 'visualizer',
                    type: 'toggle',
                    label: 'Visualizer',
                    hint: 'Bars behind the player controls.',
                    get: isVisualizerOn,
                    set: setVisualizerOn,
                    subscribe: (cb) => watchVisualizer(cb),
                    children: [
                        {
                            id: 'visualizer-width',
                            type: 'choice',
                            label: 'Width',
                            options: [
                                { value: 'full', label: 'Full' },
                                { value: 'left', label: 'Left side' }
                            ],
                            get: getVisualizerWidth,
                            set: setVisualizerWidth,
                            subscribe: (cb) => watchVisualizerWidth(cb)
                        },
                        {
                            id: 'visualizer-song-info',
                            type: 'toggle',
                            label: 'Hide song info while it plays',
                            hint: 'It comes back when the pointer is over the player.',
                            get: () => getVisualizerSongInfo() === 'hide',
                            set: (value) => setVisualizerSongInfo(value ? 'hide' : 'keep'),
                            subscribe: (cb) => watchVisualizerSongInfo(cb)
                        }
                    ]
                }
            ]
        },
        {
            id: 'smart-shuffle',
            title: 'Smart Shuffle',
            hint: 'Beta. Queues songs that go together by artist, language, genre and year, in lists of more than 50 songs.',
            rows: [
                {
                    id: 'journey-size',
                    type: 'number',
                    label: 'Songs per queue',
                    min: 1,
                    step: 1,
                    get: () => Number((engineCall('getSmartShuffleSettings') || {}).journeySize) || 50,
                    set: (value) => engineAction('setSmartShuffleSetting', 'journeySize', value)
                }
            ]
        }
    ]
};
