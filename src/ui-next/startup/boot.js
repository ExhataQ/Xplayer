// Boot screen (task A-09): shows the startup view from the first paint until the app is ready, then fades it out.
//
// The renderer's own start-up is short (the library scan that can take long runs in the main process, behind Electron's loading window),
// so the stages below are real milestones, not an estimate:
//
//   10  Starting               the shell has started
//   40  Loading your library   the engine's modules have run (its globals exist)
//   80  Drawing your songs     the page has loaded: the engine's own start-up handler has run
//   100 Ready                  two frames later, the first picture of the app is on screen
//
// It never blocks the app: it stays at least MIN_VISIBLE_MS so it does not flash, it gives up after WATCHDOG_MS, and a CSS fallback in
// startup.css moves it away after 30 s even if this file never runs. While it fades it lets clicks through.

import { createStartup, resolveStartupVariant } from './startup.js';
import { readStartupPreference } from '../adapter/startup-bridge.js';
import { whenViewsReady } from '../adapter/songlist-bridge.js';

export const MIN_VISIBLE_MS = 450;
export const WATCHDOG_MS = 20000;
export const STAGES = Object.freeze([
    { percent: 10, text: 'Starting' },
    { percent: 40, text: 'Loading your library' },
    { percent: 80, text: 'Drawing your songs' },
    { percent: 100, text: 'Ready' }
]);

const frames = (count) => new Promise((resolve) => (function tick(left) { left ? requestAnimationFrame(() => tick(left - 1)) : resolve(); })(count));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the boot screen in `host`. `engineReady` and `pageLoaded` are promises (the caller decides what they mean; startBoot passes the real
 * ones). Returns { finish, done }: `done` resolves when the screen is gone. Exposed apart from startBoot so a test can drive it.
 */
export function createBoot({ host, variant, engineReady, pageLoaded, minVisible = MIN_VISIBLE_MS, watchdog = WATCHDOG_MS }) {
    document.body.dataset.starting = 'true';
    host.dataset.state = 'booting';
    const view = createStartup(host, { variant, controls: false, label: STAGES[0].text });
    const shownAt = performance.now();
    let stage = -1;
    let finishing = null;

    const advance = (index) => {
        if (index <= stage) return; // never backwards
        stage = index;
        view.setProgress(STAGES[index].percent, STAGES[index].text);
    };

    function finish() {
        if (finishing) return finishing;
        finishing = (async () => {
            advance(STAGES.length - 1);
            await wait(Math.max(0, minVisible - (performance.now() - shownAt)));
            host.dataset.state = 'leaving'; // clicks go through while it fades
            delete document.body.dataset.starting;
            await view.finish();
            host.replaceChildren();
            host.dataset.state = 'done';
        })();
        return finishing;
    }

    advance(0);
    engineReady.then(() => advance(1));
    pageLoaded.then(async () => {
        advance(2);
        await frames(2);
        finish();
    });
    setTimeout(finish, watchdog);
    return { finish, get done() { return finishing; } };
}

/** The real boot: the saved background, the engine's readiness and the page's load. Returns null when the page has no #startup host. */
export function startBoot() {
    const host = document.getElementById('startup');
    if (!host) return null;
    const engineReady = new Promise((resolve) => whenViewsReady(resolve));
    const pageLoaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    return createBoot({ host, variant: resolveStartupVariant(readStartupPreference()), engineReady, pageLoaded });
}
