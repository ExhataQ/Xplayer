// Notification center and transient toasts (task A-07).
//
// The engine's own history is the source (adapter/notifications-bridge.js), so every `showNotification` call in the engine
// reaches the person twice: as a short toast, and as an entry under "Earlier" behind the title bar bell. Long-running work
// (downloads, album art search) sits under "In progress" with its bar. The bell carries an accent dot while something is
// running or unread. The engine has no way to cancel a download or an art search, so there is no cancel button (BOARD, A-07).

import { el, iconEl, iconButton, button, progress, emptyState, createToaster, hideTooltip } from '../components/index.js';
import { watchNotifications, dismissNotification, clearNotifications } from '../adapter/notifications-bridge.js';

const FAILURE = /\b(fail(ed|ure)?|could not|couldn't|cannot|can't|invalid|no valid|not available|error)\b/i;
const ICON = { success: 'circle-check', error: 'circle-alert', warning: 'triangle-alert', info: 'info' };

// The engine uses its 'error' type for removals too ("Playlist deleted"), so only a failure wording is shown as an error.
export function kindOf({ type, title }) {
    if (type === 'error') return FAILURE.test(title) ? 'error' : 'info';
    if (type === 'success' || type === 'heart') return 'success';
    return type === 'warning' ? 'warning' : 'info';
}

