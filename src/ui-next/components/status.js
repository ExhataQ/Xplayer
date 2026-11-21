// Status indicator (idle, running, success, error) and progress bar. Each state has an icon or shape and a text
// label, so color is never the only signal.
import { el, iconEl } from './dom.js';

const STATES = ['idle', 'running', 'success', 'error'];

function mark(state) {
    if (state === 'running') return el('span', { class: 'spinner', 'aria-hidden': 'true' });
    if (state === 'success') return iconEl('check', { size: 16 });
    if (state === 'error') return iconEl('circle-alert', { size: 16 });
    return el('span', { class: 'status__dot', 'aria-hidden': 'true' });
}

/** Returns { el, set(state, label) }. The label is real text, announced politely when it changes. */
export function statusIndicator({ state = 'idle', label = '' } = {}) {
    const markBox = el('span', { class: 'status__mark' });
    const text = el('span', { class: 'status__label', dir: 'auto' });
    const root = el('span', { class: 'status', role: 'status' }, markBox, text);
    const api = {
        el: root,
        set(next, nextLabel) {
            if (!STATES.includes(next)) throw new Error(`Unknown status state: ${next}`);
            root.dataset.state = next;
            markBox.replaceChildren(mark(next));
            if (nextLabel !== undefined) text.textContent = nextLabel;
        }
    };
    api.set(state, label);
    return api;
}

/**
 * value 0..1, or null for work whose length is unknown. Returns { el, set(value, { error }) }.
 * `label` is the accessible name (for example "Scanning music folders").
 */
export function progress({ value = null, label } = {}) {
    const bar = el('div', { class: 'progress__bar' });
    const root = el('div', { class: 'progress', role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar);
    const api = {
        el: root,
        set(next, { error = false } = {}) {
            const known = typeof next === 'number' && !Number.isNaN(next);
            root.dataset.indeterminate = String(!known);
            root.dataset.state = error ? 'error' : 'running';
            if (known) {
                const pct = Math.round(Math.min(1, Math.max(0, next)) * 100);
                root.setAttribute('aria-valuenow', String(pct));
                root.style.setProperty('--progress-value', `${pct}%`);
            } else {
                root.removeAttribute('aria-valuenow');
                root.style.removeProperty('--progress-value');
            }
        }
    };
    api.set(value);
    return api;
}
