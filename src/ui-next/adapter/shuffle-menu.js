// shuffle-menu (task PB-07, brief 7.4): the shuffle mode as a floating menu, where the engine opened a modal dialog.
//
//   shuffleModeInfo()        -> { on, mode: 'normal' | 'smart', smartAvailable }   smart shuffle needs a list of more than 50 songs
//   chooseShuffleMode(mode)  'normal' | 'smart' | 'off': the engine's own choice (selectShuffleMode), so the queue and the lists react as before
//   openShuffleMenu(anchor, { above })  the menu, below `anchor`, or above it from the player bar
//   installShuffleMenu()     the player's shuffle button, and the S key that clicks it, open this menu instead of the engine dialog
// The list toolbar's shuffle button calls openShuffleMenu() itself.

import { openMenu } from '../components/index.js';

const engine = () => window;

export function shuffleModeInfo() {
    const songs = typeof engine().getSongsForList === 'function' ? engine().getSongsForList(engine().currentView) : [];
    return { on: Boolean(engine().isShuffled), mode: engine().shuffleMode === 'smart' ? 'smart' : 'normal', smartAvailable: (songs || []).length > 50 };
}

export function chooseShuffleMode(mode) {
    if (typeof engine().selectShuffleMode !== 'function') return false;
    engine().selectShuffleMode(mode);
    return true;
}

export function openShuffleMenu(anchor, { above = false } = {}) {
    const { on, mode, smartAvailable } = shuffleModeInfo();
    const items = [
        { label: 'Normal shuffle', icon: 'shuffle', radio: true, checked: on && mode === 'normal', onSelect: () => chooseShuffleMode('normal') },
        { label: smartAvailable ? 'Smart shuffle' : 'Smart shuffle (needs more than 50 songs)', icon: 'sparkles', radio: true, checked: on && mode === 'smart', disabled: !smartAvailable, onSelect: () => chooseShuffleMode('smart') }
    ];
    if (on) items.push({ type: 'separator' }, { label: 'Turn shuffle off', icon: 'x', onSelect: () => chooseShuffleMode('off') });
    return openMenu({ anchor, items, above });
}

export function installShuffleMenu() {
    const button = document.getElementById('shuffle-btn');
    if (!button) return false;
    button.onclick = () => openShuffleMenu(button, { above: true }); // the button is in the player bar, at the bottom of the window
    return true;
}
