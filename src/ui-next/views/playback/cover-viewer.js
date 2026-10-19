// Fullscreen cover viewer (task C-04). A button on the cover in the player opens the cover large in a dialog. The old
// engine viewer (ui/06h) needs markup the new shell does not have and its click target is hidden, so this is a new,
// small surface that only reads what the player shows: the cover picture, title and artist.
//
// Click on the picture switches between "fit to window" and "actual size" (scrolls). Escape, the close button or a click
// on the backdrop close it, and focus goes back to the button (components/dialog.js).

import { iconButton, openDialog, el } from '../../components/index.js';
import { playerPart } from '../../adapter/player-parts.js';
import { hasCoverArt } from '../../adapter/playback-bridge.js';

const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

export function mountCoverViewer() {
    const cover = playerPart('cover');
    const info = playerPart('song-info');
    if (!cover || !info) return () => {};

    const open = () => {
        const src = cover.currentSrc || cover.src;
        if (!hasCoverArt(src)) return;
        const title = text(playerPart('title')) || 'Cover';
        const artist = text(playerPart('artist'));
        const picture = el('img', { class: 'cover-viewer__image', src, alt: `Cover of ${title}`, tabindex: 0 });
        const frame = el('div', { class: 'cover-viewer__frame' }, picture);
        const toggleSize = () => {
            const actual = frame.classList.toggle('cover-viewer__frame--actual');
            picture.setAttribute('aria-label', actual ? 'Actual size. Press to fit the window.' : 'Fit to window. Press for actual size.');
        };
        picture.addEventListener('click', toggleSize);
        picture.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                toggleSize();
            }
        });
        picture.setAttribute('aria-label', 'Fit to window. Press for actual size.');
        const body = el('figure', { class: 'cover-viewer' }, frame, artist ? el('figcaption', { class: 'cover-viewer__caption' }, artist) : '');
        const done = openDialog({ title, body, wide: true });
        const dialog = body.closest('dialog');
        if (dialog) dialog.classList.add('dialog--cover'); // wider than the standard wide dialog
        return done;
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
