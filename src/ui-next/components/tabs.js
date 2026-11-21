// Tabs (lyrics modes, panel sections) and a segmented control (density, sort direction). Both use one roving-focus
// helper: Left and Right (reversed in right-to-left text), Home and End move and select; Tab leaves the group.
import { el, iconEl, uid } from './dom.js';

function roving(root, itemSelector, selectedAttr, select) {
    const items = () => [...root.querySelectorAll(itemSelector)].filter((node) => !node.disabled);
    root.addEventListener('keydown', (event) => {
        const list = items();
        const index = list.indexOf(document.activeElement);
        if (index < 0) return;
        const rtl = getComputedStyle(root).direction === 'rtl';
        let next = -1;
        if (event.key === 'ArrowRight') next = index + (rtl ? -1 : 1);
        else if (event.key === 'ArrowLeft') next = index + (rtl ? 1 : -1);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = list.length - 1;
        else return;
        event.preventDefault();
        const target = list[(next + list.length) % list.length];
        target.focus();
        select(target);
    });
    return {
        sync() {
            for (const node of root.querySelectorAll(itemSelector)) node.tabIndex = node.getAttribute(selectedAttr) === 'true' ? 0 : -1;
            // when nothing is selected (or the selected item is disabled) the first enabled item stays reachable
            if (!root.querySelector(`${itemSelector}[tabindex="0"]:not(:disabled)`)) {
                const first = items()[0];
                if (first) first.tabIndex = 0;
            }
        }
    };
}

/**
 * items: [{ id, label, icon?, disabled?, panelId? }]. `onChange(id)` runs when the user picks a tab (not on setValue).
 * Returns { el, setValue(id), setDisabled(id, bool) }.
 */
export function tabs({ items, value, label, onChange } = {}) {
    const root = el('div', { class: 'tabs', role: 'tablist', 'aria-label': label });
    const prefix = uid('tab');
    const nodes = new Map();
    for (const item of items) {
        const node = el('button', { type: 'button', class: 'tab', role: 'tab', id: `${prefix}-${item.id}`, 'aria-selected': 'false', 'aria-controls': item.panelId, disabled: item.disabled });
        node.append(item.icon ? iconEl(item.icon, { size: 16 }) : '', item.label);
        node.dataset.id = item.id;
        node.addEventListener('click', () => pick(node, true));
        nodes.set(item.id, node);
        root.append(node);
    }
    const helper = roving(root, '.tab', 'aria-selected', (node) => pick(node, true));
    function pick(node, notify) {
        if (node.disabled) return;
        const changed = node.getAttribute('aria-selected') !== 'true';
        for (const other of nodes.values()) other.setAttribute('aria-selected', String(other === node));
        helper.sync();
        if (changed && notify && onChange) onChange(node.dataset.id);
    }
    if (nodes.has(value)) pick(nodes.get(value), false);
    else helper.sync();
    return {
        el: root,
        setValue(id) {
            if (nodes.has(id)) pick(nodes.get(id), false);
        },
        setDisabled(id, on) {
            const node = nodes.get(id);
            if (!node) return;
            node.disabled = on;
            helper.sync();
        }
    };
}

/** items: [{ value, label, icon?, disabled? }]. A radio group: exactly one value is on. */
export function segmented({ items, value, label, onChange } = {}) {
    const root = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
    const nodes = new Map();
    for (const item of items) {
        const node = el('button', { type: 'button', class: 'segmented__item', role: 'radio', 'aria-checked': 'false', disabled: item.disabled });
        node.append(item.icon ? iconEl(item.icon, { size: 16 }) : '', item.label);
        node.dataset.value = item.value;
        node.addEventListener('click', () => pick(node, true));
        nodes.set(item.value, node);
        root.append(node);
    }
    const helper = roving(root, '.segmented__item', 'aria-checked', (node) => pick(node, true));
    function pick(node, notify) {
        if (node.disabled) return;
        const changed = node.getAttribute('aria-checked') !== 'true';
        for (const other of nodes.values()) other.setAttribute('aria-checked', String(other === node));
        helper.sync();
        if (changed && notify && onChange) onChange(node.dataset.value);
    }
    if (nodes.has(value)) pick(nodes.get(value), false);
    else helper.sync();
    return {
        el: root,
        setValue(next) {
            if (nodes.has(next)) pick(nodes.get(next), false);
        }
    };
}
