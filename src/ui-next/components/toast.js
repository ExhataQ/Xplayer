// Transient toasts for short confirmations and minor errors. Long-running work belongs in the status area and the
// notification center (task A-07), not here.
// States: info, success, error. Pauses its timer while hovered or focused. Errors use role="alert", the rest role="status".
import { el, iconEl } from './dom.js';
import { button, iconButton } from './button.js';

const DURATION = { info: 4000, success: 4000, error: 8000 };
const ICON = { info: 'info', success: 'circle-check', error: 'circle-alert' };

/**
 * Creates the toast region. Returns { show, dismiss, clear, el }.
 * show({ id?, kind, title, message?, action?: { label, onClick }, duration? }) returns the toast id.
 *   - Showing an id that is already on screen updates it in place (no stacking of repeats).
 *   - `duration: 0` keeps it until dismissed. A toast with an action never closes by itself faster than 8 s.
 *   - At most `max` are visible; the oldest goes first.
 * `onDismiss(toast, reason)` reports 'timeout', 'user', 'action', 'replaced' or 'cleared': the notification center uses it later.
 */
export function createToaster({ host = document.body, max = 3, onDismiss } = {}) {
    const region = el('div', { class: 'toaster', role: 'region', 'aria-label': 'Notifications' });
    host.append(region);
    const live = new Map();
    let seq = 0;

    function remove(id, reason) {
        const entry = live.get(id);
        if (!entry) return;
        clearTimeout(entry.timer);
        live.delete(id);
        entry.node.remove();
        if (onDismiss) onDismiss(entry.data, reason);
    }

    function show(data) {
        const { kind = 'info', title, message = '', action } = data;
        if (!title) throw new Error('toast needs a title');
        const id = data.id || `toast-${(seq += 1)}`;
        const duration = data.duration ?? (action ? Math.max(DURATION[kind], 8000) : DURATION[kind]);
        if (live.has(id)) remove(id, 'replaced');

        const close = iconButton({ icon: 'x', label: 'Dismiss', size: 'sm', tooltip: false, onClick: () => remove(id, 'user') });
        const actionButton = action
            ? button({
                  label: action.label,
                  variant: 'outline',
                  size: 'sm',
                  onClick: () => {
                      remove(id, 'action');
                      if (action.onClick) action.onClick();
                  }
              })
            : null;
        const node = el(
            'div',
            { class: 'toast', role: kind === 'error' ? 'alert' : 'status', 'data-kind': kind },
            el('span', { class: 'toast__icon' }, iconEl(ICON[kind], { size: 18 })),
            el('div', { class: 'toast__body' }, el('div', { class: 'toast__title', dir: 'auto' }, title), message ? el('div', { class: 'toast__message', dir: 'auto' }, message) : '', actionButton ? el('div', { class: 'toast__actions' }, actionButton) : ''),
            close
        );

        const entry = { node, data: { id, kind, title, message }, timer: 0, remaining: duration, started: 0 };
        const arm = () => {
            clearTimeout(entry.timer);
            if (!entry.remaining) return;
            entry.started = performance.now();
            entry.timer = setTimeout(() => remove(id, 'timeout'), entry.remaining);
        };
        const pause = () => {
            if (!entry.timer) return;
            clearTimeout(entry.timer);
            entry.timer = 0;
            entry.remaining = Math.max(1000, entry.remaining - (performance.now() - entry.started));
        };
        node.addEventListener('pointerenter', pause);
        node.addEventListener('pointerleave', arm);
        node.addEventListener('focusin', pause);
        node.addEventListener('focusout', arm);

        live.set(id, entry);
        region.append(node);
        while (live.size > max) remove(live.keys().next().value, 'replaced');
        arm();
        return id;
    }

    return {
        el: region,
        show,
        dismiss: (id) => remove(id, 'user'),
        clear() {
            for (const id of [...live.keys()]) remove(id, 'cleared');
        }
    };
}
