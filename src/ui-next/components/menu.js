// Menu and submenus (logo app menu, sort menu, context menus). Keyboard: Up and Down, Home and End, type to jump,
// Right opens a submenu, Left or Escape closes one level, Enter and Space choose, Tab closes. Focus returns to the opener.
// Items: { label, icon?, shortcut?, onSelect?, disabled?, danger?, checked? (checkbox), radio? (true with checked), items? (submenu) },
// { type: 'separator' }, { type: 'heading', label }.
import { el, iconEl, overlayHost, clampToViewport } from './dom.js';

const SUBMENU_DELAY = 150; // before a hovered submenu item opens its submenu
const SUBMENU_CLOSE_DELAY = 80; // before hovering another item shuts the open submenu (short, so the old item does not stay lit; long enough to cross a neighbour on the way to the submenu)

// What the person used last. A menu opened with the mouse or a finger keeps keyboard focus on its first item (so the keys work at once) but does not
// paint that item as selected, which looked like a hover nobody made. A menu opened from the keyboard, or by code, shows it as before.
let lastInput = 'keyboard';
if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', () => (lastInput = 'pointer'), true);
    document.addEventListener('keydown', () => (lastInput = 'keyboard'), true);
}

/**
 * openMenu({ anchor, items, point?, above?, onClose? }) opens below `anchor` (above it when `above` is true, for buttons at the bottom of the window), or at `point` {x, y} for a context menu.
 * Returns { close(restoreFocus = true), el }, or null when the press that opened it was the one that just closed it. Choosing a normal item closes the whole menu; `keepOpen: true` on an item keeps it open.
 */
