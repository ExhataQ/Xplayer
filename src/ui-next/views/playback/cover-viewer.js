// Big picture mode (tasks C-04, PC-06). A button on the cover in the player opens the cover large over the whole window in
// the old screen's design (ui/06h-fullscreen-viewer.js): a dark backdrop, the picture fading in out of a blur, a round close
// button under it, and a click on the picture turns on a round magnifier that follows the pointer. The old engine viewer
// needs markup the new shell does not have, so this is a small surface that only reads what the player shows: the cover
// picture, title and artist.
//
// It is a native <dialog>: the page behind is inert, Escape closes it, focus returns to the button. Escape, the close button
// and a click on the backdrop all close it with the old fade-out.

import { iconButton, el } from '../../components/index.js';
import { playerPart } from '../../adapter/player-parts.js';
import { currentCover, hasCoverArt } from '../../adapter/playback-bridge.js';

const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
const CLOSE_MS = 300; // the old viewer's fade-out
const ZOOM = 1.75; // the old magnifier's strength

/** The magnifier on a picture, inside `host` (a fixed lens must not sit under the content's blur filter). Returns { toggle, off }. */
export function createMagnifier(host, picture) {
    const inner = el('div', { class: 'cover-lens__inner' });
    const lens = el('div', { class: 'cover-lens', hidden: true, 'aria-hidden': 'true' }, inner);
    host.append(lens);
    let active = false;
    let pointer = { x: 0, y: 0 };
    let box = null;
    const move = (x, y) => {
        const rect = picture.getBoundingClientRect();
        const dx = x - rect.left;
        const dy = y - rect.top;
        if (dx < 0 || dy < 0 || dx > rect.width || dy > rect.height) {
            lens.hidden = true;
            return;
        }
        lens.hidden = false;
        const size = lens.offsetWidth || 180;
        lens.style.left = `${x - size / 2}px`;
        lens.style.top = `${y - size / 2}px`;
        inner.style.backgroundPosition = `${-((dx / rect.width) * box.w - size / 2)}px ${-((dy / rect.height) * box.h - size / 2)}px`;
    };
    const onMove = (event) => {
        pointer = { x: event.clientX, y: event.clientY };
        if (active) move(pointer.x, pointer.y);
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', () => (lens.hidden = true));
    const off = () => {
        active = false;
        lens.hidden = true;
        picture.classList.remove('cover-overlay__image--lens');
    };
    const on = () => {
        const rect = picture.getBoundingClientRect();
        box = { w: rect.width * ZOOM, h: rect.height * ZOOM };
        inner.style.backgroundImage = `url("${picture.currentSrc || picture.src}")`;
        inner.style.backgroundSize = `${box.w}px ${box.h}px`;
        active = true;
        picture.classList.add('cover-overlay__image--lens');
        move(pointer.x, pointer.y);
    };
    return { toggle: () => (active ? off() : on()), off, get active() { return active; } };
}

/**
 * The picture to show large: the song's full-size cover, not the 160px square thumbnail the player bar shows. `small` is the
 * player's own picture, used when the song has no larger one or the larger file cannot be read.
 */
export function bigCoverSource(small) {
    const art = currentCover();
    const large = art && art.large;
    return { src: large && hasCoverArt(large) ? large : small, fallback: small };
}

/** Opens the big picture for `src` (`fallback` is shown if `src` cannot be loaded). Resolves when it is closed. */
export function openBigPicture({ src, fallback = '', title, artist = '' }) {
    const picture = el('img', { class: 'cover-overlay__image', src, alt: `Cover of ${title}` });
    if (fallback && fallback !== src) picture.addEventListener('error', () => (picture.src = fallback), { once: true });
    const content = el('div', { class: 'cover-overlay__content' }, picture);
    const closeButton = iconButton({ icon: 'x', label: 'Close', tooltip: false, className: 'cover-overlay__close' });
    const dialog = el('dialog', { class: 'cover-overlay', 'aria-label': artist ? `${title}, ${artist}` : title }, content, closeButton);
    const magnifier = createMagnifier(dialog, picture);
    return new Promise((resolve) => {
        let closing = false;
        const close = () => {
            if (closing) return;
            closing = true;
            magnifier.off();
            if (matchMedia('(prefers-reduced-motion: reduce)').matches) return dialog.close();
            dialog.classList.remove('cover-overlay--shown');
            setTimeout(() => dialog.close(), CLOSE_MS);
        };
        picture.addEventListener('click', magnifier.toggle);
        closeButton.addEventListener('click', close);
        dialog.addEventListener('cancel', (event) => (event.preventDefault(), close())); // Escape
        dialog.addEventListener('keydown', (event) => event.stopPropagation()); // the engine's shortcuts (space, m, arrows) must not act here
        let downOnBackdrop = false;
        dialog.addEventListener('pointerdown', (event) => (downOnBackdrop = event.target === dialog || event.target === content));
        dialog.addEventListener('click', (event) => {
            if (downOnBackdrop && (event.target === dialog || event.target === content)) close();
        });
        dialog.addEventListener('close', () => {
            dialog.remove();
            resolve();
        });
        document.body.append(dialog);
        dialog.showModal();
        closeButton.focus();
        requestAnimationFrame(() => requestAnimationFrame(() => !closing && dialog.classList.add('cover-overlay--shown'))); // after the first paint, so the fade-in runs
    });
}

export function mountCoverViewer() {
    const cover = playerPart('cover');
    const info = playerPart('song-info');
    if (!cover || !info) return () => {};

    const open = () => {
        const src = cover.currentSrc || cover.src;
        if (!hasCoverArt(src)) return;
        return openBigPicture({ ...bigCoverSource(src), title: text(playerPart('title')) || 'Cover', artist: text(playerPart('artist')) });
    };

    const button = iconButton({ icon: 'maximize-2', label: 'View cover', size: 'sm', tooltip: { description: 'Show the cover large' }, className: 'cover-expand', onClick: open });
    button.hidden = true;
    info.append(button);
    const sync = () => {
        button.hidden = !hasCoverArt(cover.currentSrc || cover.src);
    };
    new MutationObserver(sync).observe(cover, { attributes: true, attributeFilter: ['src'] });
    cover.addEventListener('load', sync);
    sync();
    return () => button.remove();
}
