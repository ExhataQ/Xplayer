// Queue (task C-03): a drawer above the player, opened from a button in the player's right controls.
//
// Decision (research/C-03-queue-map.md, D16 = S3): the engine's own queue list is reused and restyled, not rebuilt. It
// already holds the rules: the "Added to Queue" and "Next Songs" sections, the display limit and "Load more", the
// shuffle refill, the repeat-one and empty cards, the row menus. adapter/playback-bridge.js moves that list in here.
// This file adds the drawer, its open and close behavior, and keyboard access to the rows (the engine's rows are
// plain divs). It never calls the engine's own right-panel toggle.

import { iconButton, el } from '../../components/index.js';
import { playerPart } from '../../adapter/player-parts.js';
import { mountQueueList, refreshQueue } from '../../adapter/playback-bridge.js';

const ROW = '.queue-item';

export function mountQueuePanel() {
    const anchor = playerPart('right-controls');
    if (!anchor) return () => {};

    const body = el('div', { class: 'queue-panel__body' });
    const closeButton = iconButton({ icon: 'x', label: 'Close queue', size: 'sm', tooltip: false, onClick: () => setOpen(false) });
    const panel = el(
        'section',
        { class: 'queue-panel', id: 'queue-panel', 'aria-label': 'Queue', hidden: true },
        el('header', { class: 'queue-panel__header' }, el('h2', { class: 'queue-panel__title' }, 'Queue'), closeButton),
        body
    );
    document.body.append(panel);

    const toggle = iconButton({
        icon: 'list-music',
        label: 'Queue',
        pressed: false,
        tooltip: { description: 'Songs playing next' },
        className: 'queue-btn',
        onClick: () => setOpen(panel.hidden)
    });
    toggle.setAttribute('aria-controls', 'queue-panel');
    toggle.setAttribute('aria-expanded', 'false');
    const before = playerPart('lyrics');
    if (before) before.after(toggle);
    else anchor.prepend(toggle);
    // Space on a focused button presses it (the engine's global Space handler would play or pause instead).
    toggle.addEventListener('keydown', (event) => {
        if (event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) toggle.click();
    });
    toggle.addEventListener('keyup', (event) => event.key === ' ' && (event.preventDefault(), event.stopPropagation()));

    let mounted = false;
    function setOpen(open) {
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-pressed', String(open));
        if (!open) return;
        if (!mounted) mounted = mountQueueList(body);
        else refreshQueue();
        decorateRows();
    }

    // The engine redraws the whole list on every change; rows get focus, a role and Enter and Space again each time.
    let queued = false;
    function decorateRows() {
        queued = false;
        for (const row of body.querySelectorAll(ROW)) {
            if (row.hasAttribute('tabindex')) continue;
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            const title = row.querySelector('.queue-item-title');
            const artist = row.querySelector('.queue-item-artist');
            row.setAttribute('aria-label', `Play ${title ? title.textContent.trim() : 'song'}${artist ? `, ${artist.textContent.trim()}` : ''}`);
        }
    }
    new MutationObserver(() => {
        if (!queued) {
            queued = true;
            requestAnimationFrame(decorateRows);
        }
    }).observe(body, { childList: true, subtree: true });

    // Enter or Space plays the focused row (the engine's click action); the menu key or Shift+F10 opens its menu, because
    // the browser sends a contextmenu event to the focused row and the engine handles it.
    body.addEventListener('keydown', (event) => {
        const row = event.target.closest && event.target.closest(ROW);
        if (!row || row !== event.target) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            row.click();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const rows = [...body.querySelectorAll(ROW)];
            const next = rows[rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)];
            if (next) {
                event.preventDefault();
                event.stopPropagation();
                next.focus();
            }
        }
    });

    // Escape closes it and gives focus back to the button; a press outside closes it too.
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) {
            setOpen(false);
            toggle.focus();
        }
    });
    document.addEventListener('pointerdown', (event) => {
        if (panel.hidden || panel.contains(event.target) || toggle.contains(event.target)) return;
        // A press in the engine's context menu (opened from a row) must not close the queue under it.
        if (event.target.closest('.context-menu, .menu, [role="menu"]')) return;
        setOpen(false);
    });

    return () => {
        panel.remove();
        toggle.remove();
    };
}
