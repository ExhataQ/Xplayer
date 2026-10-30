// Select modifier (a follow-up to PB-01). While Shift, Ctrl or Cmd is held the person is selecting rows, not following links:
//  - <html data-select="on"> is set, so the artist and album names stop looking like links (no underline, no pointer cursor);
//  - a click on an artist or album name with a modifier held selects its row (Shift: a range, Ctrl or Cmd: toggle) and does not
//    open the artist or album. The engine's name actions stop the click before the row's own selection action can run, so the
//    click is stopped here, in the capture phase, and sent again on the row.
// A double click with a modifier on a name does not play the song either.

const HELD = (event) => Boolean(event.shiftKey || event.ctrlKey || event.metaKey);
const NAMES = '#song-list .song-artist-name, #song-list .song-album-name';

function nameRow(event) {
    const name = event.target instanceof Element ? event.target.closest(NAMES) : null;
    return name ? name.closest('.song-item') : null;
}

/** Starts tracking. Returns a function that stops it and removes the flag. */
export function trackSelectModifier(root = document.documentElement, target = window) {
    const set = (on) => {
        if (on) root.dataset.select = 'on';
        else delete root.dataset.select;
    };
    const sync = (event) => set(HELD(event));
    const clear = () => set(false);
    const onClick = (event) => {
        if (!HELD(event) || !event.isTrusted) return; // not our own click, sent again below
        const row = nameRow(event);
        if (!row) return;
        event.stopImmediatePropagation();
        event.preventDefault();
        const { button, clientX, clientY, shiftKey, ctrlKey, altKey, metaKey, detail, view } = event;
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view, button, clientX, clientY, shiftKey, ctrlKey, altKey, metaKey, detail }));
    };
    const onDouble = (event) => {
        if (HELD(event) && nameRow(event)) event.stopImmediatePropagation();
    };
    const events = [['keydown', sync], ['keyup', sync], ['pointermove', sync], ['pointerdown', sync], ['blur', clear], ['click', onClick], ['dblclick', onDouble]];
    for (const [type, fn] of events) target.addEventListener(type, fn, true);
    return () => {
        for (const [type, fn] of events) target.removeEventListener(type, fn, true);
        delete root.dataset.select;
    };
}
