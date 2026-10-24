// The chat as a small pop-up window (opened by the top bar button, Ctrl+Shift+A or Playback > AI shuffle). It lives in a layer the
// shell provides, stays open while the person moves between views, and can be expanded into the big chat view and shrunk back.
// The conversation is shared between the two (it lives in ai-chat.js).

import { getAiPopupHost, setAiPopupOpen, contextFor, openAiChatView, closeAiChatView, registerAiPopup } from '../../shell/ai-slots.js';
import { el } from '../../components/index.js';
import { mountChat } from './ai-chat.js';

let panel = null;
let handle = null;
let place = null; // { left, top } after the person has moved the window; kept for this session

const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));

// The window moves by its title bar, like any window: drag it anywhere on the page. Buttons in the bar still click.
function makeMovable(node, handleNode, host) {
    const put = (left, top) => {
        const box = host.getBoundingClientRect();
        node.style.right = 'auto';
        node.style.left = `${clamp(left, 0, box.width - node.offsetWidth)}px`;
        node.style.top = `${clamp(top, 0, box.height - 48)}px`;
    };
    if (place) put(place.left, place.top);
    handleNode.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest('button')) return;
        const start = node.getBoundingClientRect();
        const dx = event.clientX - start.left;
        const dy = event.clientY - start.top;
        node.dataset.dragging = 'true';
        handleNode.setPointerCapture(event.pointerId);
        const move = (e) => put(e.clientX - dx, e.clientY - dy);
        const stop = () => {
            delete node.dataset.dragging;
            const at = node.getBoundingClientRect();
            place = { left: at.left, top: at.top };
            handleNode.removeEventListener('pointermove', move);
            handleNode.removeEventListener('pointerup', stop);
            handleNode.removeEventListener('pointercancel', stop);
        };
        handleNode.addEventListener('pointermove', move);
        handleNode.addEventListener('pointerup', stop);
        handleNode.addEventListener('pointercancel', stop);
    });
}

export const isPopupOpen = () => Boolean(panel);

export function closePopup() {
    if (!panel) return;
    if (handle && handle.destroy) handle.destroy();
    panel.remove();
    panel = null;
    handle = null;
    setAiPopupOpen(false);
}

export function openPopup() {
    const host = getAiPopupHost();
    if (!host) return;
    if (panel) {
        const input = panel.querySelector('textarea');
        if (input) input.focus();
        return;
    }
    panel = el('div', { class: 'ai-popup', role: 'dialog', 'aria-label': 'AI assistant' });
    panel.addEventListener(
        'keydown',
        (event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            closePopup();
        },
        true
    );
    host.append(panel);
    handle = mountChat(panel, contextFor(panel), { mode: 'popup', onExpand: expand, onClose: closePopup });
    const head = panel.querySelector('.ai-chat__head');
    if (head) makeMovable(panel, head, host);
    setAiPopupOpen(true);
    const input = panel.querySelector('textarea');
    if (input) input.focus();
}

export function togglePopup() {
    if (panel) closePopup();
    else openPopup();
}

function expand() {
    closePopup();
    openAiChatView();
}

/** The big view's Make smaller button. */
export function shrink() {
    closeAiChatView();
    openPopup();
}

export function registerPopup() {
    registerAiPopup({ open: openPopup, toggle: togglePopup });
}
