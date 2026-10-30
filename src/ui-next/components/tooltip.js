// Tooltip: name, current state (dim), short description, shortcut (dimmer, right). One shared element.
// Behavior: appears after a hover delay (instantly while moving between neighbours), hides the moment the pointer
// leaves, the target is pressed, focus leaves or Escape is pressed. Keyboard focus shows it too. It appears with a short
// accent flash (CSS, components.css); reduced motion turns that off. A small arrow on the edge facing the target shows where it came from.
// Two ways in: attachTooltip() for a control you build, delegateTooltips() for a whole subtree (the engine's controls,
// which are created and recycled by code this folder does not own).
import { el, overlayHost, clampToViewport } from './dom.js';

export const TOOLTIP_DELAY = 250;
const ARROW_EDGE = 12; // the arrow stays this far from a corner of the box (it is 8px wide, the corner radius is 6px)
const WARM_WINDOW = 300; // after one tooltip hides, the next one opens without the delay for this long

let tip = null; // the shared element, { node, name, state, shortcut, description }
let activeTarget = null;
let showTimer = 0;
let lastHiddenAt = -Infinity;
const bound = new WeakSet(); // targets that have their own attachTooltip: the delegated layer leaves them alone

/** True when `node` was given its own tooltip with attachTooltip(). */
export const hasTooltip = (node) => bound.has(node);

function ensure() {
    if (tip) return tip;
    const name = el('span', { class: 'tooltip__name', dir: 'auto' });
    const state = el('span', { class: 'tooltip__state' });
    const shortcut = el('kbd', { class: 'tooltip__shortcut' }); // holds one .tooltip__key per key of the combination
    const description = el('div', { class: 'tooltip__description', dir: 'auto' });
    const node = el('div', { class: 'tooltip', role: 'tooltip', id: 'ui-tooltip', hidden: true }, el('div', { class: 'tooltip__head' }, name, state, shortcut), description);
    tip = { node, name, state, shortcut, description };
    return tip;
}

// A tooltip with nothing to say is not shown: a control that is unavailable right now returns null from its content function.
const hasText = (content) => Boolean(content && (content.name || content.description));

function fill(content) {
    const t = ensure();
    t.name.textContent = content.name || '';
    t.state.textContent = content.state || '';
    t.state.hidden = !content.state;
    // "Ctrl+Shift+S" becomes three key caps; a lone "+" or a key that is itself "+" stays one cap.
    const keys = String(content.shortcut || '').split(/(?<=.)\+(?=.)/).filter(Boolean);
    t.shortcut.replaceChildren(...keys.map((key) => el('span', { class: 'tooltip__key' }, key)));
    t.shortcut.hidden = !content.shortcut;
    t.description.textContent = content.description || '';
    t.description.hidden = !content.description;
}

function place(target, side) {
    const t = ensure();
    const host = overlayHost(target);
    if (t.node.parentNode !== host) host.append(t.node);
    t.node.hidden = false;
    const anchor = target.getBoundingClientRect();
    const box = t.node.getBoundingClientRect();
    const gap = 10; // the arrow takes about 6px of it
    // The arrow points at the middle of the target, wherever the box had to move to stay inside the window; it stays clear of the corners.
    const arrowAt = (center, start, length) => `${Math.round(Math.min(length - ARROW_EDGE, Math.max(ARROW_EDGE, center - start)))}px`;
    if (side === 'right') {
        const pos = clampToViewport(anchor.right + gap, anchor.top + anchor.height / 2 - box.height / 2, box.width, box.height);
        t.node.style.left = `${pos.x}px`;
        t.node.style.top = `${pos.y}px`;
        t.node.style.setProperty('--tooltip-arrow', arrowAt(anchor.top + anchor.height / 2, pos.y, box.height));
        t.node.dataset.placement = 'right';
        return;
    }
    let y = anchor.bottom + gap;
    let placement = 'bottom';
    if (y + box.height > window.innerHeight - 8 && anchor.top - gap - box.height >= 8) {
        y = anchor.top - gap - box.height;
        placement = 'top';
    }
    const pos = clampToViewport(anchor.left + anchor.width / 2 - box.width / 2, y, box.width, box.height);
    t.node.style.left = `${pos.x}px`;
    t.node.style.top = `${pos.y}px`;
    t.node.style.setProperty('--tooltip-arrow', arrowAt(anchor.left + anchor.width / 2, pos.x, box.width));
    t.node.dataset.placement = placement;
}

export function hideTooltip() {
    clearTimeout(showTimer);
    if (!tip || tip.node.hidden) {
        activeTarget = null;
        return;
    }
    tip.node.hidden = true;
    if (activeTarget) activeTarget.removeAttribute('aria-describedby');
    activeTarget = null;
    lastHiddenAt = performance.now();
}

function show(target, read, side) {
    const content = read();
    if (!hasText(content)) return;
    fill(content);
    place(target, side);
    target.setAttribute('aria-describedby', ensure().node.id);
    activeTarget = target;
}

