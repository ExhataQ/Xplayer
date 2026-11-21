// Button, icon button, chip and chip group. States: hover, focus, active, pressed (toggles), disabled, loading.
import { el, iconEl } from './dom.js';
import { attachTooltip } from './tooltip.js';

function guardBusy(node, onClick) {
    return (event) => {
        if (node.getAttribute('aria-busy') === 'true') return;
        if (onClick) onClick(event);
    };
}

/**
 * variant: 'primary' | 'outline' | 'ghost' | 'danger'. `loading` shows a spinner, keeps focus and ignores clicks.
 * `pressed` (true or false) makes it a toggle.
 */
export function button({ label, icon, variant = 'outline', size, loading = false, disabled = false, pressed, type = 'button', onClick, className = '' } = {}) {
    if (!label) throw new Error('button() needs a label');
    const node = el('button', { type, class: `btn btn--${variant}${size === 'sm' ? ' btn--sm' : ''} ${className}`.trim(), disabled });
    node.append(icon ? iconEl(icon, { size: 16 }) : '', el('span', { class: 'btn__label' }, label));
    if (pressed !== undefined) node.setAttribute('aria-pressed', String(Boolean(pressed)));
    node.addEventListener('click', guardBusy(node, onClick));
    setLoading(node, loading);
    return node;
}

/** Swap the leading icon for a spinner, or back. Works for button() and iconButton(). */
export function setLoading(node, on) {
    const existing = node.querySelector(':scope > .spinner');
    if (on) {
        node.setAttribute('aria-busy', 'true');
        if (!existing) {
            const lead = node.querySelector(':scope > .icon');
            const spinner = el('span', { class: 'spinner', 'aria-hidden': 'true' });
            if (lead) {
                lead.hidden = true;
                lead.before(spinner);
            } else {
                node.prepend(spinner);
            }
        }
    } else {
        node.removeAttribute('aria-busy');
        if (existing) existing.remove();
        const lead = node.querySelector(':scope > .icon');
        if (lead) lead.hidden = false;
    }
}

/**
 * Icon-only button. `label` is required: it is the accessible name and the tooltip name.
 * `tooltip` adds { state, description, shortcut } to the tooltip, or is a function returning them, read every time the
 * tooltip opens (for a button whose state or label changes; the name then follows the button's aria-label).
 * `tooltip: false` gives no tooltip. `variant: 'solid'` is the main transport button.
 */
export function iconButton({ icon, label, size, variant = 'ghost', pressed, disabled = false, tooltip, placement, onClick, className = '' } = {}) {
    if (!icon || !label) throw new Error('iconButton() needs an icon and a label');
    const node = el('button', {
        type: 'button',
        class: `icon-btn${variant === 'solid' ? ' icon-btn--solid' : ''}${size === 'sm' ? ' icon-btn--sm' : ''} ${className}`.trim(),
        'aria-label': label,
        disabled
    });
    node.append(iconEl(icon, { size: variant === 'solid' ? 20 : 18, filled: variant === 'solid' }));
    if (pressed !== undefined) node.setAttribute('aria-pressed', String(Boolean(pressed)));
    node.addEventListener('click', guardBusy(node, onClick));
    if (tooltip !== false) {
        const content = typeof tooltip === 'function' ? () => ({ name: node.getAttribute('aria-label') || label, ...tooltip() }) : { name: label, ...(tooltip || {}) };
        node.tooltip = attachTooltip(node, content, { stayOnPress: pressed !== undefined, placement });
    }
    return node;
}

/** A filter chip. It is a toggle button: aria-pressed carries the state. */
export function chip({ label, count, pressed = false, disabled = false, onClick } = {}) {
    if (!label) throw new Error('chip() needs a label');
    const node = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(Boolean(pressed)), disabled });
    node.append(label);
    if (count !== undefined && count !== null) node.append(el('span', { class: 'chip__count' }, String(count)));
    node.addEventListener('click', onClick || (() => {}));
    return node;
}

/**
 * One active chip at a time (All, Playlists, Folders ...). `onChange(value)` runs when the user picks another.
 *
 * `clearable: true` makes it a filter that is off by default: no chip is pressed (a `value` that is not one of the items means no filter),
 * all the chips show, and the first one picked hides the others and shows a small close button next to it. The close button, or the picked
 * chip again, clears the filter: `onChange(clearValue)` runs and all the chips come back.
 */
export function chipGroup({ items, value, label, onChange, clearable = false, clearValue = 'all' } = {}) {
    const root = el('div', { class: 'chip-group', role: 'group', 'aria-label': label });
    const chips = new Map();
    let close = null;
    const setValue = (next) => {
        for (const [v, node] of chips) node.setAttribute('aria-pressed', String(v === next));
        if (!close) return;
        const on = chips.has(next);
        root.dataset.filtering = String(on);
        close.hidden = !on;
        if (on) close.setAttribute('aria-label', `Clear the ${chips.get(next).textContent.trim()} filter`);
    };
    const clear = () => {
        setValue(clearValue);
        if (onChange) onChange(clearValue);
    };
    for (const item of items) {
        const node = chip({
            label: item.label,
            count: item.count,
            disabled: item.disabled,
            pressed: item.value === value,
            onClick: () => {
                if (node.getAttribute('aria-pressed') === 'true') return void (clearable && clear());
                setValue(item.value);
                if (onChange) onChange(item.value);
            }
        });
        chips.set(item.value, node);
        root.append(node);
    }
    if (clearable) {
        close = iconButton({ icon: 'x', label: 'Clear the filter', size: 'sm', tooltip: false, className: 'chip-group__clear', onClick: clear });
        close.hidden = true;
        root.append(close);
        setValue(value);
    }
    return { el: root, setValue };
}
