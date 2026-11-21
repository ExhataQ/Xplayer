// Player-control, queue-paging and gapless-playback state that the setters in core/state-*.js assign by bare name.
export let showRemainingTime = false;
export let wasPlaying = false;
export let repeatVisualState = 0;
export let repeatFunctionalityActive = false;
export let queueDisplayLimit = 50;
export let queueDisplayPageSize = 25;
export let gaplessAudioElement = new Audio();
gaplessAudioElement.preload = 'auto';
export let gaplessActiveElement = audioElement;

// Names other files call or read by name (inline handlers, other modules).
// Variables other files read and assign by name: the accessors read and write this file's own variables.
if (typeof registerLegacyState === 'function') {
    registerLegacyState({
        showRemainingTime: [() => showRemainingTime, (value) => { showRemainingTime = value; }],
        wasPlaying: [() => wasPlaying, (value) => { wasPlaying = value; }],
        repeatVisualState: [() => repeatVisualState, (value) => { repeatVisualState = value; }],
        repeatFunctionalityActive: [() => repeatFunctionalityActive, (value) => { repeatFunctionalityActive = value; }],
        queueDisplayLimit: [() => queueDisplayLimit, (value) => { queueDisplayLimit = value; }],
        queueDisplayPageSize: [() => queueDisplayPageSize, (value) => { queueDisplayPageSize = value; }],
        gaplessAudioElement: [() => gaplessAudioElement, (value) => { gaplessAudioElement = value; }],
        gaplessActiveElement: [() => gaplessActiveElement, (value) => { gaplessActiveElement = value; }]
    });
}