/** Shows the tooltip for `target` after `delay`, at once when `immediate` or when another one has just closed. */
function schedule(target, read, placement, delay, immediate) {
    clearTimeout(showTimer);
    const warm = performance.now() - lastHiddenAt < WARM_WINDOW;
    const run = () => {
        if (target.isConnected && !target.disabled) show(target, read, placement);
    };
    if (immediate || warm || delay === 0) run();
    else showTimer = setTimeout(run, delay);
}

/**
 * content: { name, state?, description?, shortcut? } or a function returning it (read every time it opens, so the
 * state is always current). Returns { update(partial), refresh(), destroy() }. `update` changes a fixed content and
 * re-renders the open tooltip, which is how a toggle shows its new state right after a click.
 * `stayOnPress: true` (toggles) keeps the tooltip open on press and refreshes it after the click; any other
 * target hides it on press and shows it again on the next hover.
 */
export function attachTooltip(target, content, { delay = TOOLTIP_DELAY, stayOnPress = false, placement } = {}) {
    let fixed = typeof content === 'function' ? null : { ...content };
    const read = () => (fixed ? fixed : content());

    const open = (immediate) => schedule(target, read, placement, delay, immediate);
    const close = () => {
        if (activeTarget === target || showTimer) hideTooltip();
    };
    const onKey = (event) => {
        if (event.key === 'Escape' && activeTarget === target) hideTooltip();
    };

    const refresh = () => {
        if (activeTarget !== target) return;
        const now = read();
        if (!hasText(now)) return hideTooltip(); // it became unavailable while open
        fill(now);
        place(target, placement);
    };

    const handlers = [
        ['pointerenter', (event) => event.pointerType !== 'touch' && open(false)],
        ['pointerleave', close],
        ['pointerdown', () => !stayOnPress && close()],
        ['click', () => stayOnPress && refresh()],
        ['focus', () => target.matches(':focus-visible') && open(true)],
        ['blur', close],
        ['keydown', onKey]
    ];
    for (const [type, fn] of handlers) target.addEventListener(type, fn);
    bound.add(target);

    return {
        update(partial) {
            fixed = { ...(fixed || read()), ...partial };
            if (activeTarget === target) {
                fill(fixed);
                place(target, placement);
            }
        },
        refresh,
        destroy() {
            close();
            bound.delete(target);
            for (const [type, fn] of handlers) target.removeEventListener(type, fn);
        }
    };
}

/**
 * One set of listeners for everything under `root`. `resolve(node)` gets the element the pointer or keyboard focus is on
 * and returns { target, read, placement?, stayOnPress? } for the control that owns a tooltip, or null. `read()` is called
 * every time the tooltip opens or refreshes, so the text is always current. Controls that have their own attachTooltip()
 * are skipped. Same behavior as attachTooltip (delay, hide on press, keyboard focus), plus: it hides on scroll, because
 * rows in a virtual list move under a still pointer. Returns a function that removes the listeners.
 */
export function delegateTooltips(root, resolve, { delay = TOOLTIP_DELAY } = {}) {
    let current = null; // { target, read, placement, stayOnPress }
    let pressed = null; // a pressed control stays quiet until the pointer has left it

    const find = (node) => {
        const found = node instanceof Element ? resolve(node) : null;
        return found && found.target && !hasTooltip(found.target) ? found : null;
    };
    const end = () => {
        const was = current;
        current = null;
        if (was && (activeTarget === was.target || showTimer)) hideTooltip();
    };
    const refresh = () => {
        if (!current) return;
        if (!current.target.isConnected) return end();
        if (activeTarget === current.target) {
            const now = current.read();
            if (!hasText(now)) return end();
            fill(now);
            place(current.target, current.placement);
        }
    };

    const onOver = (event) => {
        if (event.pointerType === 'touch') return;
        const found = find(event.target);
        if (found && ((current && found.target === current.target) || found.target === pressed)) return;
        end();
        if (found) {
            current = found;
            schedule(found.target, found.read, found.placement, delay, false);
        }
    };
    const onOut = (event) => {
        if (pressed && !pressed.contains(event.relatedTarget)) pressed = null;
        if (current && !current.target.contains(event.relatedTarget)) end();
    };
    const onDown = () => {
        if (!current || current.stayOnPress) return;
        pressed = current.target;
        end();
    };
    // The engine updates its own state in a handler that may run after this one, so read the state a tick later.
    const onClick = () => current && current.stayOnPress && setTimeout(refresh, 0);
    const onFocusIn = (event) => {
        if (!event.target.matches || !event.target.matches(':focus-visible')) return;
        const found = find(event.target);
        if (!found) return;
        end();
        current = found;
        schedule(found.target, found.read, found.placement, delay, true);
    };
    const onKey = (event) => {
        if (event.key === 'Escape' && current && activeTarget === current.target) hideTooltip();
    };
    const onScroll = () => current && end();

    const listeners = [
        ['pointerover', onOver, false],
        ['pointerout', onOut, false],
        ['pointerdown', onDown, true],
        ['click', onClick, false],
        ['focusin', onFocusIn, false],
        ['focusout', end, false],
        ['keydown', onKey, false],
        ['scroll', onScroll, true]
    ];
    for (const [type, fn, capture] of listeners) root.addEventListener(type, fn, { capture, passive: true });
    return () => {
        end();
        for (const [type, fn, capture] of listeners) root.removeEventListener(type, fn, { capture });
    };
}
