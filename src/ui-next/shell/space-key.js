// Shared Space rule (task A-08). The engine turns Space into "play or pause" for the whole page (ui/06k) and cancels the
// key, so Space on a focused button pressed nothing: the keyboard user could not use a button, and a dialog's buttons
// toggled playback behind it. The player's controls had a private fix; this is the one rule for every control.
//
// Space presses a focused button, or a control with the role button, tab, radio, switch or checkbox. Enter presses those
// that are not real buttons (a real button already does it). Everything else keeps its behavior: the seek bar and the
// page still play and pause, text fields type a space, menu items and list rows run their own keys. The engine is unchanged.

const PRESSABLE_ROLES = new Set(['button', 'tab', 'radio', 'switch', 'checkbox']);

function pressable(node) {
    if (!(node instanceof HTMLElement) || node.isContentEditable || node.matches('input, textarea, select')) return false;
    const role = node.getAttribute('role');
    return role ? PRESSABLE_ROLES.has(role) : node.tagName === 'BUTTON';
}

/** Starts the rule for the whole page. Returns a function that stops it (for tests). */
export function installSpaceRule(root = window) {
    const onKeyDown = (event) => {
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
        const node = event.target;
        if (!pressable(node)) return;
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
    root.addEventListener('keydown', onKeyDown, true);
    root.addEventListener('keyup', onKeyUp, true);
    return () => {
        root.removeEventListener('keydown', onKeyDown, true);
        root.removeEventListener('keyup', onKeyUp, true);
    };
}
