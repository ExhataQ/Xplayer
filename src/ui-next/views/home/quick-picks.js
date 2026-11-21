// Quick picks (design board A): a grid of small tiles (cover and name) for the playlists and albums the person plays most recently, one
// click from playing or opening. Plain data in, like a shelf: items are { kind, id, title, cover }.
import { el } from '../../components/index.js';
import { defaultCover } from '../../adapter/default-cover.js';

function tile(item, onOpen) {
    const fallback = defaultCover(item.kind);
    const image = el('img', { src: item.cover || fallback, alt: '', loading: 'lazy', draggable: 'false' });
    image.addEventListener('error', () => {
        if (image.getAttribute('src') !== fallback) image.setAttribute('src', fallback);
    });
    return el('button', { type: 'button', class: 'quick-tile', onclick: () => onOpen(item) }, el('span', { class: 'quick-tile__cover', 'aria-hidden': 'true' }, image), el('span', { class: 'quick-tile__title', dir: 'auto' }, item.title));
}

export function quickPicks({ items, onOpen }) {
    return el('section', { class: 'quick-picks', dataset: { quickPicks: '' }, 'aria-label': 'Quick picks' }, ...items.map((item) => tile(item, onOpen)));
}
