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
import { isNearRect, isInZone, queueOpenZone, QUEUE_DWELL_MS } from './queue-drag-open.js';
import { scrollShadow } from '../../components/scroll-shadow.js';
import { slidePanel } from '../../shell/panel-motion.js';

const ROW = '.queue-item';

export function mountQueuePanel() {
    const anchor = playerPart('right-controls');
    if (!anchor) return () => {};

    const body = el('div', { class: 'queue-panel__body' });
    // The body scrolls; its wrapper does not, so the shadows can sit over the wrapper's top and bottom edges (under the header, over the
    // rounded bottom) and stay put while the rows move: the top one while the list is scrolled down, the bottom one while more is below.
    const scroll = el('div', { class: 'queue-panel__scroll scroll-shadow--overlay scroll-shadow--bottom' }, body);
    scrollShadow(scroll, '.queue-panel__body', { bottom: true });
    const closeButton = iconButton({ icon: 'x', label: 'Close queue', size: 'sm', tooltip: false, onClick: () => setOpen(false) });
    const panel = el(
        'section',
        { class: 'queue-panel', id: 'queue-panel', 'aria-label': 'Queue', hidden: true },
        el('header', { class: 'queue-panel__header' }, el('h2', { class: 'queue-panel__title' }, 'Queue'), closeButton),
        scroll
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
    let openedByDrag = false;
    function setOpen(open) {
        if (!open) openedByDrag = false;
        slidePanel(panel, 'up', open, (on) => (panel.hidden = !on)); // rises from the player when it opens; closing is instant (C8)
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

    // PC-11: while a song is dragged (the engine puts `dragging-song` on the body) the drawer opens when the pointer comes near
    // the queue button, so the song can be dropped into it (the engine's drop code looks for #queue-list under the pointer).
    // Polish A1: it also opens when the pointer rests for a moment in a zone above the button, on the side where the drawer
    // appears. The zone is taller for a longer queue (queue-drag-open.js), so a song does not have to be dragged all the way down.
    // A drawer opened this way closes again when the drag ends; one the person opened themselves stays open.
    // Files dragged in from Windows (`dragging-files`, ui/06m) open it the same way. A native drag sends `dragover` instead of `mousemove`, and the list stops that event, so it is heard in the capture phase.
    const isDragging = () => document.body.classList.contains('dragging-song') || document.body.classList.contains('dragging-files');
    let dwellTimer = null;
    const clearDwell = () => {
        if (dwellTimer === null) return;
        clearTimeout(dwellTimer);
        dwellTimer = null;
    };
    const openForDrag = () => {
        if (!panel.hidden || !isDragging()) return;
        setOpen(true);
        openedByDrag = true;
    };
    const onDragMove = (event) => {
        if (!panel.hidden) return clearDwell();
        const buttonRect = toggle.getBoundingClientRect();
        if (isNearRect(event, buttonRect)) {
            clearDwell();
            openForDrag();
            return;
        }
        // The queue's size is read from the rows the engine list holds (zero until the drawer was opened once: the smallest zone).
        const zone = queueOpenZone(buttonRect, body.querySelectorAll(ROW).length, window.innerWidth);
        if (!isInZone(event, zone)) return clearDwell();
        if (dwellTimer === null) {
            dwellTimer = setTimeout(() => {
                dwellTimer = null;
                openForDrag();
            }, QUEUE_DWELL_MS);
        }
    };
    const dragWatcher = new MutationObserver(() => {
        if (isDragging()) {
            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('dragover', onDragMove, true);
            return;
        }
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('dragover', onDragMove, true);
        clearDwell();
        if (openedByDrag) setOpen(false);
    });
    dragWatcher.observe(document.body, { attributes: true, attributeFilter: ['class'] });

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
        // A press on a song row may be the start of a drag into the queue: decide when the button is released (below).
        if (event.target.closest('.song-item')) {
            pressOnRow = true;
            return;
        }
        setOpen(false);
    });
    let pressOnRow = false;
    document.addEventListener(
        'pointerup',
        () => {
            if (!pressOnRow) return;
            pressOnRow = false;
            // The engine clears `dragging-song` in its own mouseup, which comes after this pointerup: still set means a drag.
            if (!document.body.classList.contains('dragging-song')) setOpen(false);
        },
        true
    );

    return () => {
        dragWatcher.disconnect();
        clearDwell();
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('dragover', onDragMove, true);
        panel.remove();
        toggle.remove();
    };
}
