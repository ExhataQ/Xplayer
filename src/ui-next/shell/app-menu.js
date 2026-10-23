// The application menu (task PA-07, brief 18.2): File, Edit, View, Playback, Tools, Window and Help as submenus of the logo menu, and
// the hotkeys that belong to them. An entry is built only where something can run it. Entries that need a feature the app does not
// have yet (zoom, full screen, undo for non-AI changes, check for updates ...) stay in their group disabled, so the structure is
// complete and the gaps are visible; each is listed in the PA-07 report with what it needs.
//
// Keys: "native" shortcuts are handled by the engine (js/ui/06k-keyboard-shortcuts.js) and are only shown here. The others are
// handled in this file by one capture listener; a combination with an arrow key does not fire while a text box has focus.
import { togglePlayback, next, previous, toggleMute } from '../adapter/actions.js';
import { showNewPlaylist, showNewFolder, showPlayFromUrl, toggleShuffle, toggleRepeat, windowCan, windowDo } from '../adapter/menu-bridge.js';
import { openShortcuts } from './shortcuts-page.js';

const NO = { disabled: true };

/** ctx: { goTo(viewId), toggleQueue(), ai: { 'ai-undo'?, 'ai-chat'?, 'ai-shuffle'? } -> menu items } */
export function appMenuGroups(ctx) {
    const find = () => {
        ctx.goTo('search');
        requestAnimationFrame(() => document.querySelector('.view-host input')?.focus());
    };
    const ai = (key) => (ctx.ai[key] ? [ctx.ai[key]] : []);
    const win = (name, label, keys) => ({ label, keys, ...(windowCan(name) ? { run: () => windowDo(name) } : NO) });
    return [
        {
            group: 'File',
            items: [
                { label: 'Open file…', ...NO },
                { label: 'Open folder…', ...NO },
                { label: 'Play from URL…', keys: 'Ctrl+U', run: showPlayFromUrl },
                { type: 'separator' },
                { label: 'New playlist', keys: 'Ctrl+N', run: showNewPlaylist },
                { label: 'New folder', keys: 'Ctrl+Shift+N', run: showNewFolder },
                { type: 'separator' },
                { label: 'Import and export…', ...NO },
                win('closeApp', 'Close window')
            ]
        },
        { group: 'Edit', items: [...ai('ai-undo'), { label: 'Redo', ...NO }, { type: 'separator' }, { label: 'Select all', native: 'Ctrl+A', ...NO }, { label: 'Find', keys: 'Ctrl+F', run: find }] },
        {
            group: 'View',
            items: [
                { label: 'Home', keys: 'Ctrl+1', run: () => ctx.goTo('home') },
                { label: 'Library', keys: 'Ctrl+2', run: () => ctx.goTo('library') },
                { label: 'Search', keys: 'Ctrl+3', run: () => ctx.goTo('search') },
                { label: 'Recently played', keys: 'Ctrl+4', run: () => ctx.goTo('recent') },
                { label: 'Queue', keys: 'Ctrl+Q', run: ctx.toggleQueue },
                { type: 'separator' },
                { label: 'Big picture mode', ...NO },
                { label: 'Zoom', ...NO },
                { label: 'Full screen', keys: 'F11', ...NO }
            ]
        },
        {
            group: 'Playback',
            items: [
                { label: 'Play or pause', native: 'Space', run: togglePlayback },
                { label: 'Next', keys: 'Ctrl+→', run: next },
                { label: 'Previous', keys: 'Ctrl+←', run: previous },
                { label: 'Shuffle', native: 'S', run: toggleShuffle },
                { label: 'Repeat', native: 'R', run: toggleRepeat },
                { label: 'Mute', native: 'M', run: toggleMute },
                ...ai('ai-shuffle')
            ]
        },
        {
            group: 'Tools',
            items: [
                { label: 'Lyrics', native: 'L', run: () => ctx.goTo('lyrics') },
                { label: 'Metadata', keys: 'Ctrl+E', run: () => ctx.goTo('metadata') },
                ...ai('ai-chat'),
                { type: 'separator' },
                { label: 'Settings', keys: 'Ctrl+,', run: () => ctx.goTo('settings') }
            ]
        },
        { group: 'Window', items: [win('minimizeApp', 'Minimize'), win('maximizeApp', 'Maximize or restore'), { label: 'Always on top', ...NO }] },
        {
            group: 'Help',
            items: [
                { label: 'Keyboard shortcuts', keys: 'Ctrl+/', run: () => openShortcuts() },
                { label: 'About', ...NO },
                { label: 'Check for updates', ...NO },
                { label: 'Open logs', ...NO }
            ]
        }
    ];
}

const shown = (item) => item.keys || item.native || item.shortcut; // `shortcut`: an entry another file made (the AI ones, with their own listener)

/** The items as openMenu wants them: each group a submenu. */
export function toMenuItems(groups) {
    const one = (item) => (item.type ? item : { label: item.label, disabled: item.disabled, shortcut: shown(item), onSelect: item.run ? () => item.run() : item.onSelect });
    return groups.map(({ group, items }) => ({ label: group, items: items.map(one) }));
}

const KEY_ALIASES = { '→': 'ArrowRight', '←': 'ArrowLeft' };

function matches(combo, event) {
    const parts = combo.split('+');
    const key = KEY_ALIASES[parts[parts.length - 1]] || parts[parts.length - 1];
    const mods = parts.slice(0, -1);
    if (event.ctrlKey !== mods.includes('Ctrl') || event.shiftKey !== mods.includes('Shift') || event.altKey || event.metaKey) return false;
    return event.key.length === 1 ? event.key.toLowerCase() === key.toLowerCase() : event.key === key;
}

/** One listener for every `keys` entry that can run. `getGroups()` gives the current groups (AI entries come and go). */
export function installMenuHotkeys(getGroups) {
    document.addEventListener(
        'keydown',
        (event) => {
            if (event.defaultPrevented || event.isComposing || !event.ctrlKey) return;
            const inText = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
            for (const { items } of getGroups()) {
                for (const item of items) {
                    if (!item.keys || !item.run || item.disabled || !matches(item.keys, event)) continue;
                    if (inText && /Arrow|→|←/.test(item.keys)) return; // the arrows belong to the text box
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    item.run();
                    return;
                }
            }
        },
        true
    );
}
