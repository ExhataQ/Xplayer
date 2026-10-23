// The Keyboard shortcuts page (task PA-11, brief 11.3 and 13): a dialog opened from Help > Keyboard shortcuts.
// The list is written out here because the engine's handler (js/ui/06k-keyboard-shortcuts.js) is one switch with no table to read.
// The Application group is handled in shell/app-menu.js (keep both in step). The test in tools/tests/ui-next-settings-layout.test.js checks the groups.
import { openDialog, el } from '../components/index.js';
import { AI_SHORTCUTS, hasAiChat, getAiCommands } from './ai-slots.js';

const GROUPS = [
    {
        title: 'Playback',
        rows: [
            ['Play or pause', ['Space']],
            ['Back or forward 5 seconds', ['←', '→']],
            ['Back or forward 30 seconds', ['Shift+←', 'Shift+→']],
            ['Volume up or down', ['Ctrl+↑', 'Ctrl+↓']],
            ['Next or previous song', ['Ctrl+→', 'Ctrl+←']],
            ['Mute', ['M']],
            ['Shuffle', ['S']],
            ['Repeat', ['R']]
        ]
    },
    {
        title: 'Views and lists',
        rows: [
            ['Lyrics', ['L']],
            ['Scroll the list', ['PageUp', 'PageDown']],
            ['Top or bottom of the list', ['Home', 'End']],
            ['Select all songs', ['Ctrl+A']],
            ['Delete the selected songs from the computer', ['Ctrl+D']],
            ['Go back or forward', ['Mouse back button', 'Mouse forward button']]
        ]
    },
    {
        title: 'Application',
        rows: [
            ['Home, Library, Search, Recently played', ['Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4']],
            ['Find', ['Ctrl+F']],
            ['Queue', ['Ctrl+Q']],
            ['Metadata', ['Ctrl+E']],
            ['Settings', ['Ctrl+,']],
            ['New playlist', ['Ctrl+N']],
            ['New folder', ['Ctrl+Shift+N']],
            ['Play from URL', ['Ctrl+U']],
            ['Keyboard shortcuts', ['Ctrl+/']]
        ]
    }
];

function aiRows() {
    const rows = [];
    if (hasAiChat()) rows.push(['AI chat', [AI_SHORTCUTS.chat]]);
    if (typeof getAiCommands().shuffle === 'function') rows.push(['AI shuffle', [AI_SHORTCUTS.shuffle]]);
    if (typeof getAiCommands().undo === 'function') rows.push(['Undo the last AI change', [AI_SHORTCUTS.undo]]);
    return rows.length ? [{ title: 'AI', rows }] : [];
}

const caps = (combo) => el('span', { class: 'shortcuts__combo' }, ...combo.split('+').map((k) => el('kbd', { class: 'shortcuts__key' }, k)));

export function openShortcuts() {
    const body = el('div', { class: 'shortcuts' });
    for (const group of [...GROUPS, ...aiRows()]) {
        const list = el('dl', { class: 'shortcuts__list' });
        for (const [label, combos] of group.rows) {
            const keys = el('dd', { class: 'shortcuts__keys' });
            combos.forEach((c, i) => keys.append(...(i ? [' / '] : []), caps(c)));
            list.append(el('dt', {}, label), keys);
        }
        body.append(el('section', { class: 'shortcuts__group', 'aria-label': group.title }, el('h3', { class: 'shortcuts__title' }, group.title), list));
    }
    return openDialog({ title: 'Keyboard shortcuts', body, wide: true, actions: [{ label: 'Close', value: 'close', variant: 'primary', autofocus: true }] });
}
