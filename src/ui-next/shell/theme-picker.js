// The theme choice in Settings, Appearance: a grid of cards, each with a small picture of the theme (its background, panels and accent),
// then a "Custom" card for the theme the person builds (shell/theme-builder.js). One radio group: exactly one card is on.
import { el, iconEl, iconButton } from '../components/index.js';
import { THEMES, CUSTOM_ID } from './appearance.js';

export function preview() {
    return el(
        'span',
        { class: 'theme-card__preview', 'aria-hidden': 'true' },
        el('span', { class: 'theme-card__rail' }),
        el('span', { class: 'theme-card__body' }, el('span', { class: 'theme-card__line theme-card__line--accent' }), el('span', { class: 'theme-card__line' }), el('span', { class: 'theme-card__line theme-card__line--short' }))
    );
}

/**
 * { value, onChange(id), custom: () => colors | null }. Returns { el, setValue(id), setCustom(colors | null) }.
 * `colors` is { ground, surface, accent } (hex); null draws the empty "Custom" card.
 */
export function themePicker({ value, onChange, label = 'Theme' }) {
    const root = el('div', { class: 'theme-grid', role: 'radiogroup', 'aria-label': label });
    const cards = new Map();
    const add = (id, name, extra) => {
        const check = el('span', { class: 'theme-card__check', 'aria-hidden': 'true' }, iconEl('check', { size: 12 }));
        const card = el('button', { type: 'button', class: 'theme-card', role: 'radio', 'aria-checked': 'false', 'data-theme-id': id, tabindex: '-1' }, preview(), el('span', { class: 'theme-card__name' }, name), check);
        if (extra) card.dataset.kind = extra;
        card.addEventListener('click', () => select(id, true));
        cards.set(id, card);
        root.append(card);
        return card;
    };
    for (const theme of THEMES) add(theme.id, theme.label);
    const custom = add(CUSTOM_ID, 'Custom', 'custom');

    function select(id, notify) {
        const changed = !cards.get(id) || cards.get(id).getAttribute('aria-checked') !== 'true';
        for (const [key, card] of cards) {
            card.setAttribute('aria-checked', String(key === id));
            card.tabIndex = key === id ? 0 : -1;
        }
        if (changed && notify && onChange) onChange(id);
    }
    root.addEventListener('keydown', (event) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (!(event.key in keys)) return;
        const list = [...cards.values()];
        const at = list.findIndex((card) => card === document.activeElement);
        if (at < 0) return;
        event.preventDefault();
        const next = list[(at + keys[event.key] + list.length) % list.length];
        next.focus();
        select(next.dataset.themeId, true);
    });
    select(cards.has(value) ? value : THEMES[0].id, false);

    return {
        el: root,
        setValue: (id) => cards.has(id) && select(id, false),
        setCustom(colors) {
            custom.toggleAttribute('data-empty', !colors);
            for (const part of ['ground', 'surface', 'accent']) {
                if (colors) custom.style.setProperty(`--sw-${part}`, colors[part]);
                else custom.style.removeProperty(`--sw-${part}`);
            }
        }
    };
}

/**
 * A saved theme as a card: click applies it; below it, a pencil renames it and a bin deletes it (only the themes the person made have them).
 * `current` marks the one that is on now.
 * `colors` is { ground, surface, accent } (hex); the picture is drawn from them.
 */
export function savedThemeCard({ name, colors, current, onApply, onRename, onDelete }) {
    const card = el('button', { type: 'button', class: 'theme-card', 'aria-pressed': String(Boolean(current)), 'aria-label': name }, preview(), el('span', { class: 'theme-card__name' }, name));
    for (const part of ['ground', 'surface', 'accent']) card.style.setProperty(`--sw-${part}`, colors[part]);
    card.addEventListener('click', onApply);
    const rename = iconButton({ icon: 'pencil', label: `Rename ${name}`, size: 'sm', onClick: onRename });
    const remove = iconButton({ icon: 'trash-2', label: `Delete ${name}`, size: 'sm', onClick: onDelete });
    return el('div', { class: 'theme-card-wrap', 'data-current': String(Boolean(current)) }, card, el('div', { class: 'theme-card__tools' }, rename, remove));
}
