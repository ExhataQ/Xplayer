// Temporary spike file (see README.md). Runs as <script type="module"> after the classic scripts and
// records what a module can and cannot do with the app's existing global variables.
import { siblingValue, siblingFn } from './spike-sibling.js';

const results = (window.__spike = { order: window.__spikeOrder || [], checks: {} });
const check = (name, ok, detail) => {
    results.checks[name] = { ok, detail };
};
results.order.push('module');

check('1 module script runs', true, 'readyState=' + document.readyState);
check('2 module imports a sibling file', siblingValue === 'sibling-ok' && siblingFn() === 'sibling-fn-ok', siblingValue);

try {
    const ok = Array.isArray(playbackQueue) && typeof currentView === 'string' && SONGS_DATA.length > 0 &&
        typeof emit === 'function' && typeof on === 'function' && typeof setCurrentView === 'function';
    check('3 module reads classic top-level let/function by bare name', ok,
        `playbackQueue=${typeof playbackQueue} currentView=${currentView} SONGS_DATA=${SONGS_DATA.length}`);
} catch (error) {
    check('3 module reads classic top-level let/function by bare name', false, String(error));
}

try {
    const before = currentView;
    currentView = 'spike-view';
    const worked = currentView === 'spike-view';
    currentView = before;
    check('3b module assigns a classic top-level let', worked, 'direct assignment');
} catch (error) {
    check('3b module assigns a classic top-level let', false, String(error));
}

try {
    const before = currentView;
    setCurrentView('spike-view-2');
    const worked = currentView === 'spike-view-2';
    setCurrentView(before);
    check('3c module calls a core setter', worked, 'setCurrentView');
} catch (error) {
    check('3c module calls a core setter', false, String(error));
}

const moduleOnly = 1;
check('5a module-level const stays private to the module', typeof window.moduleOnly === 'undefined', 'expected: not on window');
window.spikeBridged = () => 'bridged-ok';

document.addEventListener('DOMContentLoaded', () => results.order.push('DOMContentLoaded'));
