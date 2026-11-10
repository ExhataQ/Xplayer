// The filled part of a slider's track. A native range input cannot paint "the part up to the thumb" in a different color, so this puts two numbers on
// each slider, --lo and --hi (0 to 1), and settings.css draws the accent between them. A slider that runs from below zero to above it (the
// equalizer's bands, ReplayGain trim) fills from its zero to the thumb, the way an equalizer shows a boost or a cut; any other fills from its start.
//
//   bindRangeFill(root)  once, on the page that holds the sliders: it follows typing and dragging, and a program that moves a slider says so
//                        by dispatching a 'rangefillupdate' event on it (the equalizer does when a preset moves ten of them).

/** The two ends of the filled part, as fractions of the track: { lo, hi }. Pure. */
export function rangeFill({ min, max, value }) {
    const low = Number(min);
    const high = Number(max);
    const span = high - low || 1;
    const ratio = Math.min(1, Math.max(0, (Number(value) - low) / span));
    const zero = low < 0 && high > 0 ? -low / span : 0;
    return { lo: Math.min(ratio, zero), hi: Math.max(ratio, zero) };
}

export function updateRangeFill(input) {
    const { lo, hi } = rangeFill({ min: input.min === '' ? 0 : input.min, max: input.max === '' ? 100 : input.max, value: input.value });
    input.style.setProperty('--lo', String(lo));
    input.style.setProperty('--hi', String(hi));
}

export function bindRangeFill(root) {
    const follow = (event) => {
        if (event.target instanceof HTMLInputElement && event.target.type === 'range') updateRangeFill(event.target);
    };
    root.addEventListener('input', follow);
    root.addEventListener('rangefillupdate', follow);
    root.querySelectorAll('input[type="range"]').forEach(updateRangeFill);
    // The engine redraws parts of the page (a switch changes, a tab opens): a slider that is new has no --lo/--hi yet and would show no fill.
    const watcher = new MutationObserver((records) => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches('input[type="range"]')) updateRangeFill(node);
                node.querySelectorAll('input[type="range"]').forEach(updateRangeFill);
            }
        }
    });
    watcher.observe(root, { childList: true, subtree: true });
    return () => watcher.disconnect();
}
