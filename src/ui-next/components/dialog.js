// Dialog on the native <dialog> element: the page behind is inert, Escape closes it and focus returns to the element
// that opened it. Tab is wrapped inside the dialog by a small handler below.
// States: default, busy (an action is running), error (an action failed and the dialog stays open), non-dismissible.
import { el, iconEl, uid, append } from './dom.js';
import { button, iconButton, setLoading } from './button.js';

/**
 * openDialog({ title, body, actions, wide?, dismissible? }) resolves with the `value` of the action that was chosen,
 * or `null` when the dialog was dismissed (Escape, the close button, a click on the backdrop).
 *
 * actions: [{ label, value, variant?, icon?, autofocus?, onClick? }]. `onClick` may be async: while it runs the
 * button shows a spinner and the other actions are disabled. If it throws, the message is shown in the dialog and
 * the dialog stays open; if it returns, the dialog closes with `value`. Return `false` to keep it open without an error.
 * Destructive actions use variant 'danger'; the focus starts on the action marked `autofocus`, else on the first
 * non-danger action, else on the close button.
 */
export function openDialog({ title, body = '', actions = [], wide = false, dismissible = true, host = document.body } = {}) {
    if (!title) throw new Error('dialog needs a title');
    const titleId = uid('dialog-title');
    const bodyId = uid('dialog-body');
    const dialog = el('dialog', { class: `dialog${wide ? ' dialog--wide' : ''}`, 'aria-labelledby': titleId, 'aria-describedby': bodyId });
    const error = el('div', { class: 'dialog__error', role: 'alert', hidden: true });
    const closeButton = dismissible ? iconButton({ icon: 'x', label: 'Close', tooltip: false, onClick: () => dialog.close() }) : '';
    const bodyBox = el('div', { class: 'dialog__body', id: bodyId, dir: 'auto' });
    append(bodyBox, [body]);

    let result = null;
    let resolveDialog;
    const done = new Promise((resolve) => (resolveDialog = resolve));
    const finish = (value) => {
        result = value;
        dialog.close();
    };

    const buttons = actions.map((action) => {
        const node = button({
            label: action.label,
            icon: action.icon,
            variant: action.variant || 'outline',
            onClick: async () => {
                if (!action.onClick) return finish(action.value ?? action.label);
                busy(node, true);
                error.hidden = true;
                try {
                    const result = await action.onClick();
                    if (result !== false) finish(action.value ?? action.label);
                } catch (problem) {
                    error.replaceChildren(iconEl('circle-alert', { size: 16 }), document.createTextNode(problem && problem.message ? problem.message : 'Something went wrong. Try again.'));
                    error.hidden = false;
                } finally {
                    busy(node, false);
                }
            }
        });
        return node;
    });
    const busy = (active, on) => {
        setLoading(active, on);
        for (const node of buttons) if (node !== active) node.disabled = on;
        if (closeButton) closeButton.disabled = on;
    };

    dialog.append(
        el('div', { class: 'dialog__header' }, el('h2', { class: 'dialog__title', id: titleId, dir: 'auto' }, title), closeButton),
        bodyBox,
        error,
        buttons.length ? el('div', { class: 'dialog__footer' }, ...buttons) : ''
    );

    // The browser keeps focus in the page behind a modal dialog but lets Tab leave it for the window controls, so wrap it here.
    dialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const items = [...dialog.querySelectorAll('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && !n.hidden && n.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) (event.preventDefault(), last.focus());
        else if (!event.shiftKey && document.activeElement === last) (event.preventDefault(), first.focus());
    });
    dialog.addEventListener('cancel', (event) => {
        if (!dismissible || dialog.querySelector('[aria-busy="true"]')) event.preventDefault();
    });
    dialog.addEventListener('close', () => {
        dialog.remove();
        resolveDialog(result);
    });
    if (dismissible) {
        // only a press that starts and ends on the backdrop closes it, so dragging a text selection out of a field does not
        let downOnBackdrop = false;
        dialog.addEventListener('pointerdown', (event) => (downOnBackdrop = event.target === dialog));
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog && downOnBackdrop && !dialog.querySelector('[aria-busy="true"]')) dialog.close();
        });
    }
    host.append(dialog);
    dialog.showModal();
    const start = buttons[actions.findIndex((a) => a.autofocus)] || buttons[actions.findIndex((a) => a.variant !== 'danger')] || closeButton || dialog;
    start.focus();
    return done;
}

/** Confirm question. Resolves true or false. Destructive confirmations put Cancel first in focus. */
export function confirmDialog({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false } = {}) {
    return openDialog({
        title,
        body: message,
        actions: [
            { label: cancelLabel, value: false, autofocus: destructive },
            { label: confirmLabel, value: true, variant: destructive ? 'danger' : 'primary' }
        ]
    }).then((value) => value === true);
}
