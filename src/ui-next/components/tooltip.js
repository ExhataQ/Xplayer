// Tooltip: name, current state (dim), short description, shortcut (dimmer, right). One shared element.
// Behavior: appears after a hover delay (instantly while moving between neighbours), hides the moment the pointer
// leaves, the target is pressed, focus leaves or Escape is pressed. Keyboard focus shows it too. No animation.
import { el, overlayHost, clampToViewport } from './dom.js';

export const TOOLTIP_DELAY = 500;
const WARM_WINDOW = 300; // after one tooltip hides, the next one opens without the delay for this long

let tip = null; // the shared element, { node, name, state, shortcut, description }
let activeTarget = null;
let showTimer = 0;
let lastHiddenAt = 0;

function ensure() {
    if (tip) return tip;
    const name = el('span', { class: 'tooltip__name', dir: 'auto' });
    const state = el('span', { class: 'tooltip__state' });
    const shortcut = el('kbd', { class: 'tooltip__shortcut' });
    const description = el('div', { class: 'tooltip__description', dir: 'auto' });
    const node = el('div', { class: 'tooltip', role: 'tooltip', id: 'ui-tooltip', hidden: true }, el('div', { class: 'tooltip__head' }, name, state, shortcut), description);
    tip = { node, name, state, shortcut, description };
    return tip;
}

function fill(content) {
    const t = ensure();
    t.name.textContent = content.name || '';
    t.state.textContent = content.state || '';
    t.state.hidden = !content.state;
    t.shortcut.textContent = content.shortcut || '';
    t.shortcut.hidden = !content.shortcut;
    t.description.textContent = content.description || '';
    t.description.hidden = !content.description;
}

function place(target) {
    const t = ensure();
    const host = overlayHost(target);
    if (t.node.parentNode !== host) host.append(t.node);
    t.node.hidden = false;
    const anchor = target.getBoundingClientRect();
    const box = t.node.getBoundingClientRect();
    const gap = 8;
    let y = anchor.bottom + gap;
    let placement = 'bottom';
    if (y + box.height > window.innerHeight - 8 && anchor.top - gap - box.height >= 8) {
        y = anchor.top - gap - box.height;
        placement = 'top';
    }
    const pos = clampToViewport(anchor.left + anchor.width / 2 - box.width / 2, y, box.width, box.height);
    t.node.style.left = `${pos.x}px`;
    t.node.style.top = `${pos.y}px`;
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

function show(target, read) {
    fill(read());
    place(target);
    target.setAttribute('aria-describedby', ensure().node.id);
    activeTarget = target;
}

/**
 * content: { name, state?, description?, shortcut? } or a function returning it (read every time it opens, so the
 * state is always current). Returns { update(partial), refresh(), destroy() }. `update` changes a fixed content and
 * re-renders the open tooltip, which is how a toggle shows its new state right after a click.
 * `stayOnPress: true` (toggles) keeps the tooltip open on press and refreshes it after the click; any other
 * target hides it on press and shows it again on the next hover.
 */
export function attachTooltip(target, content, { delay = TOOLTIP_DELAY, stayOnPress = false } = {}) {
    let fixed = typeof content === 'function' ? null : { ...content };
    const read = () => (fixed ? fixed : content());

    const open = (immediate) => {
        clearTimeout(showTimer);
        const warm = performance.now() - lastHiddenAt < WARM_WINDOW;
        const run = () => {
            if (target.isConnected && !target.disabled) show(target, read);
        };
        if (immediate || warm || delay === 0) run();
        else showTimer = setTimeout(run, delay);
    };
    const close = () => {
        if (activeTarget === target || showTimer) hideTooltip();
    };
    const onKey = (event) => {
        if (event.key === 'Escape' && activeTarget === target) hideTooltip();
    };

    const refresh = () => {
        if (activeTarget === target) {
            fill(read());
            place(target);
        }
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

    return {
        update(partial) {
            fixed = { ...(fixed || read()), ...partial };
            if (activeTarget === target) {
                fill(fixed);
                place(target);
            }
        },
        refresh,
        destroy() {
            close();
            for (const [type, fn] of handlers) target.removeEventListener(type, fn);
        }
    };
}
