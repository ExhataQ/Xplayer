// The volume bar for a narrow window. Below 900 px the player bar folds the horizontal volume bar away (shell/shell.css) and only the speaker
// icon stays, which left no way to set the volume with the mouse. While the bar is folded, the icon opens the standard vertical volume bar
// (components/volume-pop.js, the same one the Mini Player has) above itself: move the pointer onto the icon, turn the wheel over it, or press Up
// or Down on it from the keyboard. A click on the icon still mutes. The engine keeps the one volume (js/playback/15g): this only calls
// updateVolume and follows the fill the engine draws, so the icon, the horizontal bar, the keyboard shortcuts and this bar always agree.

import { createVolumePop } from '../../components/volume-pop.js';
import { playerPart } from '../../adapter/player-parts.js';
import { engineAction } from '../../adapter/engine-api.js';

/** True while the horizontal volume bar is folded away (a narrow window), so the speaker icon is the only volume control on screen. */
export function volumeBarHidden() {
    const bar = playerPart('volume');
    return Boolean(bar) && getComputedStyle(bar).display === 'none';
}

export function mountVolumePopover() {
    const icon = playerPart('volume-icon');
    const fill = playerPart('volume-fill');
    if (!icon || !fill) return () => {};

    const pop = createVolumePop({
        icon,
        position: () => (parseFloat(fill.style.width) || 0) / 100,
        setPosition: (next) => engineAction('updateVolume', next),
        enabled: volumeBarHidden
    });
    const watchFill = new MutationObserver(() => pop.refresh());
    watchFill.observe(fill, { attributes: true, attributeFilter: ['style'] });
    return () => {
        watchFill.disconnect();
        pop.destroy();
    };
}
