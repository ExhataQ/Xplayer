// The small controls in the chat box's bottom bar: the mode (how hard the assistant thinks: Low, Medium, High) and the options
// (look up tags online, let the AI read lyrics). Both open a menu above their button. The mode is saved with the AI settings, like the
// model, so it stays after a restart; the options are per session and live in ai-chat.js.

import { el, iconEl, openMenu } from '../../components/index.js';
import { setSettings } from '../../adapter/ai-bridge.js';
import { refreshStatus } from './ai-state.js';

export const MODES = [
    { id: 'low', label: 'Low', hint: 'Fast and brief', icon: 'effort-low' },
    { id: 'medium', label: 'Medium', hint: 'Balanced', icon: 'effort-medium' },
    { id: 'high', label: 'High', hint: 'Thinks longer, more thorough', icon: 'effort-high' }
];
export const DEFAULT_MODE = 'medium';
export const modeInfo = (id) => MODES.find((m) => m.id === id) || MODES.find((m) => m.id === DEFAULT_MODE);

/** The mode button: a bars logo that fills with the level, the level's name, and a menu of the three levels. */
export function createModeButton() {
    let current = DEFAULT_MODE;
    let enabled = true;
    const logo = el('span', { class: 'ai-pill__logo' });
    const label = el('span', { class: 'ai-pill__label' });
    const button = el('button', { type: 'button', class: 'ai-pill ai-pill--mode', 'aria-haspopup': 'menu' }, logo, label, iconEl('chevron-down', { size: 12 }));

    function paint() {
        const info = modeInfo(current);
        logo.replaceChildren(iconEl(info.icon, { size: 14 }));
        label.textContent = info.label;
        button.dataset.mode = info.id;
        button.setAttribute('aria-label', `Mode: ${info.label} (${info.hint}). Change the mode`);
        button.disabled = !enabled;
    }

    async function pick(id) {
        if (id === current) return;
        const before = current;
        current = id;
        paint();
        let saved = null;
        try {
            saved = await setSettings({ mode: id });
        } catch (error) {
            saved = null;
        }
        if (!saved || saved.mode !== id) {
            current = before;
            paint();
            return;
        }
        await refreshStatus();
    }

    button.addEventListener('click', () => {
        openMenu({ anchor: button, above: true, items: [{ type: 'heading', label: 'Mode' }, ...MODES.map((m) => ({ label: `${m.label}: ${m.hint}`, icon: m.icon, checked: m.id === current, radio: true, onSelect: () => pick(m.id) }))] });
    });
    paint();
    return {
        el: button,
        /** Call with the AI status whenever it changes. */
        paint(status) {
            current = modeInfo(status && status.mode).id;
            enabled = Boolean(status && status.hasKey);
            paint();
        }
    };
}

/** The options button: a menu of two switches. `state` is { useWeb, readLyrics }; `onChange(state)` is called after a switch. */
export function createOptionsButton(state, onChange) {
    const button = el('button', { type: 'button', class: 'ai-pill ai-pill--icon', 'aria-haspopup': 'menu', 'aria-label': 'Options' }, iconEl('sliders-horizontal', { size: 14 }));
    const paint = () => {
        const on = [state.useWeb, state.readLyrics].filter(Boolean).length;
        button.dataset.active = on ? 'true' : 'false';
        button.setAttribute('aria-label', on ? `Options (${on} on)` : 'Options');
    };
    button.addEventListener('click', () => {
        openMenu({
            anchor: button,
            above: true,
            items: [
                { type: 'heading', label: 'Options' },
                { label: 'Look up tags online', checked: state.useWeb, keepOpen: true, onSelect: (item) => ((state.useWeb = item.checked), paint(), onChange(state)) },
                { label: 'AI may read lyrics', checked: state.readLyrics, keepOpen: true, onSelect: (item) => ((state.readLyrics = item.checked), paint(), onChange(state)) }
            ]
        });
    });
    paint();
    return { el: button, paint };
}
