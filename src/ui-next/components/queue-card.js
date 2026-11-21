// The queue card's markup: the pop-up box with a header ("Queue", a close button) and a scrolling body, shared by the full app's queue
// (views/playback/queue-panel.js) and the Quick Player's (light/light.js). Its look, size and place are components/queue-card.css.
// The caller puts the rows in `body` and shows or hides `panel` (the hidden attribute).
//
//   createQueueCard({ id, label, title, closeLabel, onClose })  ->  { panel, body, scroll, closeButton }

import { el } from './dom.js';
import { iconButton } from './button.js';
import { scrollShadow } from './scroll-shadow.js';

export function createQueueCard({ id, label = 'Queue', title = 'Queue', closeLabel = 'Close queue', onClose = () => {} } = {}) {
    const body = el('div', { class: 'queue-panel__body' });
    // The body scrolls; its wrapper does not, so the shadows can sit over the wrapper's top and bottom edges (under the header, over the
    // rounded bottom) and stay put while the rows move: the top one while the list is scrolled down, the bottom one while more is below.
    const scroll = el('div', { class: 'queue-panel__scroll scroll-shadow--overlay scroll-shadow--bottom' }, body);
    scrollShadow(scroll, '.queue-panel__body', { bottom: true });
    const closeButton = iconButton({ icon: 'x', label: closeLabel, size: 'sm', tooltip: false, onClick: () => onClose() });
    const panel = el(
        'section',
        { class: 'queue-panel', id, 'aria-label': label, hidden: true },
        el('header', { class: 'queue-panel__header' }, el('h2', { class: 'queue-panel__title' }, title), closeButton),
        scroll
    );
    return { panel, body, scroll, closeButton };
}
