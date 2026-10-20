// Shared Space rule (task A-08). The engine turns Space into "play or pause" for the whole page (ui/06k) and cancels the
// key, so Space on a focused button pressed nothing: the keyboard user could not use a button, and a dialog's buttons
// toggled playback behind it. The player's controls had a private fix; this is the one rule for every control.
//
// Space presses a focused button, or a control with the role button, tab, radio, switch or checkbox. Enter presses those
// that are not real buttons (a real button already does it). Everything else keeps its behavior: the seek bar and the
// page still play and pause, text fields type a space, menu items and list rows run their own keys. The engine is unchanged.
//
// D37: a control the person just clicked with the mouse is the exception. Click a row's heart and press Space, and the song plays or
// pauses (the page's own Space), as it does in other players; it does not press the heart a second time. The keyboard user, who got to
// the control with Tab, an arrow key or a dialog that put focus there, still presses it. The mouse-clicked control is forgotten when
// focus leaves it.

const PRESSABLE_ROLES = new Set(['button', 'tab', 'radio', 'switch', 'checkbox']);

function pressable(node) {
    if (!(node instanceof HTMLElement) || node.isContentEditable || node.matches('input, textarea, select')) return false;
    const role = node.getAttribute('role');
    return role ? PRESSABLE_ROLES.has(role) : node.tagName === 'BUTTON';
}

/** Starts the rule for the whole page. Returns a function that stops it (for tests). */
export function installSpaceRule(root = window) {
    let clicked = null; // the control the mouse last pressed on, while it still has focus
    const onPointerDown = (event) => {
        clicked = event.target instanceof Element ? event.target.closest('button, [role]') : null;
    };
    const onFocusOut = (event) => {
        if (event.target === clicked) clicked = null;
    };
    const onKeyDown = (event) => {
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
        const node = event.target;
        if (!pressable(node)) return;
        if (node === clicked) return; // D37: Space after a click goes to the page (play or pause)
        const isSpace = event.key === ' ';
        const isEnter = event.key === 'Enter' && node.tagName !== 'BUTTON';
        if (!isSpace && !isEnter) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat && node.getAttribute('aria-disabled') !== 'true') node.click();
    };
    // A real button also clicks when Space is released; the key was already handled on the way down.
    const onKeyUp = (event) => {
        if (event.key === ' ' && pressable(event.target)) {
            event.preventDefault();
            event.stopPropagation();
        }
    };
    root.addEventListener('pointerdown', onPointerDown, true);
    root.addEventListener('focusout', onFocusOut, true);
    root.addEventListener('keydown', onKeyDown, true);
    root.addEventListener('keyup', onKeyUp, true);
    return () => {
        root.removeEventListener('pointerdown', onPointerDown, true);
        root.removeEventListener('focusout', onFocusOut, true);
        root.removeEventListener('keydown', onKeyDown, true);
        root.removeEventListener('keyup', onKeyUp, true);
    };
}
