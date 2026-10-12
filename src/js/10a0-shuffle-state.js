// Shuffle state that other files and core/state-playback-modes.js assign by bare name.
export let shuffleOrder = [];
export let shuffleIndex = 0;
export let shuffleSourceId = null;
export let smartShuffleJourney = [];
export let smartShuffleJourneyIndex = 0;
export let smartShuffleSourceId = null;
export let smartShufflePreviousSong = null;

// Names other files call or read by name (inline handlers, other modules).
// Variables other files read and assign by name: the accessors read and write this file's own variables.
if (typeof registerLegacyState === 'function') {
    registerLegacyState({
        shuffleOrder: [() => shuffleOrder, (value) => { shuffleOrder = value; }],
        shuffleIndex: [() => shuffleIndex, (value) => { shuffleIndex = value; }],
        shuffleSourceId: [() => shuffleSourceId, (value) => { shuffleSourceId = value; }],
        smartShuffleJourney: [() => smartShuffleJourney, (value) => { smartShuffleJourney = value; }],
        smartShuffleJourneyIndex: [() => smartShuffleJourneyIndex, (value) => { smartShuffleJourneyIndex = value; }],
        smartShuffleSourceId: [() => smartShuffleSourceId, (value) => { smartShuffleSourceId = value; }],
        smartShufflePreviousSong: [() => smartShufflePreviousSong, (value) => { smartShufflePreviousSong = value; }]
    });
}
