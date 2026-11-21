// Whether the Library health view has its own button in the rail (next to Metadata). Off by default: checking the library is not an everyday job, so the
// page is opened from Settings > Library, and the person may put it in the rail. The choice is kept in this browser's storage; the rail button
// (shell.js) follows it at once, without a restart. The choice made when this page was still called Duplicates is read once and carried over.

const KEY = 'xplayer.ui-next.healthRail';
const OLD_KEY = 'xplayer.ui-next.duplicatesRail';
const EVENT = 'xplayer:health-rail';

export function healthInRail() {
    try {
        const own = localStorage.getItem(KEY);
        return (own === null ? localStorage.getItem(OLD_KEY) : own) === 'on';
    } catch (e) {
        return false;
    }
}

export function setHealthInRail(on) {
    try {
        localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch (e) {
        /* the choice lasts until the page is closed */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: Boolean(on) }));
}

/** Keeps `button` (the rail button) shown or hidden with the choice. Answers the function that stops it. */
export function followHealthRail(button) {
    const sync = () => {
        button.hidden = !healthInRail();
    };
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
}
