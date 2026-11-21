// Tiny DOM helpers shared by the components. No state, no framework.
import { icon } from '../icons/icons.js';

/**
 * Create an element. `props` keys: `class`, `on<event>` handlers, `dataset` (object), `hidden`/`disabled`-style
 * booleans, anything else becomes an attribute. null, undefined and false are skipped. Children may be nodes, strings or arrays.
 */
export function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
        else node.setAttribute(key, value === true ? '' : String(value));
    }
    append(node, children);
    return node;
}

export function append(node, children) {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

/** A decorative icon wrapped in a span (`icon()` markup comes from our own icons.js, never from user text). */
export function iconEl(name, { size = 18, filled = false } = {}) {
    const span = document.createElement('span');
    span.className = 'icon';
    span.innerHTML = icon(name, { size, filled });
    return span;
}

let counter = 0;
export function uid(prefix = 'ui') {
    counter += 1;
    return `${prefix}-${counter}`;
}

/** Floating parts (menu, tooltip) must live inside an open modal dialog to be visible above it. */
export function overlayHost(anchor) {
    return (anchor && anchor.closest && anchor.closest('dialog[open]')) || document.body;
}

/** Keep a box of `width` x `height` inside the viewport, preferring `x`, `y`. */
export function clampToViewport(x, y, width, height, margin = 8) {
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    return { x: Math.min(Math.max(margin, x), maxX), y: Math.min(Math.max(margin, y), maxY) };
}
