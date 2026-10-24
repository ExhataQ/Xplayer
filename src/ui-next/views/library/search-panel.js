// Search panel (tasks PB-02, PB-19): the left panel for the Search rail item. A field, filter chips (Everything, Songs, Artists, Albums,
// Playlists), then the matches. A filter shows one kind and loads more as you scroll (components/auto-load.js); Everything shows the
// first few of each kind with a "Show all" button. With nothing typed it lists the recent searches. A song opens through openSong()
// (its album, or its own page); a playlist, album or artist opens in the main view. It never touches the engine's own search state.

import { el, textField, chipGroup, autoLoad, emptyState } from '../../components/index.js';
import { searchLibrary } from '../../adapter/panel-lists-bridge.js';
import { recentSearches } from '../../adapter/search-bridge.js';
import { songRow, itemRow } from './panel-rows.js';

export const FILTERS = [
    { value: 'all', label: 'Everything', plural: 'Everything' },
    { value: 'songs', label: 'Songs', plural: 'Songs' },
    { value: 'artists', label: 'Artists', plural: 'Artists' },
    { value: 'albums', label: 'Albums', plural: 'Albums' },
    { value: 'playlists', label: 'Playlists', plural: 'Playlists' }
];
const PREVIEW = 5; // rows per kind under Everything
const PAGE = 40;

let rememberedFilter = 'all'; // kept while the app runs, also when the panel closes and opens again (PB-19)

/** Builds the panel inside `body`. `ctx.open(item)` opens a playlist, album or artist; `ctx.openSong(id)` opens a song. */
export function mountSearchPanel(body, ctx) {
    let query = '';
    let filter = FILTERS.some((f) => f.value === rememberedFilter) ? rememberedFilter : 'all';
    let found = searchLibrary('');
    let loader = null;
    const field = textField({
        label: 'Search your library',
        placeholder: 'Songs, artists, albums',
        search: true,
        onInput: (text) => {
            query = text;
            found = searchLibrary(text);
            paint();
        }
    });
    const chips = chipGroup({
        label: 'Search in',
        items: FILTERS.map(({ value, label }) => ({ value, label })),
        value: filter,
        onChange: (value) => {
            filter = rememberedFilter = value;
            paint();
        }
    });
    const results = el('div', { class: 'plist-results', 'aria-live': 'polite' });
    const root = el('div', { class: 'plist-panel', 'data-panel-kind': 'search' }, el('div', { class: 'plist-panel__bar' }, field.el), el('div', { class: 'plist-panel__chips' }, chips.el), results);
    body.classList.add('panel-host__body--lists');
    body.append(root);

    const activate = (item) => (item.kind === 'song' ? ctx.openSong(item.id) : ctx.open(item));
    const build = (item) => (item.kind === 'song' ? songRow(item, { onActivate: activate }) : itemRow(item, { onActivate: activate }));
    const section = (title, ...children) => el('section', { class: 'plist-section' }, el('h3', { class: 'plist-section__title' }, title), ...children);

    function stop() {
        if (loader) loader.destroy();
        loader = null;
    }

    function recentSection() {
        const recent = recentSearches();
        if (!recent.length) return emptyState({ icon: 'search', title: 'Search your library', text: 'Songs, artists, albums and playlists that match show up here.' });
        const items = recent.slice(0, 12).map((entry) => {
            const button = el('button', { type: 'button', class: 'plist-row plist-row--text' }, el('span', { class: 'plist-row__text' }, el('span', { class: 'plist-row__title', dir: 'auto' }, entry.query), el('span', { class: 'plist-row__sub' }, `${entry.resultCount} ${entry.resultCount === 1 ? 'song' : 'songs'}`)));
            button.addEventListener('click', () => {
                field.setValue(entry.query);
                query = entry.query;
                found = searchLibrary(query);
                paint();
                field.input.focus();
            });
            return el('li', { class: 'plist-item' }, button);
        });
        return section('Recent searches', el('ul', { class: 'plist-list' }, ...items));
    }

    function paint() {
        stop();
        chips.setValue(filter);
        if (!query.trim()) return void results.replaceChildren(recentSection());
        const total = found.songs.length + found.artists.length + found.albums.length + found.playlists.length;
        if (!total) return void results.replaceChildren(el('p', { class: 'plist-empty', role: 'status' }, `Nothing matches "${query.trim()}".`));
        if (filter === 'all') {
            const parts = [];
            for (const { value, plural } of FILTERS.slice(1)) {
                const list = found[value];
                if (!list.length) continue;
                const rows = el('ul', { class: 'plist-list' }, ...list.slice(0, PREVIEW).map(build));
                const parts2 = [rows];
                if (list.length > PREVIEW) {
                    const more = el('button', { type: 'button', class: 'plist-more' }, `Show all ${list.length} ${plural.toLowerCase()}`);
                    more.addEventListener('click', () => {
                        filter = rememberedFilter = value;
                        paint();
                    });
                    parts2.push(more);
                }
                parts.push(section(plural, ...parts2));
            }
            return void results.replaceChildren(...parts);
        }
        const list = found[filter];
        if (!list.length) {
            const name = FILTERS.find((f) => f.value === filter).plural.toLowerCase();
            return void results.replaceChildren(el('p', { class: 'plist-empty', role: 'status' }, `No ${name} match "${query.trim()}".`));
        }
        const wrap = el('section', { class: 'plist-section' });
        results.replaceChildren(wrap);
        results.scrollTop = 0;
        loader = autoLoad({ scroller: results, pageSize: PAGE, className: 'plist-list', renderItem: build, loadPage: async (offset, count) => list.slice(offset, offset + count) });
        wrap.append(loader.el);
    }

    paint();
    return {
        root,
        field,
        query: () => query,
        filter: () => filter,
        show() {
            root.hidden = false;
            body.classList.add('panel-host__body--lists');
            paint();
            field.input.focus();
        },
        hide() {
            root.hidden = true;
            body.classList.remove('panel-host__body--lists');
        }
    };
}
