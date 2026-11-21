// Empty, loading and error state for any view or panel. The headline uses the serif face (DIRECTION.md, Type).
import { el, iconEl } from './dom.js';
import { button } from './button.js';

/**
 * state: 'empty' | 'loading' | 'error'. actions: [{ label, icon?, variant?, onClick }], at most three.
 * Loading shows a spinner instead of the icon. Error says what happened in `text` and should offer a next step as an action.
 */
export function emptyState({ state = 'empty', icon = 'list-music', title, text = '', actions = [] } = {}) {
    if (!title) throw new Error('emptyState needs a title');
    if (actions.length > 3) throw new Error('emptyState shows at most three actions');
    const mark = state === 'loading' ? el('span', { class: 'spinner', 'aria-hidden': 'true' }) : iconEl(state === 'error' ? 'circle-alert' : icon, { size: 28 });
    return el(
        'div',
        { class: 'empty-state', 'data-state': state, role: state === 'error' ? 'alert' : state === 'loading' ? 'status' : null, 'aria-busy': state === 'loading' ? 'true' : null },
        el('div', { class: 'empty-state__mark' }, mark),
        el('h2', { class: 'empty-state__title', dir: 'auto' }, title),
        text ? el('p', { class: 'empty-state__text', dir: 'auto' }, text) : '',
        actions.length
            ? el(
                  'div',
                  { class: 'empty-state__actions' },
                  ...actions.map((a, i) => button({ label: a.label, icon: a.icon, variant: a.variant || (i === 0 ? 'primary' : 'outline'), onClick: a.onClick }))
              )
            : ''
    );
}
