// The theme choice in Settings, Appearance: the two main choices (Dark and Light), then "More themes": a grid of cards, each with a simple
// copy of the app in the theme's colors, ending with a "Custom" card for the theme the person builds (shell/theme-builder.js).
// One radio group: exactly one card is on.
import { el, iconEl, iconButton } from '../components/index.js';
import { THEMES, MAIN_THEMES, CUSTOM_ID } from './appearance.js';

// A simple copy of the app, drawn by CSS from the theme's preview colors (appearance.css, .tp-*): rail, library panel, main view, right panel, player bar.
const part = (kind, ...kids) => el('span', { class: kind }, ...kids);
const song = (on) => part(on ? 'tp-row tp-row--on' : 'tp-row', part('tp-cover'), part('tp-text', part(on ? 'tp-line tp-line--accent' : 'tp-line'), part('tp-line tp-line--dim')));
export function preview() {
    return el(
        'span',
        { class: 'theme-card__preview', 'aria-hidden': 'true' },
        part('tp-title', part('tp-logo'), part('tp-dot tp-end'), part('tp-dot'), part('tp-dot')),
        part('tp-rail', part('tp-icon'), part('tp-icon tp-icon--on'), part('tp-icon')),
        part('tp-lib', part('tp-head'), song(true), song(false)),
        part('tp-main', part('tp-hero', part('tp-cover'), part('tp-hero-text', part('tp-big'), part('tp-play'))), song(false)),
        part('tp-side', part('tp-art'), part('tp-lyric tp-lyric--on'), part('tp-lyric'), part('tp-lyric')),
        part('tp-player', part('tp-now', part('tp-cover'), part('tp-text', part('tp-line'), part('tp-line tp-line--dim'))), part('tp-center', part('tp-play'), part('tp-track')), part('tp-track tp-track--vol'))
    );
}

/**
 * { value, onChange(id), custom: () => colors | null }. Returns { el, setValue(id), setCustom(colors | null) }.
 * `colors` is { ground, surface, accent } (hex); null draws the empty "Custom" card.
 */
export function themePicker({ value, onChange, label = 'Theme' }) {
    const main = el('div', { class: 'theme-grid theme-grid--main' });
    const more = el('div', { class: 'theme-grid' });
    const root = el('div', { class: 'theme-picker', role: 'radiogroup', 'aria-label': label }, main, el('div', { class: 'theme-picker__more appearance__title' }, 'More themes'), more);
    const cards = new Map();
    const add = (id, name, extra, into = more) => {
        const check = el('span', { class: 'theme-card__check', 'aria-hidden': 'true' }, iconEl('check', { size: 12 }));
        const card = el('button', { type: 'button', class: 'theme-card', role: 'radio', 'aria-checked': 'false', 'data-theme-id': id, tabindex: '-1' }, preview(), el('span', { class: 'theme-card__name' }, name), check);
        if (extra) card.dataset.kind = extra;
        card.addEventListener('click', () => select(id, true));
        cards.set(id, card);
        into.append(card);
        return card;
    };
    for (const theme of MAIN_THEMES) add(theme.id, theme.label, undefined, main);
    for (const theme of THEMES) if (!MAIN_THEMES.some((m) => m.id === theme.id)) add(theme.id, theme.label);
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
            for (const name of ['ground', 'surface', 'accent', 'ink']) {
                if (colors && colors[name]) custom.style.setProperty(`--sw-${name}`, colors[name]);
                else custom.style.removeProperty(`--sw-${name}`);
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
    for (const name of ['ground', 'surface', 'accent', 'ink']) if (colors[name]) card.style.setProperty(`--sw-${name}`, colors[name]);
    card.addEventListener('click', onApply);
    const rename = iconButton({ icon: 'pencil', label: `Rename ${name}`, size: 'sm', onClick: onRename });
    const remove = iconButton({ icon: 'trash-2', label: `Delete ${name}`, size: 'sm', onClick: onDelete });
    return el('div', { class: 'theme-card-wrap', 'data-current': String(Boolean(current)) }, card, el('div', { class: 'theme-card__tools' }, rename, remove));
}
