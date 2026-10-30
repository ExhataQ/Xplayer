// Shelf (task PB-15): one titled, horizontally scrolling row of cards. The row fades out on each side that still has more
// to scroll to (the fade is a CSS mask driven by data-fade-start and data-fade-end), and the two arrows page the row for
// people without a horizontal wheel. Cards are plain data ({ kind, title, subtitle, cover }), so any list can be a shelf.
import { el, iconButton } from '../../components/index.js';
import { defaultCover } from '../../adapter/default-cover.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function card(item, onOpen) {
    const cover = el('span', { class: 'shelf-card__cover', 'aria-hidden': 'true' });
    const fallback = defaultCover(item.kind); // no cover, or one that cannot load: the default cover for this kind of item
    const image = el('img', { src: item.cover || fallback, alt: '', loading: 'lazy', draggable: 'false' });
    image.addEventListener('error', () => {
        if (image.getAttribute('src') !== fallback) image.setAttribute('src', fallback);
    });
    cover.append(image);
    return el(
        'div',
        { class: 'shelf__item', role: 'listitem' },
        el(
            'button',
            { type: 'button', class: `shelf-card shelf-card--${item.kind}`, onclick: () => onOpen(item) },
            cover,
            el('span', { class: 'shelf-card__title', dir: 'auto' }, item.title),
            item.subtitle ? el('span', { class: 'shelf-card__sub', dir: 'auto' }, item.subtitle) : ''
        )
    );
}

export function shelf({ id, title, items, onOpen }) {
    const row = el('div', { class: 'shelf__row', role: 'list', 'aria-labelledby': `shelf-${id}-title` }, ...items.map((item) => card(item, onOpen)));
    const page = (dir) => row.scrollBy({ left: dir * row.clientWidth * 0.8, behavior: reduced() ? 'auto' : 'smooth' });
    const back = iconButton({ icon: 'chevron-left', label: `Scroll ${title} back`, size: 'sm', tooltip: false, onClick: () => page(-1) });
    const forward = iconButton({ icon: 'chevron-right', label: `Scroll ${title} forward`, size: 'sm', tooltip: false, onClick: () => page(1) });
    const root = el(
        'section',
        { class: 'shelf', dataset: { shelf: id } },
        el('header', { class: 'shelf__head' }, el('h2', { class: 'shelf__title', id: `shelf-${id}-title` }, title), el('div', { class: 'shelf__pager' }, back, forward)),
        row
    );

    let queued = false;
    function paint() {
        queued = false;
        const max = row.scrollWidth - row.clientWidth;
        const atStart = row.scrollLeft <= 1;
        const atEnd = row.scrollLeft >= max - 1;
        root.dataset.fadeStart = String(!atStart);
        root.dataset.fadeEnd = String(max > 1 && !atEnd);
        root.dataset.overflow = String(max > 1);
        back.disabled = atStart;
        forward.disabled = atEnd;
    }
    const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
    };
    row.addEventListener('scroll', schedule, { passive: true });
    new ResizeObserver(schedule).observe(row);
    return root;
}