export function openMenu({ anchor, items, point, above = false, onClose } = {}) {
    if (anchor && anchor._menuSuppressUntil > performance.now()) return null; // this press just closed the menu
    const host = overlayHost(anchor);
    const opener = document.activeElement;
    const layers = []; // open menus, innermost last
    let closed = false;
    let mode = lastInput; // 'pointer' until a key is pressed in the menu (then 'keyboard')

    function build(list, depth) {
        const root = el('ul', { class: 'menu', role: 'menu', 'data-depth': String(depth) });
        const itemNodes = [];
        for (const item of list) {
            if (item.type === 'separator') {
                root.append(el('li', { class: 'menu__separator', role: 'separator' }));
                continue;
            }
            if (item.type === 'heading') {
                root.append(el('li', { class: 'menu__heading', role: 'presentation' }, item.label));
                continue;
            }
            const role = item.items ? 'menuitem' : item.radio ? 'menuitemradio' : item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem';
            const node = el('button', { type: 'button', class: 'menu__item', role, tabindex: '-1', 'aria-disabled': item.disabled ? 'true' : null, 'data-danger': item.danger ? 'true' : null });
            if (role !== 'menuitem') node.setAttribute('aria-checked', String(Boolean(item.checked)));
            if (item.items) {
                node.setAttribute('aria-haspopup', 'menu');
                node.setAttribute('aria-expanded', 'false');
            }
            const gutter = el('span', { class: 'menu__gutter' });
            if (item.checked) gutter.append(iconEl('check', { size: 16 }));
            else if (item.icon) gutter.append(iconEl(item.icon, { size: 16 }));
            node.append(gutter, el('span', { class: 'menu__label' }, item.label));
            if (item.shortcut) node.append(el('span', { class: 'menu__shortcut' }, item.shortcut));
            if (item.items) node.append(el('span', { class: 'menu__submenu-mark' }, iconEl('chevron-right', { size: 16 })));
            node._item = item;
            itemNodes.push(node);
            root.append(el('li', { role: 'none' }, node));
        }
        root._nodes = itemNodes;
        return root;
    }

    function enabled(menu) {
        return menu._nodes.filter((n) => n.getAttribute('aria-disabled') !== 'true');
    }

    function position(menu, x, y, alignTo) {
        menu.style.left = '0px';
        menu.style.top = '0px';
        const box = menu.getBoundingClientRect();
        let left = x;
        if (alignTo && left + box.width > window.innerWidth - 8) left = alignTo.left - box.width + 2; // flip a submenu to the left
        const pos = clampToViewport(left, y, box.width, box.height);
        menu.style.left = `${pos.x}px`;
        menu.style.top = `${pos.y}px`;
    }

    function openLayer(list, x, y, alignTo) {
        const menu = build(list, layers.length);
        menu.dataset.input = mode;
        host.append(menu);
        position(menu, x, y, alignTo);
        layers.push(menu);
        return menu;
    }

    function closeLayersAbove(depth) {
        while (layers.length > depth + 1) {
            const menu = layers.pop();
            const parent = layers[layers.length - 1];
            const opener = parent && parent._nodes.find((n) => n.getAttribute('aria-expanded') === 'true');
            if (opener) {
                opener.setAttribute('aria-expanded', 'false');
                delete opener.dataset.open;
            }
            menu.remove();
        }
    }

    function openSubmenu(node, focusFirst) {
        const depth = Number(node.closest('.menu').dataset.depth);
        closeLayersAbove(depth);
        if (node.getAttribute('aria-disabled') === 'true') return;
        node.setAttribute('aria-expanded', 'true');
        node.dataset.open = 'true';
        const rect = node.getBoundingClientRect();
        const menu = openLayer(node._item.items, rect.right - 2, rect.top - 5, rect);
        if (focusFirst) enabled(menu)[0]?.focus();
    }

    function choose(node) {
        const item = node._item;
        if (node.getAttribute('aria-disabled') === 'true') return;
        if (item.items) return openSubmenu(node, true);
        if (item.keepOpen) {
            if (item.checked !== undefined) {
                item.checked = item.radio ? true : !item.checked;
                node.setAttribute('aria-checked', String(item.checked));
            }
            if (item.onSelect) item.onSelect(item);
            return;
        }
        close();
        if (item.onSelect) item.onSelect(item);
    }

    let hoverTimer = 0;
    let typed = '';
    let typedTimer = 0;

    function close(restoreFocus = true) {
        if (closed) return;
        closed = true;
        clearTimeout(hoverTimer);
        clearTimeout(typedTimer);
        closeLayersAbove(-1);
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('keydown', onKey, true);
        host.removeEventListener('pointerover', onPointerOver);
        host.removeEventListener('click', onClick);
        window.removeEventListener('blur', onWindowBlur);
        window.removeEventListener('resize', onWindowBlur);
        if (anchor) anchor.removeAttribute('aria-expanded');
        if (restoreFocus) {
            const target = anchor && anchor.isConnected ? anchor : opener;
            if (target && target.focus) target.focus();
        }
        if (onClose) onClose();
    }

    function inMenu(target) {
        return layers.some((menu) => menu.contains(target));
    }

    function onOutside(event) {
        if (inMenu(event.target)) return;
        // a press on the opener closes the menu and must not reopen it with the click that follows
        const onAnchor = Boolean(anchor && anchor.contains(event.target));
        if (onAnchor) anchor._menuSuppressUntil = performance.now() + 300;
        close(onAnchor);
    }
    const onWindowBlur = () => close(false);

    function parentOpener() {
        return layers[layers.length - 2]._nodes.find((n) => n.getAttribute('aria-expanded') === 'true');
    }

    function onKey(event) {
        const menu = layers[layers.length - 1];
        if (mode === 'pointer') {
            // the first key press brings the selected look in; Up and Down then start from the first (or last) item instead of skipping the hidden one
            mode = 'keyboard';
            for (const layer of layers) layer.dataset.input = 'keyboard';
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                const all = enabled(menu);
                (event.key === 'ArrowDown' ? all[0] : all[all.length - 1])?.focus();
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }
        const current = menu._nodes.indexOf(document.activeElement);
        const list = enabled(menu);
        const at = list.indexOf(document.activeElement);
        const rtl = getComputedStyle(menu).direction === 'rtl';
        const openKey = rtl ? 'ArrowLeft' : 'ArrowRight';
        const backKey = rtl ? 'ArrowRight' : 'ArrowLeft';
        let handled = true;
        if (event.key === 'ArrowDown') list[(at + 1) % list.length]?.focus();
        else if (event.key === 'ArrowUp') list[(at <= 0 ? list.length : at) - 1]?.focus();
        else if (event.key === 'Home') list[0]?.focus();
        else if (event.key === 'End') list[list.length - 1]?.focus();
        else if (event.key === openKey && current >= 0 && menu._nodes[current]._item.items) openSubmenu(menu._nodes[current], true);
        else if ((event.key === backKey || event.key === 'Escape') && layers.length > 1) {
            const parent = parentOpener();
            closeLayersAbove(layers.length - 2);
            parent?.focus();
        } else if (event.key === 'Escape') close();
        else if (event.key === 'Tab') close();
        else if ((event.key === 'Enter' || event.key === ' ') && current >= 0) choose(menu._nodes[current]);
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            clearTimeout(typedTimer);
            typed += event.key.toLowerCase();
            typedTimer = setTimeout(() => (typed = ''), 700);
            const from = Math.max(typed.length > 1 ? at : at + 1, 0);
            [...list.slice(from), ...list.slice(0, from)].find((n) => n.textContent.trim().toLowerCase().startsWith(typed))?.focus();
        } else handled = false;
        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // Hovering a submenu item opens it after a short delay; hovering any other item closes the open submenus.
    // Focus follows the pointer, so only one item is ever lit: the one under it. Without this the item that had focus when the menu opened
    // stayed lit while another one was hovered, and the highlight seemed to take a moment to leave.
    function onPointerOver(event) {
        const node = event.target.closest && event.target.closest('.menu__item');
        if (!node || !node._item || !inMenu(node)) return;
        const depth = Number(node.closest('.menu').dataset.depth);
        if (node.getAttribute('aria-disabled') !== 'true' && document.activeElement !== node) node.focus({ preventScroll: true });
        clearTimeout(hoverTimer);
        if (node._item.items) hoverTimer = setTimeout(() => openSubmenu(node, false), SUBMENU_DELAY);
        else hoverTimer = setTimeout(() => closeLayersAbove(depth), SUBMENU_CLOSE_DELAY);
    }
    function onClick(event) {
        const node = event.target.closest && event.target.closest('.menu__item');
        if (node && node._item && inMenu(node)) choose(node);
    }

    const rect = anchor ? anchor.getBoundingClientRect() : { left: point.x, bottom: point.y - 4 };
    const first = openLayer(items, rect.left, rect.bottom + 4);
    if (above && anchor) position(first, rect.left, anchor.getBoundingClientRect().top - first.offsetHeight - 4);
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    host.addEventListener('pointerover', onPointerOver);
    host.addEventListener('click', onClick);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', onWindowBlur);
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    enabled(layers[0])[0]?.focus();

    return { el: layers[0], close: (restoreFocus) => close(restoreFocus) };
}
