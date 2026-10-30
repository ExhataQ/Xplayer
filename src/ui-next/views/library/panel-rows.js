// panel-rows (tasks PB-21, PB-18): the rows the Search and Recents panels draw, one builder for every kind. They look like the
// Library rows (same height, cover size, text sizes, hover). The queue can draw its songs with songRow() too (Agent C adopts it).
//
//   songRow(song, { onActivate, time? })     a song: cover, title, artist, and the time it was played when given
//   itemRow(item, { onActivate })            a playlist, artist or album: cover, name, "n songs"
// Both return an <li>. `song` and `item` are { kind, id, title, subtitle, cover } as the bridges return them.

import { el, iconEl } from '../../components/index.js';
import { defaultCover } from '../../adapter/default-cover.js';

function cover(src, kind) {
    const fallback = defaultCover(kind);
    const wrapper = el('span', { class: `plist-row__cover plist-row__cover--${kind}` });
    const image = el('img', { src: src || fallback, alt: '', loading: 'lazy', draggable: 'false' });
    image.addEventListener('error', () => {
        if (image.getAttribute('src') !== fallback) image.setAttribute('src', fallback);
    });
    wrapper.append(image);
    return wrapper;
}

function row(item, { onActivate, time = '', trailing = null } = {}) {
    const text = el('span', { class: 'plist-row__text' }, el('span', { class: 'plist-row__title', dir: 'auto' }, item.title), el('span', { class: 'plist-row__sub', dir: 'auto' }, item.subtitle || ''));
    const button = el('button', { type: 'button', class: 'plist-row', 'data-kind': item.kind }, cover(item.cover, item.kind), text, time ? el('time', { class: 'plist-row__time' }, time) : '');
    button.addEventListener('click', () => onActivate && onActivate(item));
    return el('li', { class: 'plist-item', 'data-kind': item.kind }, button, trailing || '');
}

export const songRow = (song, options) => row(song, options);
export const itemRow = (item, options) => row(item, options);

/** The small arrow button on a row that opens a list of songs under it (Recents). */
export function toggleButton(label, expanded, onToggle) {
    const button = el('button', { type: 'button', class: 'plist-toggle', 'aria-expanded': String(expanded), 'aria-label': label }, iconEl(expanded ? 'chevron-down' : 'chevron-right', { size: 16 }));
    button.addEventListener('click', onToggle);
    return button;
}
