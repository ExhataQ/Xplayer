// Player-control, queue-paging and gapless-playback state that the setters in core/state-*.js assign by bare name.
let showRemainingTime = false;
let wasPlaying = false;
let repeatVisualState = 0;
let repeatFunctionalityActive = false;
let queueDisplayLimit = 50;
let queueDisplayPageSize = 25;
let gaplessAudioElement = new Audio();
gaplessAudioElement.preload = 'auto';
let gaplessActiveElement = audioElement;
