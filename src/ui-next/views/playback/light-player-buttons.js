// Two buttons at the far right of the player bar, next to the volume bar: the Mini Player and the Quick Player (ui-next/light/).
// A click moves the song that plays to the light window, in that view, from the same place, and this window pauses (the engine does
// that: js/ui/06b-modals.js, showCurrentSongInLightPlayer). The names and icons are in ui-next/light/names.js.
//
// The buttons are made here, not in the engine's player markup (adapter/legacy-dom-adapter.js), so that markup and its contract stay
// as they are. They only show in the desktop app (the light window is part of it). They work with nothing loaded too: the player that opens is
// empty, ready for files to be dropped on it or chosen in its menu.

import { iconButton, el } from '../../components/index.js';
import { engineCall } from '../../adapter/engine-api.js';
import { notify } from '../../shell/notify.js';
import { PLAYER_NAMES, PLAYER_ICONS } from '../../light/names.js';

const VIEWS = ['mini', 'quick'];

async function showIn(view) {
    const answer = await engineCall('showCurrentSongInLightPlayer', view);
    if (answer && answer.success === false) notify({ kind: 'warning', title: `Could not open the ${PLAYER_NAMES[view]}`, detail: answer.error || '' });
}

/**
 * Adds the buttons after the volume control. `volume` is the volume slider (from adapter/player-parts.js). Returns a function that removes them.
 */
export function mountLightPlayerButtons({ volume } = {}) {
    // The bar is built before the engine registers window.desktopApi, so ask the preload's bridge itself (desktopApi.supports does the same).
    const available = Boolean(window.electronAPI && typeof window.electronAPI.openLightPlayer === 'function');
    const host = volume && volume.closest('.player-right-controls');
    if (!available || !host) return () => {};

    const group = el('div', { class: 'light-player-buttons' });
    const buttons = VIEWS.map((view) =>
        iconButton({ icon: PLAYER_ICONS[view], label: PLAYER_NAMES[view], size: 'sm', className: `light-player-btn light-player-btn--${view}`, onClick: () => showIn(view) })
    );
    group.append(...buttons);
    host.append(group); // the last thing in the bar: far right, next to the volume bar

    return () => group.remove();
}
