// List toolbar: play or pause the whole list, shuffle, find in this list, and the engine's "more" menu for it.
// These are the engine's old sub-header actions; each button calls the engine's own function through adapter/listbar-bridge.js.

import { el, iconEl, iconButton } from '../../components/index.js';
import { panelSearch } from './panel-search.js';
import { openShuffleMenu } from '../../adapter/shuffle-menu.js';
import { isListPlaying, isShuffleOn, togglePlayAll, showListMenu, findInList, onListStateChange } from '../../adapter/listbar-bridge.js';

const FIND_DELAY = 150;

/** Returns { el, update(), reset(), destroy() }. update() re-reads playing and shuffle state; reset() empties and closes the find field. */
export function createListToolbar() {
    // Tooltips are functions: the label and state change with playback, and the tooltip reads them each time it opens.
    const play = iconButton({ icon: 'play', label: 'Play', variant: 'solid', tooltip: () => ({ description: isListPlaying() ? '' : 'Play all songs in this list' }), onClick: () => togglePlayAll() });
    // The engine's list shuffle is the player's shuffle button, so it has the same key.
    const shuffle = iconButton({ icon: 'shuffle', label: 'Shuffle', pressed: false, tooltip: () => ({ state: isShuffleOn() ? 'On' : 'Off', shortcut: 'S' }), onClick: () => openShuffleMenu(shuffle) });
    const more = iconButton({ icon: 'ellipsis', label: 'More options for this list', onClick: (event) => showListMenu(event) });

    // The same find control as the Library panel (panel-search.js): one search button that opens into a field.
    let timer = 0;
    const find = panelSearch({
        label: 'Find in this list',
        placeholder: 'Find in list',
        tooltip: { description: 'Filter the songs in this list' },
        onInput: (text) => {
            clearTimeout(timer);
            timer = setTimeout(() => findInList(text), text ? FIND_DELAY : 0);
        }
    });

    function update() {
        const playing = isListPlaying();
        play.replaceChildren(iconEl(playing ? 'pause' : 'play', { size: 20, filled: true }));
        play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        shuffle.setAttribute('aria-pressed', String(isShuffleOn()));
    }

    const root = el('div', { class: 'list-toolbar' }, play, shuffle, find.el, more);
    const stop = onListStateChange(update);
    update();

    return {
        el: root,
        update,
        reset() {
            clearTimeout(timer);
            find.reset();
            update();
        },
        destroy() {
            clearTimeout(timer);
            stop();
        }
    };
}
