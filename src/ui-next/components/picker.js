// Picker: a search field over a list to choose from (used by "Add to playlist"; any "pick one of many" can use it).
// Keyboard: type to filter, Up and Down move, Home and End jump, Enter chooses, Escape closes. Typing here never reaches the player's shortcuts.
//
// Two ways to show it, one set of options:
//   mountPicker(host, options)  draws it inside `host` (for example the submenu of a menu item, which already floats, hovers and closes with its menu)
//   openPicker(options)         draws it floating at `rect` (beside a menu) or `point` {x, y}; a press outside closes it
//
// options: { label, placeholder, items, actions, empty, onPick, onDone }
//   label        the accessible name of the list
//   items(query)   -> [{ id, label, mark? }]   the list for the text typed; `mark` draws a check (already chosen)
//   actions(query) -> [{ id, label, icon? }]   rows above the list that always show (for example "Add to new playlist")
//   empty(query)   -> text shown when the list is empty
//   onPick(row, query) -> 'keep' keeps it open and draws it again (the list may have changed); anything else finishes
//   onDone()       called when it finishes (a choice was made, or Escape): the owner closes whatever holds it
// Both return { el, focus(), refresh(), close() }.
import { el, iconEl, overlayHost, clampToViewport } from './dom.js';

function build({ label, placeholder = 'Search', items, actions = () => [], empty = () => 'Nothing found', onPick, onDone }) {
    const input = el('input', { type: 'text', class: 'picker__input', dir: 'auto', placeholder, 'aria-label': placeholder, role: 'combobox', 'aria-expanded': 'true', 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false' });
    const list = el('ul', { class: 'picker__list', role: 'listbox', 'aria-label': label });
    const root = el('div', { class: 'picker', role: 'group', 'aria-label': label }, el('div', { class: 'picker__search' }, iconEl('search', { size: 16 }), input), list);
    let rows = [];
    let active = 0;

    function setActive(index, scroll) {
        active = index;
        [...list.querySelectorAll('.picker__row')].forEach((node, i) => {
            node.classList.toggle('is-active', i === index);
            node.setAttribute('aria-selected', String(i === index));
            if (i === index && scroll) node.scrollIntoView({ block: 'nearest' });
        });
        if (rows.length) input.setAttribute('aria-activedescendant', `${list.id}-${index}`);
        else input.removeAttribute('aria-activedescendant');
    }

    function draw() {
        const query = input.value;
        const top = actions(query).map((row) => ({ ...row, action: true }));
        const found = items(query);
        rows = [...top, ...found];
        list.replaceChildren();
        rows.forEach((row, index) => {
            const node = el('li', { class: `picker__row${row.action ? ' picker__row--action' : ''}${row.mark ? ' is-marked' : ''}${top.length && index === top.length - 1 ? ' picker__row--last-action' : ''}`, role: 'option', id: `${list.id}-${index}`, 'aria-selected': 'false' }, el('span', { class: 'picker__gutter' }, row.mark ? iconEl('check', { size: 16 }) : row.icon ? iconEl(row.icon, { size: 16 }) : ''), el('span', { class: 'picker__label', dir: 'auto' }, row.label));
            node.addEventListener('pointermove', () => active !== index && setActive(index, false));
            node.addEventListener('click', () => choose(index));
            list.append(node);
        });
        if (!found.length) list.append(el('li', { class: 'picker__empty', role: 'presentation' }, empty(query)));
        setActive(Math.min(active, Math.max(0, rows.length - 1)), true);
    }

    function choose(index) {
        const row = rows[index];
        if (!row) return;
        if (onPick(row, input.value) === 'keep') draw();
        else onDone && onDone();
    }

    list.id = `picker-${Math.random().toString(36).slice(2, 8)}`;
    input.addEventListener('input', () => {
        active = 0;
        draw();
    });
    root.addEventListener('keydown', (event) => {
        const last = Math.max(0, rows.length - 1);
        if (event.key === 'ArrowDown') setActive(Math.min(last, active + 1), true);
        else if (event.key === 'ArrowUp') setActive(Math.max(0, active - 1), true);
        else if (event.key === 'Home') setActive(0, true);
        else if (event.key === 'End') setActive(last, true);
        else if (event.key === 'Enter') choose(active);
        else if (event.key === 'Escape') onDone && onDone();
        else return;
        event.preventDefault();
        event.stopPropagation();
    });
    draw();
    return { root, input, draw };
}

export function mountPicker(host, options) {
    const { root, input, draw } = build(options);
    root.classList.add('picker--inline');
    host.append(root);
    return { el: root, focus: () => input.focus({ preventScroll: true }), refresh: draw, close: () => root.remove() };
}

export function openPicker({ rect, point, onClose, ...options } = {}) {
    const opener = document.activeElement;
    let closed = false;
    const close = (restoreFocus = true) => {
        if (closed) return;
        closed = true;
        document.removeEventListener('pointerdown', outside, true);
        root.remove();
        if (onClose) onClose();
        if (restoreFocus && opener && opener.isConnected && opener.focus) opener.focus();
    };
    const outside = (event) => {
        if (!root.contains(event.target)) close(false);
    };
    const built = build({ ...options, onDone: () => (close(), options.onDone && options.onDone()) });
    const root = built.root;
    root.classList.add('picker--floating');
    overlayHost(null).append(root);
    const box = root.getBoundingClientRect();
    const x = rect ? (rect.right + 6 + box.width <= window.innerWidth ? rect.right + 6 : rect.left - 6 - box.width) : point.x;
    const pos = clampToViewport(x, rect ? rect.top : point.y, box.width, box.height);
    root.style.left = `${pos.x}px`;
    root.style.top = `${pos.y}px`;
    document.addEventListener('pointerdown', outside, true);
    built.input.focus();
    return { el: root, focus: () => built.input.focus(), refresh: built.draw, close };
}
