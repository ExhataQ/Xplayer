// A quick on/off button for the visualizer, at the start of the player's right controls (the same switch as Settings, Playback, Player bar).
// It is a toggle button: aria-pressed carries the state, the tooltip says On or Off. It follows the setting, wherever the setting is changed.

import { iconButton } from '../../components/index.js';
import { playerPart } from '../../adapter/player-parts.js';
import { isVisualizerOn, setVisualizerOn, watchVisualizer } from './visualizer-setting.js';

export function mountVisualizerToggle() {
    const anchor = playerPart('right-controls');
    if (!anchor) return () => {};
    const button = iconButton({
        icon: 'visualizer',
        label: 'Visualizer',
        size: 'sm',
        pressed: isVisualizerOn(),
        tooltip: () => ({ state: isVisualizerOn() ? 'On' : 'Off', description: 'Bars that move with the music, behind the player' }),
        className: 'player-visualizer-toggle',
        onClick: () => setVisualizerOn(!isVisualizerOn())
    });
    anchor.prepend(button);
    const stop = watchVisualizer((on) => {
        button.setAttribute('aria-pressed', String(on));
        if (button.tooltip && button.tooltip.refresh) button.tooltip.refresh();
    });
    return () => {
        stop();
        button.remove();
    };
}