const clock = (time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Builds the popover and the toast region. `bell` is the title bar's icon button. Returns { open, close, destroy }. */
export function mountNotifications(bell) {
    const toaster = createToaster({ host: document.body, max: 3 });
    const clear = button({ label: 'Clear all', variant: 'ghost', size: 'sm', onClick: () => clearNotifications() });
    const body = el('div', { class: 'notif-center__body' });
    const panel = el('div', { class: 'notif-center', role: 'dialog', 'aria-label': 'Notifications', tabindex: '-1', hidden: true, id: 'notification-center' }, el('div', { class: 'notif-center__header' }, el('h2', { class: 'notif-center__title' }, 'Notifications'), clear), body);
    document.body.append(panel);
    bell.setAttribute('aria-haspopup', 'dialog');
    bell.setAttribute('aria-expanded', 'false');
    bell.setAttribute('aria-controls', panel.id);

    let list = [];
    let isOpen = false;
    let shape = '';
    const known = new Set(); // finished entries already shown as a toast (or present at start)
    const seen = new Set(); // finished entries the person has had the chance to read
    const bars = new Map(); // id -> { bar, percent, status } for running rows, updated in place

    function row(n) {
        const kind = kindOf(n);
        const running = n.progress !== null;
        const node = el('li', { class: 'notif', 'data-id': String(n.id), 'data-kind': running ? 'running' : kind });
        node.append(el('span', { class: 'notif__icon' }, iconEl(running ? (/art/i.test(n.title) ? 'image' : 'download') : ICON[kind], { size: 18 })));
        const text = el('div', { class: 'notif__body' }, el('div', { class: 'notif__title', dir: 'auto' }, n.title));
        if (running) {
            const bar = progress({ value: n.progress.percent / 100, label: n.title });
            const status = el('div', { class: 'notif__detail', dir: 'auto' });
            const percent = el('span', { class: 'notif__percent' });
            text.append(bar.el, el('div', { class: 'notif__meta' }, status, percent));
            bars.set(n.id, { bar, status, percent });
        } else {
            if (n.detail) text.append(el('div', { class: 'notif__detail', dir: 'auto' }, n.detail));
            text.append(el('div', { class: 'notif__time' }, clock(n.time)));
        }
        node.append(text);
        if (!running) node.append(iconButton({ icon: 'x', label: 'Dismiss', size: 'sm', tooltip: false, onClick: () => dismissNotification(n.id) }));
        return node;
    }

    function section(title, items) {
        const heading = el('h3', { class: 'notif-section__title' }, title, el('span', { class: 'notif-section__count' }, String(items.length)));
        return el('section', { class: 'notif-section', 'aria-label': title }, heading, el('ul', { class: 'notif-list' }, ...items.map(row)));
    }

    function paintBars() {
        for (const n of list) {
            const parts = n.progress && bars.get(n.id);
            if (!parts) continue;
            parts.bar.set(n.progress.percent / 100);
            parts.status.textContent = n.progress.status;
            parts.percent.textContent = `${Math.round(n.progress.percent)}%`;
        }
    }

    function render() {
        const next = list.map((n) => `${n.id}${n.progress ? 'p' : 'd'}`).join();
        if (next === shape) return paintBars(); // only bars moved: keep the nodes, so focus and the scroll position stay
        const focused = document.activeElement?.closest?.('.notif')?.dataset.id;
        shape = next;
        bars.clear();
        body.replaceChildren();
        const running = list.filter((n) => n.progress);
        const earlier = list.filter((n) => !n.progress);
        if (running.length) body.append(section('In progress', running));
        if (earlier.length) body.append(section('Earlier', earlier));
        if (!list.length) body.append(emptyState({ icon: 'bell-off', title: 'Nothing new', text: 'Confirmations and progress from downloads show up here.' }));
        clear.disabled = earlier.length === 0;
        paintBars();
        if (focused && panel.contains(document.activeElement) === false && isOpen) (body.querySelector(`.notif[data-id="${focused}"] button`) || panel).focus();
    }

    function paintBell() {
        const running = list.filter((n) => n.progress).length;
        const unread = list.filter((n) => !n.progress && !seen.has(n.id)).length;
        const state = [running ? `${running} in progress` : '', unread ? `${unread} unread` : ''].filter(Boolean).join(', ');
        if (running || unread) bell.dataset.dot = running ? 'running' : 'unread';
        else delete bell.dataset.dot;
        bell.setAttribute('aria-label', state ? `Notifications, ${state}` : 'Notifications');
        if (bell.tooltip) bell.tooltip.update({ state });
    }

    function place() {
        const rect = bell.getBoundingClientRect();
        panel.style.top = `${Math.round(rect.bottom + 4)}px`;
        panel.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    }

    function open() {
        if (isOpen) return;
        isOpen = true;
        hideTooltip();
        for (const n of list) if (!n.progress) seen.add(n.id);
        panel.hidden = false;
        place();
        bell.setAttribute('aria-expanded', 'true');
        render();
        paintBell();
        panel.focus();
    }

    function close(restoreFocus = true) {
        if (!isOpen) return;
        isOpen = false;
        panel.hidden = true;
        bell.setAttribute('aria-expanded', 'false');
        if (restoreFocus) bell.focus();
    }

    function update(next) {
        list = next;
        const ids = new Set(list.map((n) => n.id));
        for (const set of [known, seen]) for (const id of set) if (!ids.has(id)) set.delete(id);
        // Several can arrive in one redraw; the list is newest first, so walk it backwards: the newest toast stays on screen.
        for (const n of [...list].reverse()) {
            if (n.progress || known.has(n.id)) continue;
            known.add(n.id);
            if (isOpen) seen.add(n.id);
            else if (!initial) {
                const kind = kindOf(n);
                toaster.show({ id: `n-${n.id}`, kind: kind === 'warning' ? 'info' : kind, title: n.title, message: n.detail });
            }
        }
        if (initial) for (const n of list) if (!n.progress) seen.add(n.id);
        render();
        paintBell();
    }

    let initial = true;
    const stop = watchNotifications(update);
    initial = false;

    bell.addEventListener('click', () => (isOpen ? close() : open()));
    document.addEventListener('pointerdown', (event) => {
        if (isOpen && !panel.contains(event.target) && !bell.contains(event.target)) close(false);
    });
    document.addEventListener('keydown', (event) => {
        if (!isOpen) return;
        if (event.key === 'Escape') {
            event.stopPropagation();
            close();
        }
    });
    window.addEventListener('resize', () => isOpen && place());
    panel.addEventListener('focusout', (event) => {
        if (isOpen && event.relatedTarget && !panel.contains(event.relatedTarget) && event.relatedTarget !== bell) close(false);
    });

    return {
        open,
        close,
        destroy() {
            stop();
            toaster.clear();
            panel.remove();
        }
    };
}
