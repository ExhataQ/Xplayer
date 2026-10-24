// Search view (task B-04): a search field above the song list. With nothing typed it shows the recent searches; once there
// is a query it shows the engine's result list (the same song list as the Library, with its columns and density).

import { el, textField, iconButton, button, emptyState } from '../../components/index.js';
import { runSearch, recentSearches, openRecentSearch, deleteRecentSearch, clearRecentSearches, resetSearch, onRecentSearchesChange } from '../../adapter/search-bridge.js';

function when(entry) {
    const date = new Date(entry.timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Adds the search field and the recent-searches list to `host`. `start` is a query to show at once (the panel's "show in main view", PB-03). Returns { field, show(query), detach() }. */
export function mountSearchView(host, start = '') {
    let query = '';
    const field = textField({
        label: 'Search your library',
        placeholder: 'Songs, artists, albums',
        search: true,
        onInput: (text) => {
            query = text;
            paint();
            runSearch(text);
        }
    });
    const recents = el('section', { class: 'search-recents', 'aria-label': 'Recent searches' });
    const page = el('div', { class: 'search-page' }, el('div', { class: 'search-page__bar' }, field.el), recents);

    function paintRecents() {
        const entries = recentSearches();
        const head = el('div', { class: 'search-recents__head' }, el('h2', { class: 'search-recents__title' }, 'Recent searches'));
        if (!entries.length) {
            recents.replaceChildren(emptyState({ icon: 'search', title: 'Search your library', text: 'Find songs by title, artist or album. Your recent searches will show up here.' }));
            return;
        }
        head.append(button({ label: 'Clear all', variant: 'ghost', size: 'sm', onClick: () => clearRecentSearches() }));
        const list = el('ul', { class: 'search-recents__list' });
        for (const entry of entries) {
            const open = el(
                'button',
                { type: 'button', class: 'search-recent', 'aria-label': `Search for ${entry.query}, ${entry.resultCount} results` },
                el('span', { class: 'search-recent__query', dir: 'auto' }, entry.query),
                el('span', { class: 'search-recent__meta' }, `${entry.resultCount} ${entry.resultCount === 1 ? 'song' : 'songs'} · ${when(entry)}`)
            );
            open.addEventListener('click', () => {
                query = entry.query;
                field.setValue(entry.query);
                paint();
                openRecentSearch(entry);
            });
            const remove = iconButton({ icon: 'x', label: `Remove ${entry.query} from recent searches`, size: 'sm', onClick: () => deleteRecentSearch(entry) });
            list.append(el('li', { class: 'search-recents__item' }, open, remove));
        }
        recents.replaceChildren(head, list);
    }

    // With no query the result list is hidden and the recent searches show; the engine keeps drawing into the list either way.
    function paint() {
        host.dataset.search = query.trim() ? 'results' : 'empty';
        recents.hidden = Boolean(query.trim());
        if (!query.trim()) paintRecents();
    }

    host.insertBefore(page, host.firstChild);
    if (start.trim()) {
        query = start;
        field.setValue(start);
        runSearch(start);
    }
    paint();
    field.input.focus();
    const stop = onRecentSearchesChange(() => {
        if (!query.trim() || !recents.hidden) paintRecents();
    });

    return {
        field,
        detach() {
            stop();
            page.remove();
            delete host.dataset.search;
            resetSearch();
        }
    };
}
