// "Add songs from…" (the tag sheet and the Lyrics batch page): one button that opens a search box over everything songs can be loaded
// from, grouped as Now (selection, queue, search results), Library, Playlists, Albums and Artists. Type to narrow it (any part of the name, any
// order of words), Up and Down move, Enter adds, Escape closes. It replaces a plain drop-down that listed every playlist, album and artist
// in one long scroll with no way to search it.
import { el, iconEl, openPicker } from '../../components/index.js';
import { GROUPS, filterSources } from './source-picker-model.js';

const ICONS = { selection: 'square', queue: 'list-music', search: 'search', 'all-songs': 'library', favorites: 'heart', playlist: 'list-music', album: 'album', artist: 'artist' };
const iconFor = (source) => ICONS[source.id] || ICONS[source.group] || 'list-music';
const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));

/**
 * sourceButton({ list, onPick, label?, className?, focusKey? }) -> the button.
 *   list()       the sources to offer right now: [{ id, label, group, count? }] (read each time the picker opens, so new playlists show)
 *   onPick(id)   called with the chosen source's id
 */
export function sourceButton({ list, onPick, label = 'Add songs from', className = 'btn btn--outline btn--sm', focusKey } = {}) {
    const node = el('button', { type: 'button', class: `${className} source-button`, 'aria-label': label, 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'data-focus-key': focusKey || null }, iconEl('plus', { size: 16 }), el('span', { class: 'btn__label' }, `${label}…`), iconEl('chevron-down', { size: 16 }));
    let open = null;
    node.addEventListener('click', () => {
        if (open) return void open.close();
        const sources = list();
        const picker = openPicker({
            rect: node.getBoundingClientRect(),
            below: true,
            width: 340,
            label,
            placeholder: 'Search playlists, albums, artists…',
            empty: (query) => (query.trim() ? 'Nothing with that name' : 'Nothing to add from yet'),
            items: (query) => filterSources(sources, query).map((s) => ({ id: s.id, label: s.label, icon: iconFor(s), meta: s.count === undefined ? '' : String(s.count), group: GROUP_LABEL[s.group], match: s.match })),
            onPick: (row) => void onPick(row.id),
            onClose: () => {
                open = null;
                node.setAttribute('aria-expanded', 'false');
            }
        });
        open = picker;
        node.setAttribute('aria-expanded', 'true');
    });
    return node;
}
