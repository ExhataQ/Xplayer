// Home (task PB-15): a stack of shelves. What is on Home is the SHELVES list below: a shelf is { id, title, items(data) }, and a shelf
// with no items is not drawn. To add one later (for example "Recently added"), add an entry here and, if it needs a new kind of
// data, one list in adapter/home-bridge.js. Nothing else changes.
import { el, emptyState } from '../../components/index.js';
import { homeData, openHomeItem } from '../../adapter/home-bridge.js';
import { engineEvent } from '../../adapter/engine-api.js';
import { shelf } from './shelf.js';

const LIMIT = 20;

export const SHELVES = [
    { id: 'recent-songs', title: 'Recently played', items: (d) => d.songs },
    { id: 'playlists', title: 'Your playlists', items: (d) => d.playlists },
    { id: 'recent-albums', title: 'Recent albums', items: (d) => d.albums.filter((i) => i.played) },
    { id: 'recent-artists', title: 'Recent artists', items: (d) => d.artists.filter((i) => i.played) }
];

export function mountHome(host, { shelves = SHELVES, read = homeData, open = openHomeItem } = {}) {
    const root = el('div', { class: 'home' });
    host.append(root);
    let shown = '';

    function refresh() {
        const data = read();
        const lists = shelves.map((s) => ({ s, items: s.items(data).slice(0, LIMIT) })).filter(({ items }) => items.length);
        const signature = JSON.stringify(lists.map(({ s, items }) => [s.id, items.map((i) => [i.kind, i.id, i.title, i.subtitle])]));
        if (signature === shown) return; // nothing changed: keep the rows where the person scrolled them
        shown = signature;
        root.replaceChildren(
            ...(lists.length
                ? lists.map(({ s, items }) => shelf({ id: s.id, title: s.title, items, onOpen: open }))
                : [emptyState({ title: 'Nothing played yet', text: 'Songs, albums and playlists you play show up here.' })])
        );
    }

    refresh();
    const stop = engineEvent('queue:indexChanged', () => root.isConnected && refresh());
    return {
        refresh,
        destroy() {
            stop();
            root.remove();
        }
    };
}
