// Two small motions that need a listener (task C8; the styles are in shell/motion.css).
//   - A song added to a playlist: that playlist's row in the left panel gives one short pulse. The engine says so with
//     'playlist:songCountChanged' { added: true } (js/playlists/03c-playlists.js), and only a real add carries the flag.
//   - A drop settles into its target: the row that had the drop ring when the drop happened gets one short settle.
// Neither runs while Reduce animations is on, and neither changes what a drop or an add does.

import { on } from '../adapter/events.js';
import { reducedMotion } from '../components/motion.js';

const PULSE_MS = 450;
const SETTLE_MS = 260;

function mark(node, name, ms) {
    if (!node || reducedMotion()) return;
    node.setAttribute(name, '');
    clearTimeout(node._markTimer);
    node._markTimer = setTimeout(() => node.removeAttribute(name), ms);
}

export function installSmallMotions() {
    // The engine may still be loading: the page's event bus exists once it has.
    const subscribe = () => {
        try {
            on('playlist:songCountChanged', (detail) => {
                if (!detail || !detail.added) return;
                const id = String(detail.playlistId).replace(/["\\]/g, '');
                mark(document.querySelector(`.left-panel-main-item[data-view="playlist-${id}"]`), 'data-pulse', PULSE_MS);
            });
        } catch (error) {
            return false;
        }
        return true;
    };
    if (!subscribe()) window.addEventListener('load', subscribe, { once: true });

    // At the moment of the drop the target still wears the engine's ring (drag-hover) or folder tint.
    document.addEventListener(
        'drop',
        () => mark(document.querySelector('.left-panel-main-item.drag-hover, .left-panel-main-item.drag-folder-hover, .queue-item.drag-hover'), 'data-settle', SETTLE_MS),
        true
    );
}
