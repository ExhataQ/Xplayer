// The visualizer's door to the engine's audio bus (src/js/playback/15h-equalizer.js). Views never call engine globals themselves; this does.
//
//   startAnalyser() -> boolean       asks the engine to hang an analyser on the bus; false when it cannot (a plain browser, Web Audio failed)
//   stopAnalyser()                   takes it off again
//   getAnalyser() -> AnalyserNode|null

export function startAnalyser() {
    return typeof window.setVisualizerActive === 'function' ? window.setVisualizerActive(true) === true : false;
}

export function stopAnalyser() {
    if (typeof window.setVisualizerActive === 'function') window.setVisualizerActive(false);
}

export function getAnalyser() {
    return typeof window.getVisualizerAnalyser === 'function' ? window.getVisualizerAnalyser() : null;
}
