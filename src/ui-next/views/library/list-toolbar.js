// List toolbar (task B-05): play or pause the whole list, shuffle, find in this list, and the engine's "more" menu for it.
// These are the engine's old sub-header actions; each button calls the engine's own function through adapter/listbar-bridge.js.

import { el, iconEl, iconButton, textField } from '../../components/index.js';
import { openShuffleMenu } from '../../adapter/shuffle-menu.js';
import { isListPlaying, isShuffleOn, togglePlayAll, showListMenu, findInList, onListStateChange } from '../../adapter/listbar-bridge.js';

const FIND_DELAY = 150;

/** Returns { el, update(), reset(), destroy() }. update() re-reads playing and shuffle state; reset() closes the find field. */
export function createListToolbar() {
    // Tooltips are functions: the label and state change with playback, and the tooltip reads them each time it opens (A-08).
    const play = iconButton({ icon: 'play', label: 'Play', variant: 'solid', tooltip: () => ({ description: isListPlaying() ? '' : 'Play all songs in this list' }), onClick: () => togglePlayAll() });
    // The engine's list shuffle is the player's shuffle button, so it has the same key.
    const shuffle = iconButton({ icon: 'shuffle', label: 'Shuffle', pressed: false, tooltip: () => ({ state: isShuffleOn() ? 'On' : 'Off', shortcut: 'S' }), onClick: () => openShuffleMenu(shuffle) });
    const findButton = iconButton({ icon: 'search', label: 'Find in this list', pressed: false, tooltip: { description: 'Filter the songs in this list' }, onClick: () => setFind(findBox.hidden) });
    const more = iconButton({ icon: 'ellipsis', label: 'More options for this list', onClick: (event) => showListMenu(event) });

    let timer = 0;
    const field = textField({
        label: 'Find in this list',
        placeholder: 'Find in list',
        search: true,
        onInput: (text) => {
            clearTimeout(timer);
            timer = setTimeout(() => findInList(text), text ? FIND_DELAY : 0);
        }
    });
    const findBox = el('div', { class: 'list-toolbar__find', hidden: true }, field.el);
    field.input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !field.input.value) {
            event.stopPropagation();
            setFind(false);
            findButton.focus();
        }
    });

    function setFind(open) {
        findBox.hidden = !open;
        findButton.setAttribute('aria-pressed', String(open));
        if (open) field.input.focus();
        else {
            clearTimeout(timer);
            field.setValue('');
            findInList('');
        }
    }

    function update() {
        const playing = isListPlaying();
        play.replaceChildren(iconEl(playing ? 'pause' : 'play', { size: 20, filled: true }));
        play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        shuffle.setAttribute('aria-pressed', String(isShuffleOn()));
    }

    const root = el('div', { class: 'list-toolbar' }, play, shuffle, findButton, findBox, more);
    const stop = onListStateChange(update);
    update();

    return {
        el: root,
        update,
        reset() {
            if (!findBox.hidden || field.input.value) {
                clearTimeout(timer);
                findBox.hidden = true;
                findButton.setAttribute('aria-pressed', 'false');
                field.setValue('');
            }
            update();
        },
        destroy() {
            clearTimeout(timer);
            stop();
        }
    };
}
