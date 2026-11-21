// The Keyboard shortcuts page: a dialog opened from Help > Keyboard shortcuts.
// The list is written out here because the engine's handler (js/ui/06k-keyboard-shortcuts.js) is one switch with no table to read.
// The Application group is handled in shell/app-menu.js (keep both in step). The test in tools/tests/interface/ui-next-settings-layout.test.js checks the groups.
import { openDialog, el } from '../components/index.js';
import { AI_SHORTCUTS, hasAiChat, getAiCommands } from './ai-slots.js';
import { ratingSystemOn } from '../adapter/ratings-bridge.js';

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

// Only while the Rating system is on (library/rating-keys.js has the keys).
function ratingRows() {
    if (!ratingSystemOn()) return [];
    return [
        {
            title: 'Rating',
            rows: [
                ['Rate the selected songs, or the playing one', ['1', '2', '3', '4', '5']],
                ['Half star', ['Shift+1', 'Shift+2', 'Shift+3', 'Shift+4', 'Shift+5']],
                ['Remove the rating', ['0']]
            ]
        }
    ];
}

const caps = (combo) => el('span', { class: 'shortcuts__combo' }, ...combo.split('+').map((k) => el('kbd', { class: 'shortcuts__key' }, k)));

export function openShortcuts() {
    const body = el('div', { class: 'shortcuts' });
    for (const group of [...GROUPS, ...ratingRows(), ...aiRows()]) {
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
